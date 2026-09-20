
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Cargo, Client, Product, User, FreightLeg, DailyScheduleEntry, Branch, FreightOffer } from '../types';
import { CargoStatus, CargoType, UserProfile, VehicleSetType, VehicleBodyType, DailyScheduleType, FreightPricingType } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { XIcon } from './icons/XIcon';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { UserPlusIcon } from './icons/UserPlusIcon';
import { BRAZILIAN_CITIES } from '../brazilianCities';
import { geocodeCity } from '../utils/geocoding';
import { useToast } from '../hooks/useToast';
import { autoFormatInput, parseLocation } from '../utils/formatters';
import { validateCityFormat } from '../utils/cityUtils';

interface LoadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (load: Cargo | Omit<Cargo, 'id' | 'history' | 'createdAt' | 'createdById'>) => void;
  loadToEdit: Cargo | null;
  clients: Client[];
  products: Product[];
  currentUser: User;
  users: User[];
  loads: Cargo[];
  branches: Branch[];
  initialStep?: number;
  offerToConvert?: FreightOffer | null;
}

const STEPS = ['Informações da Carga', 'Programação Diária', 'Valores e Regras'];

const DEFAULT_ALLOWED_VEHICLE_TYPES = Object.values(VehicleSetType).map(setType => ({
    setType,
    bodyTypes: Object.values(VehicleBodyType)
}));

