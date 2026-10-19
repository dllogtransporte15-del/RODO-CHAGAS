import React, { useState, useEffect } from 'react';
import type { Shipment } from '../types';
import { useToast } from '../hooks/useToast';
import { formatCpfCnpj, isValidCpfCnpj } from '../utils/formatters';

interface CadastroAnttModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { anttOwnerIdentifier: string; bankDetails?: string }) => Promise<void> | void;
  shipment: Shipment;
}

const CadastroAnttModal: React.FC<CadastroAnttModalProps> = ({ isOpen, onClose, onSave, shipment }) => {
  const { showToast } = useToast();
  const [anttOwnerIdentifier, setAnttOwnerIdentifier] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && shipment) {
      setAnttOwnerIdentifier(shipment.anttOwnerIdentifier ? formatCpfCnpj(shipment.anttOwnerIdentifier) : '');
      setBankDetails(shipment.bankDetails || '');
    }
  }, [isOpen, shipment]);

  const handleSave = async () => {
    if (isSaving) return;
    const cleanId = anttOwnerIdentifier.replace(/\D/g, '');
    if (!cleanId) {
      showToast('O CPF/CNPJ do titular da ANTT é obrigatório.', 'warning');
      return;
    }
    if (!isValidCpfCnpj(cleanId)) {
      showToast('CPF ou CNPJ do titular da ANTT inválido. Verifique os dígitos.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ anttOwnerIdentifier, bankDetails });
      onClose();
    } catch (err) {
      console.error('Erro ao salvar titular da ANTT:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Cadastro de Titular ANTT</h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Embarque ID: {shipment.id}</p>
        
        <div className="space-y-4">
            <div>
              <label htmlFor="antt-identifier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                CPF/CNPJ do Titular da ANTT <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="antt-identifier"
                value={anttOwnerIdentifier}
                onChange={(e) => setAnttOwnerIdentifier(formatCpfCnpj(e.target.value))}
                className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
                placeholder="00.000.000/0000-00 ou 000.000.000-00"
                required
              />
            </div>
            <div>
              <label htmlFor="bank-details" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Dados Bancários (Opcional)
              </label>
              <textarea
                id="bank-details"
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                placeholder="Banco: 001, Ag: 1234, C/C: 56789-0&#10;Titular: Nome, CPF/CNPJ: ..."
                className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
                rows={4}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Os dados bancários devem ser compatíveis com o titular da ANTT ou com o motorista.
              </p>
            </div>
        </div>
        
        <div className="mt-8 flex justify-end space-x-4">
          <button 
            type="button" 
            onClick={onClose} 
            disabled={isSaving}
            className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={isSaving}
            className="py-2 px-6 bg-primary text-white rounded-lg hover:bg-primary-dark font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Salvando...</span>
              </>
            ) : (
              'Salvar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CadastroAnttModal;