
import React, { useMemo } from 'react';
import type { Cargo, Client, Product, User, FreightLeg, Shipment } from '../types';
import { UserProfile, ShipmentStatus, FreightPricingType } from '../types';
import VolumeBar from './VolumeBar';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { StayRecord } from '../utils/toolStorage';
import { parseLocation } from '../utils/locationUtils';
import { getShipmentAttachmentUrl } from '../lib/db';

interface CargoDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cargo: Cargo | null;
  client: Client | undefined;
  product: Product | undefined;
  commercialUser: User | undefined;
  stays?: StayRecord[];
  shipments?: Shipment[];
  currentUser?: User;
}

const DetailItem: React.FC<{ label: string; value?: string | number | null; children?: React.ReactNode }> = ({ label, value, children }) => (
    <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {children || <p className="text-sm text-gray-800 dark:text-gray-200">{value ?? 'N/A'}</p>}
    </div>
);

const FreightLegDetail: React.FC<{ leg: FreightLeg; index: number; hideSensitiveData?: boolean; hideCompanyFreight?: boolean; isMotorista?: boolean }> = ({ leg, index, hideSensitiveData, hideCompanyFreight, isMotorista }) => (
    <div className="p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold text-gray-600 dark:text-gray-300">Perna {index + 1}</h4>
            {!hideCompanyFreight && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${leg.hasIcms ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'}`}>
                    ICMS: {leg.hasIcms ? `Sim (${leg.icmsPercentage}%)` : 'Não'}
                </span>
            )}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
            {!hideCompanyFreight && (
                <div>
                    <p className="text-xs text-gray-500">Frete Empresa</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(leg.companyFreightValuePerTon)}</p>
                </div>
            )}
            {!hideSensitiveData && (
                <div>
                    <p className="text-xs text-gray-500">{isMotorista ? 'Valor do Frete' : 'Frete Motorista'}</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(leg.driverFreightValuePerTon)}</p>
                </div>
            )}
        </div>
    </div>
);


