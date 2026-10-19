
import React, { useState, useEffect } from 'react';
import type { Client } from '../types';
import { PaymentMethod } from '../types';
import { autoFormatInput, isValidCNPJ } from '../utils/formatters';
import { useToast } from '../hooks/useToast';

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: Client | Omit<Client, 'id'>) => Promise<void> | void;
  clientToEdit: Client | null;
}

const ClientFormModal: React.FC<ClientFormModalProps> = ({ isOpen, onClose, onSave, clientToEdit }) => {
  const { showToast } = useToast();
  const [client, setClient] = useState<Omit<Client, 'id'>>({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    paymentMethod: PaymentMethod.Prazo,
    paymentTerm: 30,
    requiresExternalOrder: false,
    requiresScheduling: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (clientToEdit) {
      setClient(clientToEdit);
    } else {
      setClient({
        razaoSocial: '',
        nomeFantasia: '',
        cnpj: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        paymentMethod: PaymentMethod.Prazo,
        paymentTerm: 30,
        requiresExternalOrder: false,
        requiresScheduling: false,
      });
    }
  }, [clientToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const formattedValue = autoFormatInput(name, value);
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setClient(prev => ({ ...prev, [name]: checked }));
    } else {
        setClient(prev => ({ ...prev, [name]: formattedValue }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (client.cnpj && !isValidCNPJ(client.cnpj)) {
      showToast('CNPJ do cliente inválido. Verifique os dígitos informados.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (clientToEdit) {
        await onSave({
          ...client,
          id: clientToEdit.id,
        });
      } else {
        await onSave(client);
      }
      onClose();
    } catch (err) {
      console.error('Erro ao salvar cliente:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">{clientToEdit ? 'Editar Cliente' : 'Novo Cliente'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input name="razaoSocial" value={client.razaoSocial} onChange={handleChange} placeholder="Razão Social" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
            <input name="nomeFantasia" value={client.nomeFantasia} onChange={handleChange} placeholder="Nome Fantasia" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
            <input name="cnpj" value={client.cnpj} onChange={handleChange} placeholder="CNPJ" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
            <input name="phone" value={client.phone} onChange={handleChange} placeholder="Telefone" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
            <input name="email" value={client.email} onChange={handleChange} type="email" placeholder="Email" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 col-span-1 md:col-span-2" />
            <input name="address" value={client.address} onChange={handleChange} placeholder="Endereço" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 col-span-1 md:col-span-2" />
            <input name="city" value={client.city} onChange={handleChange} placeholder="Cidade" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
            <input name="state" value={client.state} onChange={handleChange} placeholder="Estado (UF)" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
            
            <h3 className="text-lg font-semibold col-span-1 md:col-span-2 mt-4 text-gray-700 dark:text-gray-300">Regras Comerciais</h3>
            
            <select name="paymentMethod" value={client.paymentMethod} onChange={handleChange} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
              {Object.values(PaymentMethod).map(method => <option key={method} value={method}>{method}</option>)}
            </select>
            <input name="paymentTerm" value={client.paymentTerm} onChange={handleChange} type="number" placeholder="Prazo Pagamento (dias)" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />

            <div className="col-span-1 md:col-span-2 flex items-center space-x-6 mt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" name="requiresExternalOrder" checked={client.requiresExternalOrder} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Exige Ordem Externa</span>
                </label>
                 <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" name="requiresScheduling" checked={client.requiresScheduling} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Exige Agendamento</span>
                </label>
            </div>
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

export default ClientFormModal;
