
import React, { useState, useEffect, useRef } from 'react';
import type { Shipment, Cargo, User, Vehicle } from '../types';
import { ShipmentStatus, UserProfile } from '../types';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { DollarSignIcon } from './icons/DollarSignIcon';
import { XIcon } from './icons/XIcon';
import { HistoryIcon } from './icons/HistoryIcon';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { ExternalLinkIcon } from './icons/ExternalLinkIcon';
import { InfoIcon } from './icons/InfoIcon';
import { TransferIcon } from './icons/TransferIcon';
import { MoreVerticalIcon } from './icons/MoreVerticalIcon';

interface ShipmentTableProps {
  shipments: Shipment[];
  cargos: Cargo[];
  users: User[];
  vehicles: Vehicle[];
  onAttach?: (shipment: Shipment) => void;
  onEditPrice?: (shipment: Shipment) => void;
  onCancel?: (shipment: Shipment) => void;
  onTransfer?: (shipment: Shipment) => void;
  onShowHistory?: (shipment: Shipment) => void;
  onOpenCadastroAntt?: (shipment: Shipment) => void;
  onShowCargoDetails?: (cargo: Cargo) => void;
  onMarkArrival?: (shipmentId: string) => void;
  canUserAdvanceStatus?: (shipment: Shipment) => { allowed: boolean; reason: string };
  currentUser: User;
  activeStatus: ShipmentStatus;
}

