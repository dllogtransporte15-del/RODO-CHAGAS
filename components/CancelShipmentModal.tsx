
import React from 'react';

interface CancelShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  shipmentId: string;
}

const CancelShipmentModal: React.FC<CancelShipmentModalProps> = ({ isOpen, onClose, onConfirm, shipmentId }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Confirmar Cancelamento</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Tem certeza que deseja cancelar o embarque <span className="font-semibold">{shipmentId}</span>? Esta ação não pode ser desfeita.
        </p>
        
        <div className="flex justify-end space-x-4">
          <button onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
            Não
          </button>
          <button onClick={onConfirm} className="py-2 px-4 bg-black text-white rounded-lg hover:bg-gray-800">
            Sim, Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelShipmentModal;
