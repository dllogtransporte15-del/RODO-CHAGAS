import React from 'react';
import type { Shipment, Cargo } from '../types';

interface ShipmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment | null;
  cargo: Cargo | undefined;
}

const DetailItem: React.FC<{ label: string; value?: string | number | null; children?: React.ReactNode }> = ({ label, value, children }) => (
    <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {children || <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{value ?? 'N/A'}</p>}
    </div>
);

const ShipmentDetailsModal: React.FC<ShipmentDetailsModalProps> = ({ isOpen, onClose, shipment, cargo }) => {
  if (!isOpen || !shipment) return null;

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('pt-BR');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start mb-4 border-b pb-4 dark:border-gray-700">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Detalhes do Embarque</h2>
                <p className="text-sm font-mono text-primary dark:text-blue-400 mt-1">{shipment.id}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">&times;</button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            
            {/* Rota e Origem/Destino */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
                <DetailItem label="Origem da Carga" value={cargo?.origin} />
                <DetailItem label="Destino da Carga" value={cargo?.destination} />
                <DetailItem label="Carga Vinculada" value={cargo?.sequenceId ? `#${cargo.sequenceId}` : cargo?.id} />
                <DetailItem label="Status Atual do Embarque" value={shipment.status} />
                {shipment.status === 'Cancelado' && shipment.cancellationReason && (
                    <div className="md:col-span-2 mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-md">
                        <p className="text-xs font-medium text-red-800 dark:text-red-400">Motivo do Cancelamento</p>
                        <p className="text-sm font-semibold text-red-900 dark:text-red-200 mt-1">{shipment.cancellationReason}</p>
                    </div>
                )}
            </div>

            {/* Informações do Motorista e Veículo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t dark:border-gray-700 pt-4">
                <DetailItem label="Motorista" value={shipment.driverName} />
                <DetailItem label="Placa do Cavalo" value={shipment.horsePlate} />
                <DetailItem label="Contato do Motorista" value={shipment.driverContact} />
                <DetailItem label="Documento (CPF)" value={shipment.driverCpf} />
            </div>

            {/* Frete e Financeiro */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t dark:border-gray-700 pt-4">
                <DetailItem label="Valor Frete Motorista">
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(shipment.driverFreightValue)}
                    </p>
                </DetailItem>
                <DetailItem label="Tonelagem">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {shipment.shipmentTonnage.toLocaleString('pt-BR')} ton
                    </p>
                </DetailItem>
                
                <div>
                    <DetailItem label="Dados Bancários">
                        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border dark:border-gray-700">
                            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                {shipment.bankDetails || <span className="text-gray-400 italic">Não informados</span>}
                            </p>
                        </div>
                    </DetailItem>
                </div>
                <div>
                    <DetailItem label="Referências do Motorista">
                        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border dark:border-gray-700">
                            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                {(shipment as any).driverReferences || <span className="text-gray-400 italic">Não informadas</span>}
                            </p>
                        </div>
                    </DetailItem>
                </div>
                
                <div className="md:col-span-2">
                    <DetailItem label="Titular da ANTT (CPF/CNPJ)">
                        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border dark:border-gray-700">
                            <p className="text-sm font-mono text-gray-800 dark:text-gray-200">
                                {shipment.anttOwnerIdentifier || <span className="text-gray-400 italic font-sans">Não preenchido no cadastro</span>}
                            </p>
                        </div>
                    </DetailItem>
                </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t dark:border-gray-700 pt-4 opacity-75">
                <DetailItem label="Criado em" value={formatDate(shipment.createdAt)} />
                <DetailItem label="Data Programada" value={shipment.scheduledDate ? formatDate(`${shipment.scheduledDate}T${shipment.scheduledTime || '00:00'}`) : null} />
            </div>
            
        </div>
        
        <div className="mt-6 flex justify-end border-t dark:border-gray-700 pt-4">
          <button type="button" onClick={onClose} className="py-2 px-6 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShipmentDetailsModal;