const ShipmentTable: React.FC<ShipmentTableProps> = ({ shipments, cargos, users, vehicles, onAttach, onEditPrice, onCancel, onTransfer, onShowHistory, onShowCargoDetails, canUserAdvanceStatus, onMarkArrival, onOpenCadastroAntt, currentUser, activeStatus }) => {
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setOpenActionMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleActionMenu = (shipmentId: string) => {
    setOpenActionMenu(prev => (prev === shipmentId ? null : shipmentId));
  };

  const getCargoInfo = (cargoId: string): Cargo | null => {
    return cargos.find(c => c.id === cargoId) || null;
  };

  const getEmbarcadorName = (embarcadorId: string): string => {
    return users.find(u => u.id === embarcadorId)?.name || 'N/A';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };
  
  const formatDate = (timestamp: string | undefined) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatWhatsAppLink = (phone: string) => {
    if (!phone) return null;
    const cleanedPhone = phone.replace(/\D/g, '');
    if (cleanedPhone.length >= 10) { 
        return `https://wa.me/55${cleanedPhone}`;
    }
    return null;
  };
  
  const isClient = currentUser.profile === UserProfile.Cliente;
  const showActionsColumnForClient = isClient && activeStatus === ShipmentStatus.Finalizado;

  const ActionMenuItem: React.FC<{
    icon: React.ElementType;
    text: string;
    onClick: () => void;
    disabled?: boolean;
    isDestructive?: boolean;
    title?: string;
  }> = ({ icon: Icon, text, onClick, disabled, isDestructive, title }) => (
    <button
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) {
          onClick();
          setOpenActionMenu(null);
        }
      }}
      disabled={disabled}
      title={title}
      className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm ${
        disabled 
          ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
          : isDestructive 
            ? 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50' 
            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      role="menuitem"
    >
      <Icon className="w-4 h-4" />
      <span>{text}</span>
    </button>
  );

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Embarque / Carga</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Motorista / Solicitante</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Origem / Destino</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Valor Frete</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Status Atual</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Data Programada</th>
              {(!isClient || showActionsColumnForClient) && (
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Ações</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {shipments.map((shipment) => {
              const cargo = getCargoInfo(shipment.cargoId);
              const vehicle = vehicles.find(v => v.plate === shipment.horsePlate);
              const isActionable = shipment.status !== ShipmentStatus.Finalizado && shipment.status !== ShipmentStatus.Cancelado;
              const whatsappLink = shipment.driverContact ? formatWhatsAppLink(shipment.driverContact) : null;
              const advanceStatusCheck = canUserAdvanceStatus ? canUserAdvanceStatus(shipment) : { allowed: true, reason: '' };
              const canAdvance = advanceStatusCheck.allowed;
              const disabledReason = advanceStatusCheck.reason;

              let isLate = false;
              if (shipment.scheduledTime && !shipment.arrivalTime) {
                const scheduledDateTime = new Date(`${shipment.scheduledDate}T${shipment.scheduledTime}`);
                if (new Date() > scheduledDateTime) {
                    isLate = true;
                }
              }

              return (
                <tr key={shipment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="font-medium text-gray-900 dark:text-white">{shipment.id}</div>
                    {cargo && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Carga: 
                        {onShowCargoDetails ? (
                          <button onClick={() => onShowCargoDetails(cargo)} className="ml-1 font-semibold text-primary dark:text-blue-400 hover:underline">
                            {cargo.sequenceId}
                          </button>
                        ) : (
                          <span className="ml-1 font-semibold">{cargo.sequenceId}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{shipment.driverName}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{shipment.horsePlate}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Sol.: <span className="font-medium">{getEmbarcadorName(shipment.embarcadorId)}</span>
                    </div>
                    {vehicle && (
                        <div className="mt-1">
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                            {vehicle.setType} / {vehicle.bodyType}
                        </span>
                        </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white group relative">
                    <div>{cargo?.origin || 'N/A'}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{cargo?.destination || 'N/A'}</div>
                     {cargo && onShowCargoDetails && (
                        <button 
                            onClick={() => onShowCargoDetails(cargo)} 
                            className="absolute top-1/2 right-2 -translate-y-1/2 p-1 rounded-full text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-600"
                            title="Ver detalhes da Carga"
                        >
                            <InfoIcon className="w-4 h-4" />
                        </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {isClient ? (
                        <>
                            <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency((cargo?.companyFreightValuePerTon || 0) * shipment.shipmentTonnage)}</div>
                            {shipment.shipmentTonnage > 0 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                {formatCurrency(cargo?.companyFreightValuePerTon || 0)}/ton
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(shipment.driverFreightValue)}</div>
                            {shipment.shipmentTonnage > 0 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                {formatCurrency(shipment.driverFreightValue / shipment.shipmentTonnage)}/ton
                                </div>
                            )}
                        </>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{shipment.status}</p>
                    {shipment.scheduledTime && (
                        <p className={`text-xs mt-1 ${isLate && !shipment.arrivalTime ? 'text-yellow-500' : 'text-gray-500'}`}>
                            Previsto: {shipment.scheduledTime}
                        </p>
                    )}
                    {shipment.arrivalTime ? (
                        <div className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1">
                            Chegou: {new Date(shipment.arrivalTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    ) : (
                        onMarkArrival && shipment.scheduledTime && (
                            <button onClick={() => onMarkArrival(shipment.id)} className="mt-2 text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                                Marcar Chegada
                            </button>
                        )
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(shipment.scheduledDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  {(!isClient || showActionsColumnForClient) && (
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        {isClient ? (
                            <>
                                {onAttach && (
                                    <button
                                    onClick={() => onAttach(shipment)}
                                    className="flex items-center gap-1.5 text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors whitespace-nowrap"
                                    title="Gerenciar Anexos"
                                    >
                                    <PaperclipIcon className="w-4 h-4" />
                                    <span>Gestor de Anexos</span>
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center justify-center space-x-1">
                                {whatsappLink && (
                                    <a
                                        href={whatsappLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded-full hover:bg-green-100 dark:hover:bg-green-800 text-green-600 dark:text-green-400"
                                        title="Abrir WhatsApp"
                                    >
                                        <WhatsAppIcon className="w-5 h-5" />
                                    </a>
                                )}

                                {shipment.status === ShipmentStatus.Cancelado ? (
                                    <span className="text-xs text-gray-400 dark:text-gray-500 italic px-2">Cancelado</span>
                                ) : (
                                    <div className="relative" ref={openActionMenu === shipment.id ? actionMenuRef : null}>
                                        <button
                                            onClick={() => toggleActionMenu(shipment.id)}
                                            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400"
                                            title="Mais ações"
                                        >
                                            <MoreVerticalIcon className="h-5 w-5" />
                                        </button>
                                        {openActionMenu === shipment.id && (
                                            <div className="absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-20">
                                                <div className="py-1" role="menu" aria-orientation="vertical">
                                                    {onShowHistory && <ActionMenuItem icon={HistoryIcon} text="Ver Histórico" onClick={() => onShowHistory(shipment)} />}
                                                    {isActionable && onAttach && <ActionMenuItem icon={PaperclipIcon} text="Anexar e Avançar" onClick={() => onAttach(shipment)} disabled={!canAdvance} title={!canAdvance ? disabledReason : undefined} />}
                                                    {shipment.status === ShipmentStatus.PreCadastro && onOpenCadastroAntt && <ActionMenuItem icon={ExternalLinkIcon} text="Fazer Cadastro" onClick={() => onOpenCadastroAntt(shipment)} />}
                                                    {isActionable && onEditPrice && <ActionMenuItem icon={DollarSignIcon} text="Alterar Preço" onClick={() => onEditPrice(shipment)} />}
                                                    {isActionable && onTransfer && <ActionMenuItem icon={TransferIcon} text="Transferir Embarque" onClick={() => onTransfer(shipment)} />}
                                                    {shipment.status === ShipmentStatus.Finalizado && onAttach && <ActionMenuItem icon={PaperclipIcon} text="Gestor de Anexos" onClick={() => onAttach(shipment)} />}
                                                    {isActionable && onCancel && <ActionMenuItem icon={XIcon} text="Cancelar Embarque" onClick={() => onCancel(shipment)} isDestructive />}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ShipmentTable;