const LoadFormModal: React.FC<LoadFormModalProps> = ({ isOpen, onClose, onSave, loadToEdit, clients, products, currentUser, users, loads, branches, initialStep = 1, offerToConvert }) => {
  const getInitialState = (): Omit<Cargo, 'id' | 'history' | 'createdAt' | 'createdById'> => {
    const newSequenceId = loads.length > 0 ? Math.max(...loads.map(c => Number(c.sequenceId) || 0)) + 1 : 101;
    
    if (offerToConvert) {
      const parsedOrigin = parseLocation(offerToConvert.originLocation);
      const parsedDest = parseLocation(offerToConvert.destinationLocation);

      return {
        sequenceId: newSequenceId,
        clientId: offerToConvert.clientId,
        productId: offerToConvert.productId,
        origin: offerToConvert.origin,
        originLocation: parsedOrigin.prefixText || (!parsedOrigin.isUrl ? offerToConvert.originLocation || '' : ''),
        originMapLink: parsedOrigin.isUrl ? (parsedOrigin.cleanShortUrl || parsedOrigin.href || '') : '',
        destination: offerToConvert.destination,
        destinationLocation: parsedDest.prefixText || (!parsedDest.isUrl ? offerToConvert.destinationLocation || '' : ''),
        destinationMapLink: parsedDest.isUrl ? (parsedDest.cleanShortUrl || parsedDest.href || '') : '',
        totalVolume: offerToConvert.totalTonnage,
        scheduledVolume: 0,
        loadedVolume: 0,
        companyFreightValuePerTon: offerToConvert.counterOfferValue || offerToConvert.freightValuePerTon || 0,
        driverFreightValuePerTon: 0,
        hasIcms: false,
        icmsPercentage: 0,
        freightPricingType: FreightPricingType.PorTonelada,
        fixedCompanyFreight: 0,
        fixedDriverFreight: 0,
        icmsCalculationType: 'percentage',
        icmsValue: 0,
        requiresScheduling: false,
        type: CargoType.Spot,
        status: CargoStatus.EmAndamento,
        loadingDeadline: '',
        allowedVehicleTypes: DEFAULT_ALLOWED_VEHICLE_TYPES,
        freightLegs: [
          { companyFreightValuePerTon: offerToConvert.counterOfferValue || offerToConvert.freightValuePerTon || 0, driverFreightValuePerTon: 0, hasIcms: false, icmsPercentage: 0, pricingType: FreightPricingType.PorTonelada },
          { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, hasIcms: false, icmsPercentage: 0, pricingType: FreightPricingType.PorTonelada }
        ],
        dailySchedule: [],
        observations: offerToConvert.dailySchedule ? `Cadência sugerida pelo cliente: ${offerToConvert.dailySchedule}` : '',
        attachments: offerToConvert.attachments || [],
        salespersonCommissionPerTon: 0,
        branchId: currentUser.branchId,
        recipientClient: offerToConvert.recipientClient || '',
      };
    }

    return ({
    sequenceId: newSequenceId,
    clientId: clients[0]?.id || '',
    recipientClient: '',
    productId: products[0]?.id || '',
    origin: '',
    originLocation: '',
    originMapLink: '',
    destination: '',
    destinationLocation: '',
    destinationMapLink: '',
    totalVolume: 0,
    scheduledVolume: 0,
    loadedVolume: 0,
    companyFreightValuePerTon: 0,
    driverFreightValuePerTon: 0,
    hasIcms: false,
    icmsPercentage: 0,
    freightPricingType: FreightPricingType.PorTonelada,
    fixedCompanyFreight: 0,
    fixedDriverFreight: 0,
    icmsCalculationType: 'percentage',
    icmsValue: 0,
    requiresScheduling: false,
    type: CargoType.Spot,
    status: CargoStatus.EmAndamento,
    loadingDeadline: '',
    allowedVehicleTypes: DEFAULT_ALLOWED_VEHICLE_TYPES,
    freightLegs: [
      { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, hasIcms: false, icmsPercentage: 0, pricingType: FreightPricingType.PorTonelada },
      { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, hasIcms: false, icmsPercentage: 0, pricingType: FreightPricingType.PorTonelada }
    ],
    dailySchedule: [],
    observations: '',
    attachments: [],
    salespersonCommissionPerTon: 0,
    branchId: currentUser.branchId,
  })};
  
  const [step, setStep] = useState(initialStep);
  const [load, setLoad] = useState<Omit<Cargo, 'id' | 'history' | 'createdAt' | 'createdById' | 'scheduledVolume' | 'loadedVolume'> & { createdById?: string }>(getInitialState());
  const [hasMultiLeg, setHasMultiLeg] = useState(false);
  const [showSalesperson, setShowSalesperson] = useState(false);
  
  const [newScheduleStartDate, setNewScheduleStartDate] = useState('');
  const [newScheduleEndDate, setNewScheduleEndDate] = useState('');
  const [newScheduleType, setNewScheduleType] = useState<DailyScheduleType>(DailyScheduleType.Livre);
  const [newScheduleTonnage, setNewScheduleTonnage] = useState<number | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for the new allowed vehicle types UI
  const [currentSetType, setCurrentSetType] = useState<VehicleSetType>(VehicleSetType.LSSimples);
  const [currentBodyTypes, setCurrentBodyTypes] = useState<VehicleBodyType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const commercialUsers = useMemo(() => {
    return users.filter(u => u.profile === UserProfile.Comercial);
  }, [users]);

  // Previne recarregamento acidental com dados preenchidos no mobile/desktop
  useEffect(() => {
    if (!isOpen) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOpen]);

  const prevIsOpen = useRef(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
        setStep(initialStep);
        if (loadToEdit) {
            const { history, createdAt, id, scheduledVolume, loadedVolume, ...editableLoad } = loadToEdit;
            const pricingType = editableLoad.freightPricingType || editableLoad.freightLegs?.[0]?.pricingType || FreightPricingType.PorTonelada;
            const fixedComp = editableLoad.fixedCompanyFreight !== undefined 
              ? editableLoad.fixedCompanyFreight 
              : (editableLoad.freightLegs?.[0]?.fixedCompanyFreight ?? (pricingType === FreightPricingType.FreteFechado ? editableLoad.companyFreightValuePerTon : 0));
            const fixedDriv = editableLoad.fixedDriverFreight !== undefined 
              ? editableLoad.fixedDriverFreight 
              : (editableLoad.freightLegs?.[0]?.fixedDriverFreight ?? (pricingType === FreightPricingType.FreteFechado ? editableLoad.driverFreightValuePerTon : 0));
            const icmsCalcType = editableLoad.icmsCalculationType || editableLoad.freightLegs?.[0]?.icmsCalculationType || 'percentage';
            const icmsVal = editableLoad.icmsValue !== undefined 
              ? editableLoad.icmsValue 
              : (editableLoad.freightLegs?.[0]?.icmsValue ?? 0);

            const legs = editableLoad.freightLegs && editableLoad.freightLegs.length > 0
                ? [...editableLoad.freightLegs]
                : [{ 
                    companyFreightValuePerTon: editableLoad.companyFreightValuePerTon, 
                    driverFreightValuePerTon: editableLoad.driverFreightValuePerTon, 
                    hasIcms: editableLoad.hasIcms, 
                    icmsPercentage: editableLoad.icmsPercentage,
                    pricingType: pricingType,
                    fixedCompanyFreight: fixedComp,
                    fixedDriverFreight: fixedDriv,
                    icmsCalculationType: icmsCalcType,
                    icmsValue: icmsVal,
                  }];
            
            while (legs.length < 2) {
                legs.push({ 
                  companyFreightValuePerTon: 0, 
                  driverFreightValuePerTon: 0, 
                  hasIcms: false, 
                  icmsPercentage: 0,
                  pricingType: pricingType,
                  fixedCompanyFreight: 0,
                  fixedDriverFreight: 0,
                  icmsCalculationType: 'percentage',
                  icmsValue: 0,
                });
            }
            
            setLoad({ 
                ...editableLoad, 
                freightPricingType: pricingType,
                fixedCompanyFreight: fixedComp,
                fixedDriverFreight: fixedDriv,
                icmsCalculationType: icmsCalcType,
                icmsValue: icmsVal,
                freightLegs: legs, 
                dailySchedule: editableLoad.dailySchedule || [],
                observations: editableLoad.observations || '',
                attachments: editableLoad.attachments || [],
                allowedVehicleTypes: editableLoad.allowedVehicleTypes || [],
                salespersonName: editableLoad.salespersonName || '',
                salespersonCommissionPerTon: editableLoad.salespersonCommissionPerTon || 0,
                originLocation: editableLoad.originLocation || '',
                destinationLocation: editableLoad.destinationLocation || '',
                recipientClient: editableLoad.recipientClient || '',
                branchId: editableLoad.branchId,
            });
            setHasMultiLeg(editableLoad.freightLegs ? editableLoad.freightLegs.length > 1 : false);
            setShowSalesperson(!!editableLoad.salespersonName);
        } else {
            const { scheduledVolume, loadedVolume, ...initialState } = getInitialState();
            setLoad({ ...initialState, createdById: currentUser.id });
            setHasMultiLeg(false);
            setShowSalesperson(false);
        }
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, initialStep, currentUser]);
  
  const { totalCompanyFreight, totalDriverFreight, netMarginPercentage, exampleSimulation } = useMemo(() => {
    const pricingType = load.freightPricingType || FreightPricingType.PorTonelada;
    const legs = load.freightLegs || [];
    const activeLegs = hasMultiLeg ? legs.slice(0, 2) : legs.slice(0, 1);
    const totalCommission = load.salespersonCommissionPerTon || 0;

    if (pricingType === FreightPricingType.FreteFechado) {
      const compFixed = Number(load.fixedCompanyFreight) || 0;
      const drivFixed = Number(load.fixedDriverFreight) || 0;
      const icmsPct = load.hasIcms ? (Number(load.icmsPercentage) || 0) / 100 : 0;
      const netCompany = compFixed * (1 - icmsPct);
      const netProfit = netCompany - drivFixed;
      const margin = netCompany > 0 ? (netProfit / netCompany) * 100 : 0;

      const netMarginPercentage = isNaN(margin) || !isFinite(margin)
        ? '0,00%'
        : `${margin.toFixed(2).replace('.', ',')}%`;

      return { 
        totalCompanyFreight: compFixed, 
        totalDriverFreight: drivFixed, 
        netMarginPercentage, 
        exampleSimulation: null 
      };
    }

    if (pricingType === FreightPricingType.VlrTonIcms) {
      const baseCompanyPerTon = activeLegs[0]?.companyFreightValuePerTon || 0;
      const driverPerTon = activeLegs[0]?.driverFreightValuePerTon || 0;
      const icmsPct = Number(load.icmsPercentage) || 0;

      // Simulated standard 32t load
      const simWeight = 32;
      const simBase = baseCompanyPerTon * simWeight;
      const simIcms = simBase * (icmsPct / 100);
      const simTotalCompany = simBase + simIcms;
      const simDriver = driverPerTon * simWeight;
      const simTotalPerTon = baseCompanyPerTon * (1 + (icmsPct / 100));

      const totalCompanyEffectivePerTon = baseCompanyPerTon * (1 + (icmsPct / 100));

      const netProfit = simBase - simDriver - (totalCommission * simWeight);
      const margin = simBase > 0 ? (netProfit / simBase) * 100 : 0;

      const netMarginPercentage = isNaN(margin) || !isFinite(margin)
        ? '0,00%'
        : `${margin.toFixed(2).replace('.', ',')}%`;

      return {
        totalCompanyFreight: totalCompanyEffectivePerTon,
        totalDriverFreight: driverPerTon,
        netMarginPercentage,
        exampleSimulation: {
          weight: simWeight,
          base: simBase,
          icms: simIcms,
          totalCompany: simTotalCompany,
          driver: simDriver,
          effectivePerTon: simTotalPerTon,
          icmsPct: icmsPct,
        }
      };
    }

    // Default: Por Tonelada
    const totalCompanyFreight = activeLegs.reduce((sum, leg) => sum + leg.companyFreightValuePerTon, 0);
    const totalDriverFreight = activeLegs.reduce((sum, leg) => sum + leg.driverFreightValuePerTon, 0);
    
    const totalNetCompanyValue = activeLegs.reduce((sum, leg) => {
        const icmsRate = leg.hasIcms ? leg.icmsPercentage / 100 : 0;
        const netValue = leg.companyFreightValuePerTon * (1 - icmsRate);
        return sum + netValue;
    }, 0);

    const netProfit = totalNetCompanyValue - totalDriverFreight - totalCommission;
    const margin = (totalNetCompanyValue > 0) ? (netProfit / totalNetCompanyValue) * 100 : 0;
    
    const netMarginPercentage = isNaN(margin) || !isFinite(margin)
        ? '0,00%'
        : `${margin.toFixed(2).replace('.', ',')}%`;

    return { totalCompanyFreight, totalDriverFreight, netMarginPercentage, exampleSimulation: null };
  }, [load.freightPricingType, load.freightLegs, hasMultiLeg, load.fixedCompanyFreight, load.fixedDriverFreight, load.hasIcms, load.icmsPercentage, load.icmsCalculationType, load.icmsValue, load.salespersonCommissionPerTon]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const formattedValue = autoFormatInput(name, value);
    
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setLoad(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
        setLoad(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    }
    else {
        setLoad(prev => ({ ...prev, [name]: formattedValue }));
    }
  };

  const handleLegChange = (index: number, field: keyof FreightLeg, value: string | number | boolean) => {
    setLoad(prev => {
        const newLegs = [...(prev.freightLegs || [])];
        const legToUpdate = { ...newLegs[index] };
        
        let finalValue = value;
        if (field === 'companyFreightValuePerTon' || field === 'driverFreightValuePerTon' || field === 'icmsPercentage' || field === 'fixedCompanyFreight' || field === 'fixedDriverFreight' || field === 'icmsValue') {
            finalValue = parseFloat(value as string) || 0;
        }

        (legToUpdate as any)[field] = finalValue;
        
        if (field === 'hasIcms' && value === false) {
            legToUpdate.icmsPercentage = 0;
        }
        
        newLegs[index] = legToUpdate;
        return { ...prev, freightLegs: newLegs };
    });
  };
  
  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
          const newFileNames = Array.from(files).map((file: File) => file.name);
          setLoad(prev => ({
              ...prev,
              attachments: [...(prev.attachments || []), ...newFileNames.filter(name => !(prev.attachments || []).includes(name))]
          }));
      }
      e.target.value = '';
  };

  const handleRemoveAttachment = (fileName: string) => {
      setLoad(prev => ({
          ...prev,
          attachments: (prev.attachments || []).filter(name => name !== fileName)
      }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validação estrita de Origem e Destino
    const originValidation = validateCityFormat(load.origin, 'Origem (Cidade)');
    if (!originValidation.isValid) {
      showToast(originValidation.errorMessage || 'Cidade de Origem inválida.', 'warning');
      setStep(1);
      return;
    }

    const destValidation = validateCityFormat(load.destination, 'Destino (Cidade)');
    if (!destValidation.isValid) {
      showToast(destValidation.errorMessage || 'Cidade de Destino inválida.', 'warning');
      setStep(1);
      return;
    }

    setIsSubmitting(true);

    try {
      const pricingType = load.freightPricingType || FreightPricingType.PorTonelada;
      let activeLegs = hasMultiLeg ? (load.freightLegs || []).slice(0, 2) : (load.freightLegs || []).slice(0, 1);

      if (pricingType === FreightPricingType.FreteFechado) {
        activeLegs = [{
          companyFreightValuePerTon: load.fixedCompanyFreight || 0,
          driverFreightValuePerTon: load.fixedDriverFreight || 0,
          hasIcms: load.hasIcms || false,
          icmsPercentage: load.icmsPercentage || 0,
          pricingType: FreightPricingType.FreteFechado,
          fixedCompanyFreight: load.fixedCompanyFreight || 0,
          fixedDriverFreight: load.fixedDriverFreight || 0,
        }];
      } else if (pricingType === FreightPricingType.VlrTonIcms) {
        activeLegs = [{
          companyFreightValuePerTon: load.freightLegs?.[0]?.companyFreightValuePerTon || 0,
          driverFreightValuePerTon: load.freightLegs?.[0]?.driverFreightValuePerTon || 0,
          hasIcms: true,
          icmsPercentage: load.icmsPercentage || 0,
          pricingType: FreightPricingType.VlrTonIcms,
          icmsCalculationType: load.icmsCalculationType || 'percentage',
          icmsValue: load.icmsValue || 0,
        }];
      } else {
        activeLegs = activeLegs.map(leg => ({
          ...leg,
          pricingType: FreightPricingType.PorTonelada,
        }));
      }

      // Geocode origin and destination
      const [originCoords, destinationCoords] = await Promise.all([
          geocodeCity(originValidation.formatted),
          geocodeCity(destValidation.formatted)
      ]);

      const finalLoadData = {
          ...load,
          origin: originValidation.formatted,
          destination: destValidation.formatted,
          freightPricingType: pricingType,
          fixedCompanyFreight: pricingType === FreightPricingType.FreteFechado ? (load.fixedCompanyFreight || 0) : undefined,
          fixedDriverFreight: pricingType === FreightPricingType.FreteFechado ? (load.fixedDriverFreight || 0) : undefined,
          icmsCalculationType: pricingType === FreightPricingType.VlrTonIcms ? (load.icmsCalculationType || 'percentage') : undefined,
          icmsValue: pricingType === FreightPricingType.VlrTonIcms ? (load.icmsValue || 0) : undefined,
          companyFreightValuePerTon: pricingType === FreightPricingType.FreteFechado 
            ? (load.fixedCompanyFreight || 0) 
            : (pricingType === FreightPricingType.VlrTonIcms ? (load.freightLegs?.[0]?.companyFreightValuePerTon || 0) : totalCompanyFreight),
          driverFreightValuePerTon: pricingType === FreightPricingType.FreteFechado
            ? (load.fixedDriverFreight || 0)
            : (pricingType === FreightPricingType.VlrTonIcms ? (load.freightLegs?.[0]?.driverFreightValuePerTon || 0) : totalDriverFreight),
          freightLegs: activeLegs,
          hasIcms: pricingType === FreightPricingType.VlrTonIcms ? true : (activeLegs[0]?.hasIcms || false),
          icmsPercentage: activeLegs[0]?.icmsPercentage || load.icmsPercentage || 0,
          originCoords: originCoords || undefined,
          destinationCoords: destinationCoords || undefined,
      };

      if (loadToEdit) {
        onSave({
          ...loadToEdit, 
          ...finalLoadData,
          scheduledVolume: loadToEdit.scheduledVolume,
          loadedVolume: loadToEdit.loadedVolume,
        });
      } else {
        onSave({
          ...finalLoadData,
          scheduledVolume: 0,
          loadedVolume: 0,
        });
      }
    } catch (err) {
      console.error('Error saving load:', err);
      showToast('Erro ao salvar os dados da carga.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleAddSchedule = () => {
    if (!newScheduleStartDate) {
        showToast('Por favor, selecione a data inicial.', 'warning');
        return;
    }
    if (!newScheduleEndDate) {
        showToast('Por favor, selecione a data final.', 'warning');
        return;
    }
    if (newScheduleEndDate < newScheduleStartDate) {
        showToast('A data final deve ser igual ou posterior à data inicial.', 'warning');
        return;
    }
    if (!newScheduleTonnage || newScheduleTonnage <= 0) {
        showToast('Informe a quantidade de toneladas previstas para o período.', 'warning');
        return;
    }

    // Generate one entry per day in the range
    const entries: DailyScheduleEntry[] = [];
    const start = new Date(newScheduleStartDate + 'T00:00:00');
    const end = new Date(newScheduleEndDate + 'T00:00:00');
    const existing = new Set((load.dailySchedule || []).map(e => e.date));
    const skipped: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (existing.has(dateStr)) {
            skipped.push(new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR'));
        } else {
            entries.push({
                date: dateStr,
                type: newScheduleType,
                tonnage: newScheduleTonnage,
            });
        }
    }

    if (entries.length === 0) {
        showToast('Todas as datas do período já possuem programação.', 'warning');
        return;
    }

    if (skipped.length > 0) {
        showToast(`${entries.length} dia(s) adicionado(s). Ignorados (já existiam): ${skipped.join(', ')}.`, 'warning');
    }

    setLoad(prev => ({
        ...prev,
        dailySchedule: [...(prev.dailySchedule || []), ...entries].sort((a,b) => a.date.localeCompare(b.date)),
    }));
    
    setNewScheduleStartDate('');
    setNewScheduleEndDate('');
    setNewScheduleType(DailyScheduleType.Livre);
    setNewScheduleTonnage(undefined);
  };

  const handleRemoveSchedule = (dateToRemove: string) => {
      setLoad(prev => ({
          ...prev,
          dailySchedule: (prev.dailySchedule || []).filter(e => e.date !== dateToRemove),
      }));
  };

  const handleToggleBodyType = (bt: VehicleBodyType) => {
    setCurrentBodyTypes(prev => 
        prev.includes(bt) ? prev.filter(p => p !== bt) : [...prev, bt]
    );
  };
  
  const handleAddAllowedType = () => {
    if (currentBodyTypes.length === 0) {
        showToast("Selecione ao menos um tipo de carroceria.", 'warning');
        return;
    }
    setLoad(prev => {
        const allowedTypes = prev.allowedVehicleTypes || [];
        const existingIndex = allowedTypes.findIndex(avt => avt.setType === currentSetType);
        
        if (existingIndex !== -1) {
            // Update existing entry by merging body types
            const updatedTypes = [...allowedTypes];
            const existingEntry = updatedTypes[existingIndex];
            const newBodyTypes = [...new Set([...existingEntry.bodyTypes, ...currentBodyTypes])];
            updatedTypes[existingIndex] = { ...existingEntry, bodyTypes: newBodyTypes };
            return { ...prev, allowedVehicleTypes: updatedTypes };
        } else {
            // Add new entry
            return {
                ...prev,
                allowedVehicleTypes: [
                    ...(prev.allowedVehicleTypes || []),
                    { setType: currentSetType, bodyTypes: currentBodyTypes }
                ]
            };
        }
    });
    setCurrentBodyTypes([]);
  };

  const handleRemoveAllowedType = (setTypeToRemove: VehicleSetType) => {
      setLoad(prev => ({
          ...prev,
          allowedVehicleTypes: prev.allowedVehicleTypes?.filter(avt => avt.setType !== setTypeToRemove)
      }));
  };


  const nextStep = () => setStep(s => Math.min(s + 1, STEPS.length));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  if (!isOpen) return null;

  const leg1 = load.freightLegs?.[0] || { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, hasIcms: false, icmsPercentage: 0 };
  const leg2 = load.freightLegs?.[1] || { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, hasIcms: false, icmsPercentage: 0 };


  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 overscroll-contain modal-container">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 max-w-4xl w-full max-h-[92vh] flex flex-col border border-gray-100 dark:border-gray-700 overscroll-contain">
        <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">{loadToEdit ? 'Editar Carga' : 'Nova Carga'}</h2>

        {/* Stepper */}
        <div className="mb-6 flex items-center justify-center border-b dark:border-gray-700 pb-4">
            {STEPS.map((s, i) => (
                <React.Fragment key={s}>
                    <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${i + 1 <= step ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                            {i + 1}
                        </div>
                        <span className={`ml-3 text-sm font-medium ${i + 1 <= step ? 'text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{s}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 mx-4"></div>}
                </React.Fragment>
            ))}
        </div>
        
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (step === STEPS.length) {
              handleSubmit(e);
            } else {
              nextStep();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target instanceof HTMLInputElement && (e.target as HTMLInputElement).type !== 'textarea') {
              if (step < STEPS.length) {
                e.preventDefault();
                nextStep();
              }
            }
          }}
          className="flex-1 overflow-y-auto space-y-6 pr-2 overscroll-contain"
        >
          {step === 1 && (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente Tomador <span className="text-red-500">*</span></label>
                      <select name="clientId" value={load.clientId} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 text-sm" required>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente Destinatário <span className="text-xs text-gray-400 font-normal">(Opcional)</span></label>
                      <input 
                        name="recipientClient" 
                        value={load.recipientClient ?? ''} 
                        onChange={handleChange} 
                        placeholder="Ex: Bunge Alimentos, Cargill..." 
                        className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 text-sm" 
                      />
                    </div>

                    
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Origem (Cidade e Local)</label>
                        <input name="origin" value={load.origin} onChange={handleChange} placeholder="Cidade de Origem (Ex: Rio Verde, GO)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 mb-2" required list="cities-list" />
                        <input name="originLocation" value={load.originLocation ?? ''} onChange={handleChange} placeholder="Nome do Local (Ex: Fazenda...)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 mb-2" />
                        <input name="originMapLink" value={load.originMapLink ?? ''} onChange={handleChange} placeholder="Link do Google Maps (Origem)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Destino (Cidade e Local)</label>
                        <input name="destination" value={load.destination} onChange={handleChange} placeholder="Cidade de Destino (Ex: Santos, SP)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 mb-2" required list="cities-list" />
                        <input name="destinationLocation" value={load.destinationLocation ?? ''} onChange={handleChange} placeholder="Nome do Local (Ex: Porto...)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 mb-2" />
                        <input name="destinationMapLink" value={load.destinationMapLink ?? ''} onChange={handleChange} placeholder="Link do Google Maps (Destino)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    </div>

                    <datalist id="cities-list">
                        {BRAZILIAN_CITIES.map(city => <option key={city} value={city} />)}
                    </datalist>
                </div>

                <div className="border-t dark:border-gray-600 pt-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Observações</label>
                        <textarea
                            name="observations"
                            value={load.observations || ''}
                            onChange={handleChange}
                            placeholder="Adicione qualquer observação relevante sobre a carga..."
                            className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
                            rows={3}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Anexos</label>
                        <div className="mt-1">
                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={handleAttachmentClick}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                            >
                                <PaperclipIcon className="w-4 h-4" />
                                Anexar Arquivos
                            </button>
                        </div>
                        {(load.attachments && load.attachments.length > 0) && (
                            <ul className="mt-2 space-y-1">
                                {load.attachments.map((fileName, index) => (
                                    <li key={index} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/50 p-2 rounded-md">
                                        <span>{fileName}</span>
                                        <button type="button" onClick={() => handleRemoveAttachment(fileName)} className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                 <div className="border-t dark:border-gray-600 pt-4">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Detalhes do Volume e Prazo</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Volume Total (ton)</label>
                            <input name="totalVolume" value={load.totalVolume} onChange={handleChange} type="number" placeholder="Ex: 5000" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01"/>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Volume total contratado para a carga.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prazo de Carregamento</label>
                            <input name="loadingDeadline" value={load.loadingDeadline || ''} onChange={handleChange} type="date" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"/>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Prazo final para o carregamento do lote.</p>
                        </div>
                    </div>
                 </div>
            </div>
          )}
          {step === 2 && (
             <div className="space-y-6">
                 <div>
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Adicionar Nova Programação</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Selecione um período (uma ou mais datas). Uma entrada será criada para cada dia automaticamente.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                       <div>
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data Inicial <span className="text-red-500">*</span></label>
                         <input type="date" value={newScheduleStartDate} onChange={(e) => setNewScheduleStartDate(e.target.value)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"/>
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data Final <span className="text-red-500">*</span></label>
                         <input type="date" value={newScheduleEndDate} min={newScheduleStartDate} onChange={(e) => setNewScheduleEndDate(e.target.value)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"/>
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Demanda <span className="text-red-500">*</span></label>
                         <select value={newScheduleType} onChange={(e) => setNewScheduleType(e.target.value as DailyScheduleType)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">
                           {Object.values(DailyScheduleType).map(type => <option key={type} value={type}>{type}</option>)}
                         </select>
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Toneladas Previstas / dia <span className="text-red-500">*</span></label>
                         <input type="number" value={newScheduleTonnage || ''} onChange={(e) => setNewScheduleTonnage(parseFloat(e.target.value) || undefined)} placeholder="Ex: 150" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01" min="0.01"/>
                       </div>
                       <div className="md:col-span-2">
                         <button type="button" onClick={handleAddSchedule} className="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium">Adicionar à Timeline</button>
                       </div>
                    </div>
                 </div>
                 
                 <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Timeline de Programação</h3>
                        {(load.dailySchedule || []).length > 0 && (
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                {(load.dailySchedule || []).length} dia(s) — {((load.dailySchedule || []).reduce((s, e) => s + (e.tonnage || 0), 0)).toLocaleString('pt-BR')} ton total
                            </span>
                        )}
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                        {(load.dailySchedule || []).length > 0 ? (
                            (load.dailySchedule || []).map(entry => (
                                <div key={entry.date} className="flex justify-between items-center p-3 border rounded-md dark:border-gray-600 bg-white dark:bg-gray-800">
                                    <div className="flex items-center gap-4">
                                        <p className="font-semibold text-gray-800 dark:text-gray-200 w-24">{new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{entry.type}</span>
                                        <span className="text-sm font-bold text-green-700 dark:text-green-400">{(entry.tonnage || 0).toLocaleString('pt-BR')} ton</span>
                                    </div>
                                    <button type="button" onClick={() => handleRemoveSchedule(entry.date)} className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"><XIcon className="w-4 h-4"/></button>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">Nenhuma programação diária definida.</p>
                        )}
                    </div>
                 </div>
             </div>
          )}
          {step === 3 && (
            <div className="space-y-6">
                <div className="border-t dark:border-gray-600 pt-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Modalidade de Cálculo do Frete</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Escolha como o frete desta carga será cotado e liquidado nos embarques</p>
                        </div>
                        {(!load.freightPricingType || load.freightPricingType === FreightPricingType.PorTonelada) && (
                            <button type="button" onClick={() => setHasMultiLeg(prev => !prev)} className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark dark:text-blue-400 dark:hover:text-blue-300 self-start sm:self-auto">
                                {hasMultiLeg ? (<><XIcon className="h-4 w-4" /><span>Remover Perna</span></>) : (<><PlusIcon className="h-4 w-4" /><span>Adicionar Perna</span></>)}
                            </button>
                        )}
                    </div>

                    {/* Freight Pricing Type Selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-gray-100 dark:bg-gray-700/60 rounded-xl mb-5">
                        <button
                            type="button"
                            onClick={() => setLoad(prev => ({ ...prev, freightPricingType: FreightPricingType.PorTonelada }))}
                            className={`py-2 px-3 rounded-lg text-xs md:text-sm font-medium transition-all ${
                                (!load.freightPricingType || load.freightPricingType === FreightPricingType.PorTonelada)
                                    ? 'bg-white dark:bg-gray-800 text-primary dark:text-blue-400 shadow-sm font-semibold'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            📦 Por Tonelada (R$/ton)
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setHasMultiLeg(false);
                                setLoad(prev => ({ ...prev, freightPricingType: FreightPricingType.FreteFechado }));
                            }}
                            className={`py-2 px-3 rounded-lg text-xs md:text-sm font-medium transition-all ${
                                load.freightPricingType === FreightPricingType.FreteFechado
                                    ? 'bg-white dark:bg-gray-800 text-primary dark:text-blue-400 shadow-sm font-semibold'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            🔒 Frete Fechado (Fixo R$)
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setHasMultiLeg(false);
                                setLoad(prev => ({ ...prev, freightPricingType: FreightPricingType.VlrTonIcms, hasIcms: true }));
                            }}
                            className={`py-2 px-3 rounded-lg text-xs md:text-sm font-medium transition-all ${
                                load.freightPricingType === FreightPricingType.VlrTonIcms
                                    ? 'bg-white dark:bg-gray-800 text-primary dark:text-blue-400 shadow-sm font-semibold'
                                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            ⚡ VLR P/ton + ICMS
                        </button>
                    </div>

                    {/* MODE 1: POR TONELADA */}
                    {(!load.freightPricingType || load.freightPricingType === FreightPricingType.PorTonelada) && (
                        <div>
                            {/* Leg 1 */}
                            <div className="p-4 border rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">Perna 1</h4>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="checkbox" checked={leg1.hasIcms} onChange={(e) => handleLegChange(0, 'hasIcms', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Incide ICMS</span>
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frete Empresa (R$/ton)</label>
                                        <input value={leg1.companyFreightValuePerTon || ''} onChange={(e) => handleLegChange(0, 'companyFreightValuePerTon', e.target.value)} type="number" placeholder="Ex: 120,00" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 text-sm" step="0.01"/>
                                    </div>
                                    {leg1.hasIcms && (
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Alíquota ICMS (%)</label>
                                            <input value={leg1.icmsPercentage || ''} onChange={(e) => handleLegChange(0, 'icmsPercentage', e.target.value)} type="number" placeholder="Ex: 12,00" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 text-sm" step="0.01"/>
                                        </div>
                                    )}
                                    <div className={leg1.hasIcms ? '' : 'md:col-start-3'}>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frete Motorista (R$/ton)</label>
                                        <input value={leg1.driverFreightValuePerTon || ''} onChange={(e) => handleLegChange(0, 'driverFreightValuePerTon', e.target.value)} type="number" placeholder="Ex: 100,00" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 text-sm" step="0.01"/>
                                    </div>
                                </div>
                            </div>
                            {/* Leg 2 */}
                            {hasMultiLeg && (
                                <div className="mt-4 p-4 border rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">Perna 2</h4>
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={leg2.hasIcms} onChange={(e) => handleLegChange(1, 'hasIcms', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Incide ICMS</span>
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frete Empresa (R$/ton)</label>
                                            <input value={leg2.companyFreightValuePerTon || ''} onChange={(e) => handleLegChange(1, 'companyFreightValuePerTon', e.target.value)} type="number" placeholder="Ex: 60,00" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 text-sm" step="0.01"/>
                                        </div>
                                        {leg2.hasIcms && (
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Alíquota ICMS (%)</label>
                                                <input value={leg2.icmsPercentage || ''} onChange={(e) => handleLegChange(1, 'icmsPercentage', e.target.value)} type="number" placeholder="Ex: 12,00" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 text-sm" step="0.01"/>
                                            </div>
                                        )}
                                        <div className={leg2.hasIcms ? '' : 'md:col-start-3'}>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frete Motorista (R$/ton)</label>
                                            <input value={leg2.driverFreightValuePerTon || ''} onChange={(e) => handleLegChange(1, 'driverFreightValuePerTon', e.target.value)} type="number" placeholder="Ex: 50,00" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 text-sm" step="0.01"/>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* Totals */}
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-3 bg-gray-100 dark:bg-gray-700/70 rounded-lg">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Frete Empresa (Final / Ton)</label>
                                    <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{totalCompanyFreight.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}/ton</p>
                                </div>
                                <div className="p-3 bg-gray-100 dark:bg-gray-700/70 rounded-lg">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Frete Motorista (Final / Ton)</label>
                                    <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{totalDriverFreight.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}/ton</p>
                                </div>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <label className="text-xs font-medium text-blue-600 dark:text-blue-400">Margem Líquida Estimada</label>
                                    <p className="text-lg font-bold text-primary dark:text-blue-300">{netMarginPercentage}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODE 2: FRETE FECHADO */}
                    {load.freightPricingType === FreightPricingType.FreteFechado && (
                        <div className="space-y-4">
                            <div className="p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                                <span className="text-base">🔒</span>
                                <span><strong>Frete Fechado:</strong> Os valores de frete da empresa e do motorista são fixos por viagem, independente da tonelagem real carregada no caminhão.</span>
                            </div>

                            <div className="p-4 border rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Frete Empresa Fixo (R$ por viagem) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            name="fixedCompanyFreight"
                                            value={load.fixedCompanyFreight || ''}
                                            onChange={handleChange}
                                            type="number"
                                            placeholder="Ex: 5000,00"
                                            className="p-2.5 w-full border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-semibold text-gray-800 dark:text-gray-100"
                                            step="0.01"
                                            min="0"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Valor integral a faturar da empresa cliente por frete/viagem.</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Frete Motorista Fixo (R$ por viagem) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            name="fixedDriverFreight"
                                            value={load.fixedDriverFreight || ''}
                                            onChange={handleChange}
                                            type="number"
                                            placeholder="Ex: 4200,00"
                                            className="p-2.5 w-full border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-semibold text-gray-800 dark:text-gray-100"
                                            step="0.01"
                                            min="0"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Valor fixo acordado a pagar ao motorista por viagem realizada.</p>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t dark:border-gray-700/60 flex items-center justify-between">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="hasIcms"
                                            checked={load.hasIcms || false}
                                            onChange={handleChange}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Descontar ICMS do Frete Empresa para Margem</span>
                                    </label>

                                    {load.hasIcms && (
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-gray-500 dark:text-gray-400">Alíquota:</label>
                                            <input
                                                name="icmsPercentage"
                                                value={load.icmsPercentage || ''}
                                                onChange={handleChange}
                                                type="number"
                                                placeholder="Ex: 12"
                                                className="p-1.5 w-24 border rounded dark:bg-gray-700 dark:border-gray-600 text-xs text-right font-medium"
                                                step="0.01"
                                            />
                                            <span className="text-xs text-gray-500 dark:text-gray-400">%</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-3 bg-gray-100 dark:bg-gray-700/70 rounded-lg">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Faturado Empresa</label>
                                    <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{(load.fixedCompanyFreight || 0).toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p>
                                </div>
                                <div className="p-3 bg-gray-100 dark:bg-gray-700/70 rounded-lg">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Pago Motorista</label>
                                    <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{(load.fixedDriverFreight || 0).toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p>
                                </div>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <label className="text-xs font-medium text-blue-600 dark:text-blue-400">Margem Líquida Estimada</label>
                                    <p className="text-lg font-bold text-primary dark:text-blue-300">{netMarginPercentage}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODE 3: VLR P/TON + ICMS */}
                    {load.freightPricingType === FreightPricingType.VlrTonIcms && (
                        <div className="space-y-4">
                            <div className="p-3.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                <span className="text-base">⚡</span>
                                <span><strong>VLR P/ton + ICMS:</strong> O valor faturado da empresa é a soma do Frete Base por tonelada multiplicado pelo peso carregado, <strong>acrescido do ICMS da viagem</strong> (Ex: R$ 100/ton x 32t = R$ 3.200 + R$ 800 ICMS = R$ 4.000,00 total empresa).</span>
                            </div>

                            <div className="p-4 border rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Frete Empresa Base (R$/ton) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={leg1.companyFreightValuePerTon || ''}
                                            onChange={(e) => handleLegChange(0, 'companyFreightValuePerTon', e.target.value)}
                                            type="number"
                                            placeholder="Ex: 100,00"
                                            className="p-2.5 w-full border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-semibold text-gray-800 dark:text-gray-100 text-sm"
                                            step="0.01"
                                            min="0"
                                        />
                                        <p className="text-[11px] text-gray-400 mt-1">Valor base contratado com a empresa por tonelada.</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Alíquota ICMS (%) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            name="icmsPercentage"
                                            value={load.icmsPercentage || ''}
                                            onChange={handleChange}
                                            type="number"
                                            placeholder="Ex: 12"
                                            className="p-2.5 w-full border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-semibold text-gray-800 dark:text-gray-100 text-sm"
                                            step="0.01"
                                            min="0"
                                        />
                                        <p className="text-[11px] text-gray-400 mt-1">Percentual de ICMS somado ao faturamento da empresa.</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Frete Motorista (R$/ton) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={leg1.driverFreightValuePerTon || ''}
                                            onChange={(e) => handleLegChange(0, 'driverFreightValuePerTon', e.target.value)}
                                            type="number"
                                            placeholder="Ex: 85,00"
                                            className="p-2.5 w-full border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-semibold text-gray-800 dark:text-gray-100 text-sm"
                                            step="0.01"
                                            min="0"
                                        />
                                        <p className="text-[11px] text-gray-400 mt-1">Valor pago ao motorista por tonelada transportada.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Live Simulation Card */}
                            {exampleSimulation && (
                                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                                            <span>📊</span> Simulação com Carreta Padrão ({exampleSimulation.weight} toneladas)
                                        </span>
                                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                                            Margem Líq: {netMarginPercentage}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                                        <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded-lg border dark:border-gray-700">
                                            <p className="text-gray-500 dark:text-gray-400 text-[11px]">Base Empresa</p>
                                            <p className="font-semibold text-gray-800 dark:text-gray-200">{exampleSimulation.base.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                                        </div>
                                        <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded-lg border dark:border-gray-700">
                                            <p className="text-gray-500 dark:text-gray-400 text-[11px]">(+) ICMS ({exampleSimulation.icmsPct.toFixed(1)}%)</p>
                                            <p className="font-semibold text-amber-600 dark:text-amber-400">+{exampleSimulation.icms.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                                        </div>
                                        <div className="bg-blue-100/70 dark:bg-blue-900/50 p-2 rounded-lg border border-blue-300 dark:border-blue-700">
                                            <p className="text-blue-800 dark:text-blue-300 text-[11px] font-bold">(=) Total Empresa</p>
                                            <p className="font-bold text-blue-900 dark:text-blue-100">{exampleSimulation.totalCompany.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                                        </div>
                                        <div className="bg-white/80 dark:bg-gray-800/80 p-2 rounded-lg border dark:border-gray-700">
                                            <p className="text-gray-500 dark:text-gray-400 text-[11px]">Frete Motorista</p>
                                            <p className="font-semibold text-gray-800 dark:text-gray-200">{exampleSimulation.driver.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Vendedor Externo Section */}
                <div className="border-t dark:border-gray-600 pt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Comissão de Vendedor Externo</h3>
                        {!showSalesperson && (
                            <button 
                                type="button" 
                                onClick={() => setShowSalesperson(true)}
                                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark dark:text-blue-400"
                            >
                                <UserPlusIcon className="h-4 w-4" />
                                <span>Adicionar Vendedor</span>
                            </button>
                        )}
                    </div>

                    {showSalesperson && (
                        <div className="p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-semibold text-gray-600 dark:text-gray-300">Dados do Vendedor</h4>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setShowSalesperson(false);
                                        setLoad(prev => ({ ...prev, salespersonName: '', salespersonCommissionPerTon: 0 }));
                                    }}
                                    className="text-xs text-red-500 hover:text-red-700"
                                >
                                    Remover
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nome do Vendedor</label>
                                    <input 
                                        name="salespersonName" 
                                        value={load.salespersonName || ''} 
                                        onChange={handleChange} 
                                        placeholder="Ex: João da Silva" 
                                        className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Comissão (R$/Ton)</label>
                                    <input 
                                        name="salespersonCommissionPerTon" 
                                        value={load.salespersonCommissionPerTon || ''} 
                                        onChange={handleChange} 
                                        type="number" 
                                        placeholder="Ex: 2,00" 
                                        className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" 
                                        step="0.01"
                                    />
                                </div>
                            </div>
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                                * A comissão será calculada automaticamente com base na tonelagem carregada nos embarques desta carga.
                            </p>
                        </div>
                    )}
                </div>
                 <div className="border-t dark:border-gray-600 pt-4">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Tipos de Veículos Permitidos</h3>
                    {/* New UI for allowed vehicle types */}
                    <div className="p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Conjunto</label>
                                <select value={currentSetType} onChange={(e) => setCurrentSetType(e.target.value as VehicleSetType)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">
                                    {Object.values(VehicleSetType).map(st => <option key={st} value={st}>{st}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Carrocerias</label>
                                <div className="flex gap-4 mt-2">
                                    {Object.values(VehicleBodyType).map(bt => (
                                        <label key={bt} className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={currentBodyTypes.includes(bt)} onChange={() => handleToggleBodyType(bt)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{bt}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button type="button" onClick={handleAddAllowedType} className="w-full py-2 bg-primary-dark text-white rounded-lg hover:bg-primary">Adicionar Regra</button>
                    </div>
                    {/* Display added types */}
                    {(load.allowedVehicleTypes && load.allowedVehicleTypes.length > 0) && (
                        <div className="mt-4 space-y-2">
                            {load.allowedVehicleTypes.map(avt => (
                                <div key={avt.setType} className="flex justify-between items-center p-2 bg-blue-100/50 dark:bg-blue-900/20 rounded-md">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                        <span className="font-bold">{avt.setType}:</span> {avt.bodyTypes.join(', ')}
                                    </p>
                                    <button type="button" onClick={() => handleRemoveAllowedType(avt.setType)} className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"><XIcon className="w-4 h-4"/></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {currentUser.profile === UserProfile.Admin && (
                    <div className="border-t dark:border-gray-600 pt-4">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Administração</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Comercial Responsável</label>
                            <select name="createdById" value={load.createdById} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">{commercialUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                        </div>
                    </div>
                )}
                <div className="border-t dark:border-gray-600 pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Produto</label>
                        <select name="productId" value={load.productId} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status da Carga</label>
                        <select name="status" value={load.status} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">{Object.values(CargoStatus).map(s => <option key={s} value={s}>{s}</option>)}</select>
                    </div>
                    <div className="col-span-1 md:col-span-2 flex items-center space-x-6"><label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" name="requiresScheduling" checked={load.requiresScheduling} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" /><span className="text-sm text-gray-700 dark:text-gray-300">Exige Agendamento</span></label><label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" name="requiresTracker" checked={load.requiresTracker || false} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" /><span className="text-sm text-gray-700 dark:text-gray-300">Precisa de Rastreador</span></label></div>
                </div>
            </div>
          )}
        </form>

        <div className="mt-8 flex justify-between items-center border-t dark:border-gray-700 pt-4">
            <div>
                {step > 1 && <button type="button" onClick={prevStep} disabled={isSubmitting} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50">Anterior</button>}
            </div>
            <div className="flex items-center space-x-4">
                <button type="button" onClick={onClose} disabled={isSubmitting} className="py-2 px-4 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">Cancelar</button>
                {step < STEPS.length && <button type="button" onClick={nextStep} disabled={isSubmitting} className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50">Próximo</button>}
                {step === STEPS.length && (
                  <button 
                    type="button" 
                    onClick={handleSubmit} 
                    disabled={isSubmitting}
                    className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? 'Salvando...' : 'Salvar Carga'}
                  </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoadFormModal;
