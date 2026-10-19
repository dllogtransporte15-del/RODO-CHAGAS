
import React, { useState, useEffect } from 'react';
import type { Owner } from '../types';
import { OwnerType } from '../types';
import { autoFormatInput, isValidCpfCnpj } from '../utils/formatters';
import { useToast } from '../hooks/useToast';

interface OwnerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (owner: Owner | Omit<Owner, 'id'>) => Promise<void> | void;
  ownerToEdit: Owner | null;
}

const OwnerFormModal: React.FC<OwnerFormModalProps> = ({ isOpen, onClose, onSave, ownerToEdit }) => {
  const { showToast } = useToast();
  const [owner, setOwner] = useState<Omit<Owner, 'id'>>({
    name: '',
    cpfCnpj: '',
    phone: '',
    type: OwnerType.PessoaFisica,
    bankDetails: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (ownerToEdit) {
      setOwner(ownerToEdit);
    } else {
      setOwner({
        name: '',
        cpfCnpj: '',
        phone: '',
        type: OwnerType.PessoaFisica,
        bankDetails: '',
      });
    }
  }, [ownerToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const formattedValue = autoFormatInput(name, value);
    setOwner(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (owner.cpfCnpj && !isValidCpfCnpj(owner.cpfCnpj)) {
      showToast('CPF ou CNPJ do proprietário inválido. Verifique os dígitos informados.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (ownerToEdit) {
        await onSave({
          ...owner,
          id: ownerToEdit.id,
        });
      } else {
        await onSave(owner);
      }
      onClose();
    } catch (err) {
      console.error('Erro ao salvar proprietário:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">{ownerToEdit ? 'Editar Proprietário' : 'Novo Proprietário'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6">
            <input name="name" value={owner.name} onChange={handleChange} placeholder="Nome / Razão Social" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
            <input name="cpfCnpj" value={owner.cpfCnpj} onChange={handleChange} placeholder="CPF / CNPJ" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
            <input name="phone" value={owner.phone} onChange={handleChange} placeholder="Telefone" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
             <select name="type" value={owner.type} onChange={handleChange} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
              {Object.values(OwnerType).map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <textarea name="bankDetails" value={owner.bankDetails} onChange={handleChange} placeholder="Dados Bancários" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" rows={3}></textarea>
          </div>
          <div className="mt-8 flex justify-end space-x-4">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isSubmitting}
              className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 font-bold disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="py-2 px-6 bg-primary text-white rounded-lg hover:bg-primary-dark font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
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
        </form>
      </div>
    </div>
  );
};

export default OwnerFormModal;
