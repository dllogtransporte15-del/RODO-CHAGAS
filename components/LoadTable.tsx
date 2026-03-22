
import React, { useState } from 'react';
import type { Cargo, Client, Product, Shipment } from '../types';
import { DailyScheduleType, CargoStatus } from '../types';
import VolumeBar from './VolumeBar';
import { PlusIcon } from './icons/PlusIcon';
import { HistoryIcon } from './icons/HistoryIcon';

interface LoadTableProps {
  loads: Cargo[];
  clients: Client[];
  products: Product[];
  shipments: Shipment[];
  dailyBalanceDate: string;
  onDailyBalanceDateChange: (date: string) => void;
  onCreateShipment?: (load: Cargo) => void;
  onSuspend?: (load: Cargo) => void;
  onReactivate?: (load: Cargo) => void;
  onFinalize?: (load: Cargo) => void;
  onEdit?: (load: Cargo) => void;
  onClose?: (load: Cargo) => void;
  onShowHistory?: (load: Cargo) => void;
  onShowDetails?: (load: Cargo) => void;
  onEditSchedule?: (load: Cargo) => void;
}

const LoadTable: React.FC<LoadTableProps> = ({ loads, clients, products, shipments, dailyBalanceDate, onDailyBalanceDateChange, onCreateShipment, onSuspend, onReactivate, onFinalize, onEdit, onClose, onShowHistory, onShowDetails, onEditSchedule }) => {
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  
  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.nomeFantasia || 'N/A';
  const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || 'N/A';
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  }

  const statusSymbols: { [key in DailyScheduleType]: string } = {
    [DailyScheduleType.Livre]: 'L',
    [DailyScheduleType.Fixo]: 'F',
    [DailyScheduleType.Verificar]: 'V',
  };

  const statusSymbolColors: { [key in DailyScheduleType]: string } = {
    [DailyScheduleType.Livre]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    [DailyScheduleType.Fixo]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    [DailyScheduleType.Verificar]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Balanço Diário para:</span>
          <input
            type="date"
            value={dailyBalanceDate}
            onChange={(e) => onDailyBalanceDateChange(e.target.value)}
            className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          {loads.length} cargas cadastradas
        </div>
      </div>

      <div className="space-y-3">
        {loads.map((load) => {
          const scheduledButNotLoaded = Math.max(0, load.scheduledVolume - load.loadedVolume);
          const dailyScheduledTonnage = shipments
            .filter(s => s.cargoId === load.id && s.scheduledDate === dailyBalanceDate)
            .reduce((sum, s) => sum + s.shipmentTonnage, 0);
          const dailyScheduleInfo = load.dailySchedule?.find(ds => ds.date === dailyBalanceDate);

          return (
            <div key={load.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/30 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center p-4 gap-4">
                {/* ID and Status */}
                <div className="flex items-center gap-3 min-w-[120px]">
                  <div className="flex flex-col">
                    <button 
                      onClick={() => onShowDetails?.(load)}
                      className="text-sm font-bold text-primary dark:text-blue-400 hover:underline text-left"
                    >
                      #{load.sequenceId}
                    </button>
                    <span className="text-[10px] text-gray-400 font-mono truncate w-20" title={load.id}>{load.id.substring(0, 8)}...</span>
                  </div>
                  <span className={`inline-flex items-center justify-center h-6 w-6 text-[11px] font-bold rounded-full shadow-sm ${
                    load.status === CargoStatus.Suspensa ? 'bg-yellow-100 text-yellow-800' :
                    load.status === CargoStatus.Fechada ? 'bg-gray-100 text-gray-800' :
                    dailyScheduleInfo ? statusSymbolColors[dailyScheduleInfo.type] : 'bg-gray-100 text-gray-400'
                  }`}>
                    {load.status === CargoStatus.Suspensa ? 'S' :
                     load.status === CargoStatus.Fechada ? 'F' :
                     dailyScheduleInfo ? statusSymbols[dailyScheduleInfo.type] : '-'}
                  </span>
                </div>

                {/* Client and Product */}
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{getClientName(load.clientId)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{getProductName(load.productId)}</div>
                </div>

                {/* Route */}
                <div className="hidden xl:flex items-center gap-2 min-w-[180px] text-xs">
                  <div className="text-right flex-1">
                    <div className="text-gray-400 text-[9px] uppercase font-bold">Origem</div>
                    <div className="font-medium text-gray-700 dark:text-gray-300 truncate">{load.origin}</div>
                  </div>
                  <div className="text-gray-300">→</div>
                  <div className="flex-1">
                    <div className="text-gray-400 text-[9px] uppercase font-bold">Destino</div>
                    <div className="font-medium text-gray-700 dark:text-gray-300 truncate">{load.destination}</div>
                  </div>
                </div>

                {/* Balanço Geral */}
                <div className="min-w-[180px] space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase">
                    <span>Geral</span>
                    <span className="text-gray-700 dark:text-gray-300">{formatNumber(load.loadedVolume)} / {formatNumber(load.totalVolume)}</span>
                  </div>
                  <VolumeBar
                    loaded={load.loadedVolume}
                    scheduled={scheduledButNotLoaded}
                    total={load.totalVolume}
                  />
                </div>

                {/* Balanço Diário */}
                <div className="min-w-[180px] space-y-1 bg-gray-50 dark:bg-gray-700/30 p-2 rounded-md border border-gray-100 dark:border-gray-600">
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase">
                    <span>Diário {dailyScheduleInfo?.type ? `(${dailyScheduleInfo.type})` : ''}</span>
                    <span className="text-blue-600 dark:text-blue-400">{formatNumber(dailyScheduledTonnage)} ton</span>
                  </div>
                  <VolumeBar
                    loaded={dailyScheduledTonnage}
                    total={dailyScheduleInfo?.type === DailyScheduleType.Fixo && dailyScheduleInfo.tonnage ? dailyScheduleInfo.tonnage : (dailyScheduledTonnage > 0 ? dailyScheduledTonnage : 1)}
                    scheduled={0}
                    loadedColor="bg-blue-500"
                  />
                </div>

                {/* Freight and Actions */}
                <div className="flex items-center justify-between lg:justify-end gap-4 min-w-[150px]">
                  <div className="text-right">
                    <div className="text-[9px] text-gray-400 uppercase font-bold">Frete</div>
                    <div className="text-sm font-bold text-primary dark:text-blue-400">{formatCurrency(load.driverFreightValuePerTon)}</div>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setOpenActionMenu(openActionMenu === load.id ? null : load.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors border border-gray-200 dark:border-gray-600"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                    
                    {openActionMenu === load.id && (
                      <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-xl bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-20 overflow-hidden border border-gray-100 dark:border-gray-700">
                        <div className="py-1">
                          {onShowHistory && (
                            <button onClick={() => { onShowHistory(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                              <HistoryIcon className="h-4 w-4" /> Histórico
                            </button>
                          )}
                          {onEdit && (
                            <button onClick={() => { onEdit(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Editar Carga
                            </button>
                          )}
                          {onEditSchedule && (
                            <button onClick={() => { onEditSchedule(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Editar Programação
                            </button>
                          )}
                          {onCreateShipment && load.status === CargoStatus.EmAndamento && (
                            <button onClick={() => { onCreateShipment(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-primary dark:text-blue-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
                              Novo Embarque
                            </button>
                          )}
                          {onSuspend && load.status === CargoStatus.EmAndamento && (
                            <button onClick={() => { onSuspend(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Suspender Carga
                            </button>
                          )}
                          {onReactivate && load.status === CargoStatus.Suspensa && (
                            <button onClick={() => { onReactivate(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Reativar Carga
                            </button>
                          )}
                          {onFinalize && (
                            <button onClick={() => { onFinalize(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Finalizar Carga
                            </button>
                          )}
                          {onClose && (
                            <button onClick={() => { onClose(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Fechar Carga
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LoadTable;
