
import React, { useState, useEffect, useMemo } from 'react';
import type { Cargo, Driver, Shipment, Client, Vehicle, User } from '../types';
import { UserProfile, DailyScheduleType, VehicleSetType, VehicleBodyType, FreightPricingType, ShipmentStatus } from '../types';
import { supabase } from '../supabase';
import { useToast } from '../hooks/useToast';


interface NewShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shipmentData: any) => void;
  cargo: Cargo | null;
  drivers: Driver[];
  clients: Client[];
  vehicles: Vehicle[];
  currentUser: User | null;
  shipments: Shipment[];
  users: User[];
  offer?: any;
}

const NewShipmentModal: React.FC<NewShipmentModalProps> = ({ isOpen, onClose, onSave, cargo, drivers, clients, vehicles, currentUser, shipments, users, offer }) => {
  const [driverName, setDriverName] = useState('');
  const [driverCpf, setDriverCpf] = useState('');
  const [ownerContact, setOwnerContact] = useState('');
  const [horsePlate, setHorsePlate] = useState('');
  const [trailer1Plate, setTrailer1Plate] = useState('');
  const [trailer2Plate, setTrailer2Plate] = useState('');
  const [trailer3Plate, setTrailer3Plate] = useState('');
  const [shipmentTonnage, setShipmentTonnage] = useState<number>(0);
  const [driverContact, setDriverContact] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [embarcadorId, setEmbarcadorId] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleSetType, setVehicleSetType] = useState<VehicleSetType | ''>('');
  const [vehicleBodyType, setVehicleBodyType] = useState<VehicleBodyType | ''>('');
  const [bankDetails, setBankDetails] = useState('');
  const [vehicleTag, setVehicleTag] = useState('');
  const [filesToAttach, setFilesToAttach] = useState<File[]>([]);
  const [driverReferences, setDriverReferences] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  // Previne perda de dados por recarregamento acidental
  useEffect(() => {
    if (!isOpen) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOpen]);

  const activeScheduledVolume = useMemo(() => {
    if (!cargo) return 0;
    return shipments
      .filter(s => s.cargoId === cargo.id && s.status !== ShipmentStatus.Cancelado)
      .reduce((sum, s) => sum + (Number(s.shipmentTonnage) || 0), 0);
  }, [cargo, shipments]);

  const availableBalance = useMemo(() => {
    if (!cargo) return 0;
    return Math.max(0, (Number(cargo.totalVolume) || 0) - activeScheduledVolume);
  }, [cargo, activeScheduledVolume]);

  const handleScanDocument = async (files: File[]) => {
    if (files.length === 0) {
        showToast('Selecione um arquivo primeiro.', 'warning');
        return;
    }
    
    setIsScanning(true);
    try {
        for (const file of files) {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
                reader.onerror = () => reject(new Error('Falha ao processar o arquivo selecionado.'));
            });
            reader.readAsDataURL(file);
            const base64Image = await base64Promise;

            const { data, error } = await supabase.functions.invoke('process-document', {
                body: { image: base64Image, fileType: file.type }
            });

            if (error) throw error;

            if (data) {
                if (data.driverName) setDriverName(data.driverName);
                if (data.driverCpf) setDriverCpf(data.driverCpf);
                if (data.horsePlate) setHorsePlate(data.horsePlate.toUpperCase());
                if (data.trailerPlates && Array.isArray(data.trailerPlates)) {
                    if (data.trailerPlates[0]) setTrailer1Plate(data.trailerPlates[0].toUpperCase());
                    if (data.trailerPlates[1]) setTrailer2Plate(data.trailerPlates[1].toUpperCase());
                    if (data.trailerPlates[2]) setTrailer3Plate(data.trailerPlates[2].toUpperCase());
                }
                
                let refs = driverReferences;
                if (data.driverCnh) refs += `\nCNH: ${data.driverCnh}`;
                if (data.ownerName) refs += `\nProprietário: ${data.ownerName}`;
                if (data.ownerCpfCnpj) refs += `\nCPF/CNPJ Proprietário: ${data.ownerCpfCnpj}`;
                setDriverReferences(refs.trim());
            }
        }
        showToast('Digitalização concluída! Por favor, revise os campos preenchidos.', 'success');
    } catch (err: any) {
        console.error('Erro ao digitalizar:', err);
        showToast(`Erro na Digitalização: ${err.message || 'Ocorreu um erro ao processar o documento.'}\n\nCertifique-se de que a GEMINI_API_KEY está configurada no Supabase.`, 'error');
    } finally {
        setIsScanning(false);
    }
  };

  const embarcadores = useMemo(() => {
    return users.filter(u => 
      [UserProfile.Embarcador, UserProfile.Admin, UserProfile.Diretor, UserProfile.Comercial, UserProfile.Supervisor].includes(u.profile) &&
      u.active !== false
    );
  }, [users]);

  const prevIsOpen = React.useRef(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      const driverUser = users.find(u => u.id === offer?.driverId);
      const initialDriverName = offer?.driverName || driverUser?.name || '';
      setDriverName(initialDriverName);
      
      const driverInDb = initialDriverName 
        ? drivers.find(d => d.name.trim().toLowerCase() === initialDriverName.trim().toLowerCase())
        : undefined;

      let lastShipment;
      if (initialDriverName) {
         lastShipment = shipments
            .filter(s => s.driverName.trim().toLowerCase() === initialDriverName.trim().toLowerCase())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      }

      setDriverCpf(driverInDb?.cpf || lastShipment?.driverCpf || '');
      setOwnerContact(lastShipment?.ownerContact || '');
      setHorsePlate(lastShipment?.horsePlate || '');
      setTrailer1Plate(lastShipment?.trailer1Plate || '');
      setTrailer2Plate(lastShipment?.trailer2Plate || '');
      setTrailer3Plate(lastShipment?.trailer3Plate || '');
      setShipmentTonnage(0);
      setDriverContact(offer?.driverContact || lastShipment?.driverContact || '');
      setScheduledDate('');
      setScheduledTime('');
      setSelectedVehicle(null);
      setVehicleSetType(lastShipment?.vehicleSetType || '');
      setVehicleBodyType(lastShipment?.vehicleBodyType || '');
      setBankDetails(lastShipment?.bankDetails || '');
      setVehicleTag(lastShipment?.vehicleTag || '');
      setFilesToAttach([]);
      setDriverReferences(lastShipment?.driverReferences || '');
      setEmbarcadorId(
          currentUser?.id || (embarcadores.length > 0 ? embarcadores[0].id : '')
      );
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, currentUser, embarcadores]);

    // Driver selection & Autofill logic
  const [lastAlertedDriverId, setLastAlertedDriverId] = useState<string>('');
  const [lastAutofilledDriverId, setLastAutofilledDriverId] = useState<string>('');
  const [lastAutofilledPlate, setLastAutofilledPlate] = useState<string>('');

  useEffect(() => {
    const cleanName = driverName.trim().toLowerCase();
    const cleanCpf = driverCpf.replace(/\D/g, '');

    const driverByName = cleanName ? drivers.find(d => d.name.trim().toLowerCase() === cleanName) : undefined;
    const driverByCpf = cleanCpf.length === 11 ? drivers.find(d => d.cpf.replace(/\D/g, '') === cleanCpf) : undefined;

    const selectedDriver = driverByName || driverByCpf;

    if (selectedDriver) {
        // Sync Fields
        if (driverByName && selectedDriver.cpf && selectedDriver.cpf.replace(/\D/g, '') !== cleanCpf && !driverCpf) {
            setDriverCpf(selectedDriver.cpf);
        } else if (driverByCpf && selectedDriver.name.trim().toLowerCase() !== cleanName && !driverName) {
            setDriverName(selectedDriver.name);
        }

        setDriverContact(selectedDriver.phone || '');

        // Instant Restriction Alert
        if (!selectedDriver.active && lastAlertedDriverId !== selectedDriver.id) {
            showToast(`ATENÇÃO: Este motorista encontra-se RESTRITO! Motivo: ${selectedDriver.restrictionReason || 'Sem motivo especificado'}. O sistema impedirá a criação desta ordem.`, 'error', 10000);
            setLastAlertedDriverId(selectedDriver.id);
        } else if (selectedDriver.active) {
            setLastAlertedDriverId(''); 
        }

        // History Autofill
        if (lastAutofilledDriverId !== selectedDriver.id && selectedDriver.active) {
            const selectedCleanCpf = selectedDriver.cpf ? selectedDriver.cpf.replace(/\D/g, '') : '';
            const lastShipment = shipments
                .filter(s => 
                    (s.driverCpf && s.driverCpf.replace(/\D/g, '') === selectedCleanCpf) || 
                    (s.driverName.trim().toLowerCase() === selectedDriver.name.trim().toLowerCase())
                )
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

            if (lastShipment) {
                setHorsePlate(lastShipment.horsePlate || '');
                setTrailer1Plate(lastShipment.trailer1Plate || '');
                setTrailer2Plate(lastShipment.trailer2Plate || '');
                setTrailer3Plate(lastShipment.trailer3Plate || '');
                setOwnerContact(lastShipment.ownerContact || '');
                setBankDetails(lastShipment.bankDetails || '');
                setVehicleTag(lastShipment.vehicleTag || '');
            }
            setLastAutofilledDriverId(selectedDriver.id);
        } else if (!selectedDriver.active) {
            setLastAutofilledDriverId(selectedDriver.id); // Prevent repeated alerts/lookups if restricted
        }
    } else {
        setLastAutofilledDriverId('');
        setLastAlertedDriverId('');
    }
  }, [driverName, driverCpf, drivers, shipments, lastAlertedDriverId, lastAutofilledDriverId]);
  
  useEffect(() => {
    const cleanPlate = horsePlate.trim().toLowerCase();
    const vehicle = vehicles.find(v => v.plate.trim().toLowerCase() === cleanPlate);
    setSelectedVehicle(vehicle || null);
    
    if (vehicle) {
        setVehicleSetType(vehicle.setType);
        setVehicleBodyType(vehicle.bodyType);
    } else {
        setVehicleSetType('');
        setVehicleBodyType('');
    }

    if (cleanPlate && cleanPlate.length >= 7 && lastAutofilledPlate !== cleanPlate) {
        const lastShipmentByPlate = shipments
            .filter(s => s.horsePlate && s.horsePlate.trim().toLowerCase() === cleanPlate)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        if (lastShipmentByPlate) {
            setTrailer1Plate(lastShipmentByPlate.trailer1Plate || '');
            setTrailer2Plate(lastShipmentByPlate.trailer2Plate || '');
            setTrailer3Plate(lastShipmentByPlate.trailer3Plate || '');
        }
        setLastAutofilledPlate(cleanPlate);
    } else if (!cleanPlate) {
        setLastAutofilledPlate('');
    }
  }, [horsePlate, vehicles, shipments, lastAutofilledPlate]);


  const calculatedFreight = useMemo(() => {
    if (!cargo) return 0;
    if (cargo.freightPricingType === FreightPricingType.FreteFechado) {
      return cargo.fixedDriverFreight || cargo.driverFreightValuePerTon || 0;
    }
    if (shipmentTonnage <= 0) return 0;
    return (cargo?.driverFreightValuePerTon || 0) * shipmentTonnage;
  }, [cargo, shipmentTonnage]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargo) {
      showToast('Esta carga não existe mais no sistema ou foi removida. Não é possível criar o embarque.', 'error');
      return;
    }

    // Check for Restricted Driver
    const selectedDriverObj = drivers.find(d => 
        (d.name.trim().toLowerCase() === driverName.trim().toLowerCase() && driverName.trim() !== '') || 
        (d.cpf.replace(/\D/g, '') === driverCpf.replace(/\D/g, '') && driverCpf.trim() !== '')
    );

    if (selectedDriverObj && !selectedDriverObj.active) {
        showToast(`Motorista com Restrição: ${selectedDriverObj.restrictionReason || 'Sem motivo especificado'}. Não é permitido criar ordens para este motorista.`, 'error');
        return;
    }

    if (!driverName || !horsePlate || shipmentTonnage <= 0 || !scheduledDate || !embarcadorId || !scheduledTime) {
        showToast('Por favor, preencha todos os campos obrigatórios do formulário.', 'warning');
        return;
    }
    
    const isNewDriver = !drivers.find(d => d.name.trim().toLowerCase() === driverName.trim().toLowerCase());
    if (isNewDriver && !driverCpf) {
        showToast('Para novos motoristas, o CPF é obrigatório.', 'warning');
        return;
    }
    
    let vehicleInfo: { setType?: VehicleSetType | '', bodyType?: VehicleBodyType | '' };

    if (selectedVehicle) {
        vehicleInfo = selectedVehicle;
    } else {
        if (!vehicleSetType || !vehicleBodyType) {
            showToast('Para novos veículos, o Tipo de Veículo e Carroceria são obrigatórios.', 'warning');
            return;
        }
        vehicleInfo = { setType: vehicleSetType, bodyType: vehicleBodyType };
    }

    if (cargo?.allowedVehicleTypes && cargo.allowedVehicleTypes.length > 0 && vehicleInfo.setType && vehicleInfo.bodyType) {
        const isAllowed = cargo.allowedVehicleTypes.some(allowed => 
            allowed.setType === vehicleInfo.setType && allowed.bodyTypes.includes(vehicleInfo.bodyType as VehicleBodyType)
        );
        if (!isAllowed) {
            showToast(`O tipo do veículo selecionado (${vehicleInfo.setType} - ${vehicleInfo.bodyType}) não é permitido para esta carga.`, 'error');
            return;
        }
    }

    if (cargo?.dailySchedule) {
        const scheduleRule = cargo.dailySchedule.find(rule => rule.date === scheduledDate);
        if (!scheduleRule) {
            showToast('Não é permitido criar ordens para datas sem programação lançada na carga. Verifique a Data Programada.', 'error');
            return;
        }

        if (scheduleRule.type === DailyScheduleType.Verificar) {
            showToast('Atenção: A programação para este dia exige verificação com o comercial antes de marcar.', 'warning');
        } else if (scheduleRule.type === DailyScheduleType.Fixo && scheduleRule.tonnage) {
            const alreadyScheduledTonnage = shipments
                .filter(s => s.cargoId === cargo.id && s.scheduledDate === scheduledDate)
                .reduce((sum, s) => sum + s.shipmentTonnage, 0);
            
            if (alreadyScheduledTonnage + shipmentTonnage > scheduleRule.tonnage) {
                showToast(`Erro: A tonelagem para este dia excede o limite programado de ${scheduleRule.tonnage} ton. Já existem ${alreadyScheduledTonnage} ton programadas.`, 'error');
                return;
            }
        }
    }

    // Validation: Only allow future date/time
    const now = new Date();
    const inputDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (inputDateTime <= now) {
        showToast('Data/Hora Inválida: A data e hora programada deve ser posterior ao momento atual.', 'warning');
        return;
    }

    // Hard Validation: Volume and Balance Check
    if (!shipmentTonnage || shipmentTonnage <= 0) {
        showToast('Informe uma tonelagem válida maior que zero para o embarque.', 'warning');
        return;
    }

    if (shipmentTonnage > (availableBalance + 0.001)) { // Small epsilon for float comparison
        showToast(`SALDO INSUFICIENTE: Esta carga possui apenas ${availableBalance.toLocaleString('pt-BR')} ton disponíveis. Você está tentando solicitar ${shipmentTonnage.toLocaleString('pt-BR')} ton.`, 'error');
        return;
    }


    setIsSubmitting(true);
    try {
      onSave({
        cargoId: cargo.id,
        driverName,
        driverCpf,
        driverContact,
        ownerContact: ownerContact || undefined,
        horsePlate,
        trailer1Plate,
        trailer2Plate,
        trailer3Plate,
        shipmentTonnage,
        driverFreightValue: calculatedFreight,
        embarcadorId: embarcadorId,
        scheduledDate,
        scheduledTime,
        vehicleSetType: vehicleSetType || undefined,
        vehicleBodyType: vehicleBodyType || undefined,
        bankDetails: bankDetails || undefined,
        vehicleTag: vehicleTag || undefined,
        filesToAttach: filesToAttach.length > 0 ? filesToAttach : undefined,
        driverReferences: driverReferences || undefined,
      });
    } catch (err) {
      console.error('Erro ao salvar solicitação de embarque:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (!cargo) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 overscroll-contain modal-container">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">Carga Não Encontrada</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                A carga vinculada a esta solicitação foi removida do sistema ou não está mais disponível. Não é possível criar o embarque.
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const clientName = clients.find(c => c.id === cargo.clientId)?.nomeFantasia || 'Cliente não encontrado';
  const isExistingDriver = !!drivers.find(d => d.name.trim().toLowerCase() === driverName.trim().toLowerCase() && driverName.trim() !== '');
  const isTonnageExceeded = shipmentTonnage > (availableBalance + 0.001);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 overscroll-contain modal-container">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-gray-100 dark:border-gray-700 overscroll-contain">
        <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">Solicitação de Embarque</h2>
        <div className="mb-6 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Cliente: <span className="font-semibold text-gray-800 dark:text-gray-200">{clientName}</span></p>
            <p className="text-sm text-gray-600 dark:text-gray-400 col-span-2">Rota: <span className="font-semibold text-gray-800 dark:text-gray-200">{cargo.origin} → {cargo.destination}</span></p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total da Carga: <span className="font-semibold text-gray-800 dark:text-gray-200">{(cargo.totalVolume || 0).toLocaleString('pt-BR')} ton</span></p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Comprometido: <span className="font-semibold text-amber-600 dark:text-amber-400">{activeScheduledVolume.toLocaleString('pt-BR')} ton</span></p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Saldo Disponível: <span className="font-bold text-emerald-600 dark:text-emerald-400">{availableBalance.toLocaleString('pt-BR')} ton</span></p>
          </div>
          {cargo.allowedVehicleTypes && cargo.allowedVehicleTypes.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 border-t pt-2 dark:border-gray-600">
                Veículos Permitidos: <span className="font-semibold text-gray-800 dark:text-gray-200">{cargo.allowedVehicleTypes.map(vt => `${vt.setType} (${vt.bodyTypes.join('/')})`).join(', ')}</span>
              </p>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data Programada</label>
                  <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Horário Previsto</label>
                  <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Responsável / Solicitante</label>
                <select
                    value={embarcadorId}
                    onChange={(e) => setEmbarcadorId(e.target.value)}
                    className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
                    required
                >
                    <option value="" disabled>Selecione um responsável...</option>
                    {embarcadores.map(e => <option key={e.id} value={e.id}>{e.name} ({e.profile})</option>)}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">CPF do Motorista</label>
                <input type="text" value={driverCpf} onChange={(e) => setDriverCpf(e.target.value)} placeholder="Digite o CPF do motorista" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contato (WhatsApp)</label>
                  <input type="text" value={driverContact} onChange={(e) => setDriverContact(e.target.value)} placeholder="Contato (auto-preenchido)" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" disabled={isExistingDriver} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Motorista</label>
                  <input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Digite o nome do motorista" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required list="driver-names" />
                  <datalist id="driver-names">{drivers.map(d => <option key={d.id} value={d.name} />)}</datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contato do Proprietário</label>
                <input type="text" value={ownerContact} onChange={(e) => setOwnerContact(e.target.value)} placeholder="Telefone/WhatsApp do proprietário" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" />
              </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Placa Cavalo</label>
                <input value={horsePlate} onChange={(e) => setHorsePlate(e.target.value.toUpperCase())} placeholder="AAA-1234" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required list="vehicle-plates" />
                <datalist id="vehicle-plates">{vehicles.map(v => <option key={v.id} value={v.plate} />)}</datalist>
            </div>
          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Veículo</label>
                    <select value={vehicleSetType} onChange={(e) => setVehicleSetType(e.target.value as VehicleSetType)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required={!selectedVehicle} disabled={!!selectedVehicle}>
                        <option value="" disabled>Selecione...</option>
                        {Object.values(VehicleSetType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Carroceria</label>
                    <select value={vehicleBodyType} onChange={(e) => setVehicleBodyType(e.target.value as VehicleBodyType)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required={!selectedVehicle} disabled={!!selectedVehicle}>
                        <option value="" disabled>Selecione...</option>
                        {Object.values(VehicleBodyType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Placa Carreta 1</label><input type="text" value={trailer1Plate} onChange={(e) => setTrailer1Plate(e.target.value.toUpperCase())} placeholder="Obrigatório" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Placa Carreta 2</label><input type="text" value={trailer2Plate} onChange={(e) => setTrailer2Plate(e.target.value.toUpperCase())} placeholder="Opcional" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Placa Carreta 3</label><input type="text" value={trailer3Plate} onChange={(e) => setTrailer3Plate(e.target.value.toUpperCase())} placeholder="Opcional" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dados Bancários</label>
                  <textarea 
                    value={bankDetails} 
                    onChange={(e) => setBankDetails(e.target.value)} 
                    placeholder="Banco, Agência, Conta, PIX, etc." 
                    className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 resize-y" 
                    rows={2} 
                    required
                  />
              </div>
              
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Anexar Documentos</label>
                  <div className="mt-1 flex items-center h-full">
                      <label className="cursor-pointer bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-lg inline-flex items-center transition-colors">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                          Anexar
                          <input type="file" multiple className="hidden" onChange={(e) => {
                              if (e.target.files) {
                                  setFilesToAttach(Array.from(e.target.files));
                              }
                          }} />
                      </label>
                      <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
                          {filesToAttach.length > 0 ? `${filesToAttach.length} arquivo(s) selecionado(s)` : 'Nenhum'}
                      </span>
                      {filesToAttach.length > 0 && (
                          <button
                              type="button"
                              onClick={() => handleScanDocument(filesToAttach)}
                              disabled={isScanning}
                              className={`ml-4 text-xs font-bold uppercase py-1 px-3 rounded border transition-all ${
                                  isScanning 
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                                  : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white'
                              }`}
                          >
                              {isScanning ? (
                                  <span className="flex items-center">
                                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                      Processando...
                                  </span>
                              ) : 'Digitalizar com IA'}
                          </button>
                      )}
                  </div>
              </div>
            </div>
          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Toneladas do Embarque</label>
                    {availableBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setShipmentTonnage(availableBalance)}
                        className="text-xs text-primary dark:text-blue-400 hover:underline font-medium"
                      >
                        Usar saldo restante ({availableBalance.toLocaleString('pt-BR')} ton)
                      </button>
                    )}
                  </div>
                  <input 
                    type="number" 
                    value={shipmentTonnage || ''} 
                    onChange={(e) => setShipmentTonnage(parseFloat(e.target.value) || 0)} 
                    placeholder={`Máx: ${availableBalance.toLocaleString('pt-BR')} ton`} 
                    className={`mt-1 p-2 w-full border rounded dark:bg-gray-700 transition-colors ${
                      isTonnageExceeded 
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200 focus:ring-red-500' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`} 
                    step="0.01" 
                    max={availableBalance}
                    required 
                  />
                  {isTonnageExceeded && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-semibold">
                      ⚠️ Tonelagem excede o saldo disponível de {availableBalance.toLocaleString('pt-BR')} ton.
                    </p>
                  )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tag do Veículo</label>
                    <input type="text" value={vehicleTag} onChange={(e) => setVehicleTag(e.target.value)} placeholder="Obrigatório" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-900/50 rounded-lg text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Valor do Frete (Motorista)</p>
                <div className="flex flex-col items-center">
                    {cargo?.freightPricingType === FreightPricingType.FreteFechado ? (
                      <>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">
                            {formatCurrency(cargo.fixedDriverFreight || cargo.driverFreightValuePerTon || 0)}
                        </p>
                        <span className="text-xs font-semibold px-2 py-0.5 mt-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                          🔒 Frete Fechado (Fixo por Viagem)
                        </span>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">
                            {formatCurrency(cargo?.driverFreightValuePerTon || 0)} <span className="text-sm font-normal text-gray-500">/ TON</span>
                        </p>
                        {shipmentTonnage > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Total Estimado: {formatCurrency(calculatedFreight)}
                          </span>
                        )}
                      </>
                    )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Referências do Motorista</label>
                <textarea
                  value={driverReferences}
                  onChange={(e) => setDriverReferences(e.target.value)}
                  placeholder="Indicações, referências ou observações sobre o motorista..."
                  className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 resize-y"
                  rows={3}
                  required
                />
              </div>
            </div>
          
            <div className="mt-8 flex justify-end space-x-4">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={isSubmitting} className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2">
                {isSubmitting ? 'Solicitando...' : 'Solicitar Embarque'}
              </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default NewShipmentModal;
