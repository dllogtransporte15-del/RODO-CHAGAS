
import React, { useState } from 'react';

interface CancelShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  shipmentId: string;
}

const CancelShipmentModal: React.FC<CancelShipmentModalProps> = ({ isOpen, onClose, onConfirm, shipmentId }) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (isSubmitting || !reason.trim()) return;
    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } catch (err) {
      console.error('Erro ao cancelar embarque:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Confirmar Cancelamento</h2>
        <p className="mb-4 text-gray-600 dark:text-gray-300">
          Tem certeza que deseja cancelar o embarque <span className="font-semibold">{shipmentId}</span>? Esta ação não pode ser desfeita.
        </p>
        
        <div className="mb-6">
          <label htmlFor="cancel-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Motivo do Cancelamento (Obrigatório)
          </label>
          <textarea
            id="cancel-reason"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-black dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            rows={3}
            placeholder="Descreva o motivo do cancelamento..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </div>
        
        <div className="flex justify-end space-x-4">
          <button 
            onClick={() => {
              setReason('');
              onClose();
            }} 
            disabled={isSubmitting}
            className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50"
          >
            Não
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!reason.trim() || isSubmitting}
            className={`py-2 px-6 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2 ${
              reason.trim() && !isSubmitting ? 'bg-black hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed opacity-50'
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Cancelando...</span>
              </>
            ) : (
              'Sim, Cancelar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelShipmentModal;