const CargoDetailsModal: React.FC<CargoDetailsModalProps> = ({ isOpen, onClose, cargo, client, product, commercialUser, stays = [], shipments = [], currentUser }) => {
  if (!isOpen || !cargo) return null;
  const isClient = currentUser?.profile === UserProfile.Cliente;
  const isEmbarcador = currentUser?.profile === UserProfile.Embarcador;
  const isMotorista = currentUser?.profile === UserProfile.Motorista;

  const activeShipments = useMemo(() => {
    return shipments.filter(s => s.cargoId === cargo.id && s.status !== ShipmentStatus.Cancelado);
  }, [shipments, cargo.id]);

  const effectiveScheduledVolume = useMemo(() => {
    return activeShipments.reduce((sum, s) => sum + (Number(s.shipmentTonnage) || 0), 0);
  }, [activeShipments]);

  const effectiveLoadedVolume = useMemo(() => {
    return activeShipments
      .filter(s => Object.values(ShipmentStatus).indexOf(s.status) >= Object.values(ShipmentStatus).indexOf(ShipmentStatus.AguardandoDescarga))
      .reduce((sum, s) => sum + (Number(s.shipmentTonnage) || 0), 0);
  }, [activeShipments]);

  const scheduledButNotLoaded = Math.max(0, effectiveScheduledVolume - effectiveLoadedVolume);
  const availableBalance = Math.max(0, (Number(cargo.totalVolume) || 0) - effectiveScheduledVolume);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('pt-BR');

  const freightLegsToDisplay = (cargo.freightLegs && cargo.freightLegs.length > 0)
    ? cargo.freightLegs
    : [{
        companyFreightValuePerTon: cargo.companyFreightValuePerTon,
        driverFreightValuePerTon: cargo.driverFreightValuePerTon,
        hasIcms: cargo.hasIcms,
        icmsPercentage: cargo.icmsPercentage,
      }];
      
  const { totalCompanyFreight, totalDriverFreight, netMarginPercentage } = useMemo(() => {
    const pricingType = cargo.freightPricingType || freightLegsToDisplay[0]?.pricingType || FreightPricingType.PorTonelada;
    const activeLegs = freightLegsToDisplay;
    const totalCommission = cargo.salespersonCommissionPerTon || 0;

    if (pricingType === FreightPricingType.FreteFechado) {
      const compFixed = Number(cargo.fixedCompanyFreight) || Number(cargo.companyFreightValuePerTon) || 0;
      const drivFixed = Number(cargo.fixedDriverFreight) || Number(cargo.driverFreightValuePerTon) || 0;
      const icmsPct = cargo.hasIcms ? (Number(cargo.icmsPercentage) || 0) / 100 : 0;
      const netCompany = compFixed * (1 - icmsPct);
      const netProfit = netCompany - drivFixed;
      const margin = netCompany > 0 ? (netProfit / netCompany) * 100 : 0;

      const netMarginPercentage = isNaN(margin) || !isFinite(margin)
        ? '0,00%'
        : `${margin.toFixed(2).replace('.', ',')}%`;

      return { totalCompanyFreight: compFixed, totalDriverFreight: drivFixed, netMarginPercentage };
    }

    if (pricingType === FreightPricingType.VlrTonIcms) {
      const baseCompanyPerTon = activeLegs[0]?.companyFreightValuePerTon || 0;
      const driverPerTon = activeLegs[0]?.driverFreightValuePerTon || 0;
      const netProfit = baseCompanyPerTon - driverPerTon - totalCommission;
      const margin = baseCompanyPerTon > 0 ? (netProfit / baseCompanyPerTon) * 100 : 0;

      const netMarginPercentage = isNaN(margin) || !isFinite(margin)
        ? '0,00%'
        : `${margin.toFixed(2).replace('.', ',')}%`;

      return { totalCompanyFreight: baseCompanyPerTon, totalDriverFreight: driverPerTon, netMarginPercentage };
    }

    // Default: Por Tonelada
    const totalCompanyFreight = activeLegs.reduce((sum, leg) => sum + leg.companyFreightValuePerTon, 0);
    const totalDriverFreight = activeLegs.reduce((sum, leg) => sum + leg.driverFreightValuePerTon, 0);
    
    const totalNetCompanyValue = activeLegs.reduce((sum, leg) => {
        const icmsRate = leg.hasIcms ? leg.icmsPercentage / 100 : 0;
        const netValue = leg.companyFreightValuePerTon * (1 - icmsRate);
        return sum + netValue;
    }, 0);
    
    // Average demurrage
    const loadShipments = shipments.filter(s => s.cargoId === cargo.id && s.status !== ShipmentStatus.Cancelado);
    const loadShipmentIds = new Set(loadShipments.map(s => s.id));
    const totalDemurrageProfit = stays
        .filter(s => s.shipmentId && loadShipmentIds.has(s.shipmentId))
        .reduce((sum, s) => sum + ((s.approvedValue || 0) - (s.driverPaidValue || 0)), 0);
    const totalDemurrageRevenue = stays
        .filter(s => s.shipmentId && loadShipmentIds.has(s.shipmentId))
        .reduce((sum, s) => sum + (s.approvedValue || 0), 0);
        
    const loadedTonnage = loadShipments.reduce((sum, s) => sum + (s.shipmentTonnage || 1), 0);
    const demurrageProfitPerTon = loadedTonnage > 0 ? (totalDemurrageProfit / loadedTonnage) : 0;
    const demurrageRevenuePerTon = loadedTonnage > 0 ? (totalDemurrageRevenue / loadedTonnage) : 0;

    const netProfit = totalNetCompanyValue - totalDriverFreight - totalCommission + demurrageProfitPerTon;
    const totalCompanyFreightWithEstadias = totalNetCompanyValue + demurrageRevenuePerTon;

    const margin = (totalCompanyFreightWithEstadias > 0) ? (netProfit / totalCompanyFreightWithEstadias) * 100 : 0;
    
    const netMarginPercentage = isNaN(margin) || !isFinite(margin)
        ? '0,00%'
        : `${margin.toFixed(2).replace('.', ',')}%`;

    return { totalCompanyFreight, totalDriverFreight, netMarginPercentage };
  }, [freightLegsToDisplay, cargo.freightPricingType, cargo.fixedCompanyFreight, cargo.fixedDriverFreight, cargo.hasIcms, cargo.icmsPercentage, cargo.salespersonCommissionPerTon, stays, shipments, cargo.id]);


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Detalhes da Carga: {cargo.sequenceId}</h2>
                <p className="text-xs text-gray-400 font-mono">{cargo.id}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">&times;</button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <DetailItem label="Cliente Tomador" value={client?.nomeFantasia} />
                {cargo.recipientClient ? (
                  <DetailItem label="Cliente Destinatário" value={cargo.recipientClient} />
                ) : (
                  <DetailItem label="Produto" value={product?.name} />
                )}
                {cargo.recipientClient && <DetailItem label="Produto" value={product?.name} />}
                <DetailItem label="Origem" value={cargo.origin} />
                <DetailItem label="Destino" value={cargo.destination} />
                {cargo.originLocation && <DetailItem label="Local de Coleta" value={cargo.originLocation} />}
                {cargo.destinationLocation && <DetailItem label="Local de Entrega" value={cargo.destinationLocation} />}
                {cargo.originMapLink && (
                  <DetailItem label="Link Mapa (Origem)">
                    <a 
                      href={parseLocation(cargo.originMapLink).href || cargo.originMapLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      📍 Abrir no Mapa
                    </a>
                  </DetailItem>
                )}
                {cargo.destinationMapLink && (
                  <DetailItem label="Link Mapa (Destino)">
                    <a 
                      href={parseLocation(cargo.destinationMapLink).href || cargo.destinationMapLink} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      📍 Abrir no Mapa
                    </a>
                  </DetailItem>
                )}
            </div>

            {!isMotorista && (
              <div className="border-t dark:border-gray-700 pt-4">
                   <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Balanço de Volume (ton)</h3>
                   <VolumeBar
                      loaded={effectiveLoadedVolume}
                      scheduled={scheduledButNotLoaded}
                      total={cargo.totalVolume}
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-center">
                      <div className="p-2 bg-green-100/50 dark:bg-green-900/20 rounded">
                          <p className="text-xs text-green-700 dark:text-green-300">Carregado</p>
                          <p className="font-bold text-green-800 dark:text-green-200">{effectiveLoadedVolume.toLocaleString('pt-BR')}</p>
                      </div>
                       <div className="p-2 bg-orange-100/50 dark:bg-orange-900/20 rounded">
                          <p className="text-xs text-orange-700 dark:text-orange-300">Agendado</p>
                          <p className="font-bold text-orange-800 dark:text-orange-200">{scheduledButNotLoaded.toLocaleString('pt-BR')}</p>
                      </div>
                       <div className="p-2 bg-emerald-100/50 dark:bg-emerald-900/20 rounded border border-emerald-300/40">
                          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">Disponível</p>
                          <p className="font-bold text-emerald-800 dark:text-emerald-200">{availableBalance.toLocaleString('pt-BR')}</p>
                      </div>
                       <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                          <p className="text-xs text-gray-500">Total</p>
                          <p className="font-bold text-gray-800 dark:text-gray-200">{(cargo.totalVolume || 0).toLocaleString('pt-BR')}</p>
                      </div>
                  </div>
              </div>
            )}

            <div className="border-t dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Valores de Frete</h3>
                    {cargo.freightPricingType === FreightPricingType.FreteFechado && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            🔒 Frete Fechado (Fixo R$)
                        </span>
                    )}
                    {cargo.freightPricingType === FreightPricingType.VlrTonIcms && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                            ⚡ VLR P/ton + ICMS
                        </span>
                    )}
                    {(!cargo.freightPricingType || cargo.freightPricingType === FreightPricingType.PorTonelada) && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            📦 Por Tonelada
                        </span>
                    )}
                </div>

                {cargo.freightPricingType === FreightPricingType.FreteFechado ? (
                    <div className="p-4 border rounded-md dark:border-gray-700 bg-amber-50/50 dark:bg-gray-900/50 space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            {!isMotorista && !isEmbarcador && (
                                <div>
                                    <p className="text-xs text-gray-500">Frete Empresa (Fixo Viagem)</p>
                                    <p className="text-base font-bold text-gray-800 dark:text-gray-200">{formatCurrency(cargo.fixedCompanyFreight || cargo.companyFreightValuePerTon)}</p>
                                </div>
                            )}
                            {!isClient && (
                                <div>
                                    <p className="text-xs text-gray-500">{isMotorista ? 'Valor do Frete (Fixo Viagem)' : 'Frete Motorista (Fixo Viagem)'}</p>
                                    <p className="text-base font-bold text-gray-800 dark:text-gray-200">{formatCurrency(cargo.fixedDriverFreight || cargo.driverFreightValuePerTon)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : cargo.freightPricingType === FreightPricingType.VlrTonIcms ? (
                    <div className="p-4 border rounded-md dark:border-gray-700 bg-blue-50/50 dark:bg-gray-900/50 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            {!isMotorista && !isEmbarcador && (
                                <div>
                                    <p className="text-xs text-gray-500">Frete Empresa Base</p>
                                    <p className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(freightLegsToDisplay[0]?.companyFreightValuePerTon || 0)} / ton</p>
                                </div>
                            )}
                            {!isMotorista && !isEmbarcador && (
                                <div>
                                    <p className="text-xs text-gray-500">ICMS Adicionado</p>
                                    <p className="font-bold text-amber-700 dark:text-amber-400">
                                        +{cargo.icmsPercentage || 0}%
                                    </p>
                                </div>
                            )}
                            {!isClient && (
                                <div>
                                    <p className="text-xs text-gray-500">{isMotorista ? 'Valor do Frete' : 'Frete Motorista'}</p>
                                    <p className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(freightLegsToDisplay[0]?.driverFreightValuePerTon || 0)} / ton</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {freightLegsToDisplay.map((leg, index) => (
                            <FreightLegDetail 
                                key={index} 
                                leg={leg} 
                                index={index} 
                                hideSensitiveData={isClient} 
                                hideCompanyFreight={isMotorista || isEmbarcador}
                                isMotorista={isMotorista || isEmbarcador} 
                            />
                        ))}
                    </div>
                )}

                 <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {isMotorista || isEmbarcador ? (
                        <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md col-span-1 md:col-span-3">
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                {isEmbarcador ? 'Frete Motorista (Final)' : 'Valor do Frete (Final)'}
                            </label>
                            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                                {formatCurrency(totalDriverFreight)} {cargo.freightPricingType === FreightPricingType.FreteFechado ? '(Fixo)' : '/ ton'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Frete Empresa (Final)</label>
                                <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                                    {formatCurrency(totalCompanyFreight)} {cargo.freightPricingType === FreightPricingType.FreteFechado ? '(Fixo)' : (cargo.freightPricingType === FreightPricingType.VlrTonIcms ? '/ ton + ICMS' : '/ ton')}
                                </p>
                            </div>
                            {!isClient && (
                                <>
                                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Frete Motorista (Final)</label>
                                        <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                                            {formatCurrency(totalDriverFreight)} {cargo.freightPricingType === FreightPricingType.FreteFechado ? '(Fixo)' : '/ ton'}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/50 rounded-md border border-blue-200 dark:border-blue-800">
                                        <label className="text-xs font-medium text-blue-500 dark:text-blue-400">Margem Líquida (%)</label>
                                        <p className="text-lg font-bold text-primary dark:text-blue-300">{netMarginPercentage}</p>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t dark:border-gray-700 pt-4">
                <DetailItem label="Exige Agendamento" value={cargo.requiresScheduling ? 'Sim' : 'Não'} />
                <DetailItem label="Precisa de Rastreador" value={cargo.requiresTracker ? 'Sim' : 'Não'} />
                <DetailItem label="Tipo de Carga" value={cargo.type} />
                <DetailItem label="Status da Carga" value={cargo.status} />
                <DetailItem label="Prazo de Carregamento" value={cargo.loadingDeadline ? new Date(cargo.loadingDeadline).toLocaleDateString('pt-BR') : 'N/A'} />
                <DetailItem label="Comercial Responsável" value={commercialUser?.name} />
                <DetailItem label="Data de Criação" value={formatDate(cargo.createdAt)} />
            </div>

            {cargo.observations && (
                <div className="border-t dark:border-gray-700 pt-4">
                    <DetailItem label="Observações">
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">{cargo.observations}</p>
                    </DetailItem>
                </div>
            )}

            {cargo.attachments && cargo.attachments.length > 0 && (
                <div className="border-t dark:border-gray-700 pt-4">
                    <DetailItem label="Anexos">
                        <ul className="mt-1 space-y-2">
                            {cargo.attachments.map((fileName, index) => {
                                const targetUrl = getShipmentAttachmentUrl(fileName);
                                const displayName = fileName.includes('?name=') 
                                    ? decodeURIComponent(fileName.split('?name=')[1]) 
                                    : (fileName.split('/').pop()?.split('?')[0] || fileName);
                                return (
                                <li key={index}>
                                    <a 
                                        href={targetUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                        title="Clique para visualizar o arquivo em nova janela"
                                    >
                                        <PaperclipIcon className="w-4 h-4 mr-2" />
                                        {displayName}
                                    </a>
                                </li>
                                );
                            })}
                        </ul>
                    </DetailItem>
                </div>
            )}

            {cargo.allowedVehicleTypes && cargo.allowedVehicleTypes.length > 0 && (
                <div className="border-t dark:border-gray-700 pt-4">
                    <DetailItem label="Tipos de Veículos Permitidos">
                        <div className="flex flex-wrap gap-2 mt-1">
                            {cargo.allowedVehicleTypes.map((vt, idx) => (
                                <span key={idx} className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                                    {vt.setType} ({vt.bodyTypes.join('/')})
                                </span>
                            ))}
                        </div>
                    </DetailItem>
                </div>
            )}




        </div>
        
        <div className="mt-6 flex justify-end border-t dark:border-gray-700 pt-4">
          <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CargoDetailsModal;
