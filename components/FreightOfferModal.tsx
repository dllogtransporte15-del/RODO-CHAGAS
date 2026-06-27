import React, { useState } from 'react';
import type { Client, Product, FreightOffer } from '../types';
import { FreightOfferStatus } from '../types';
import { XIcon, PackageIcon, MapPinIcon, DollarSignIcon, CalendarIcon, ScaleIcon } from 'lucide-react';

interface FreightOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  products: Product[];
  currentClient?: Client;
  onSave: (offer: Omit<FreightOffer, 'id' | 'createdAt'>) => Promise<void>;
}

const FreightOfferModal: React.FC<FreightOfferModalProps> = ({
  isOpen, onClose, clients, products, currentClient, onSave
}) => {
  const [formData, setFormData] = useState({
    origin: '',
    originLocation: '',
    destination: '',
    destinationLocation: '',
    totalTonnage: '',
    dailySchedule: '',
    freightValuePerTon: '',
    productId: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClient) return;

    setIsSubmitting(true);
    try {
      await onSave({
        clientId: currentClient.id,
        origin: formData.origin,
        originLocation: formData.originLocation,
        destination: formData.destination,
        destinationLocation: formData.destinationLocation,
        totalTonnage: Number(formData.totalTonnage),
        dailySchedule: formData.dailySchedule,
        freightValuePerTon: Number(formData.freightValuePerTon),
        productId: formData.productId,
        status: FreightOfferStatus.Pendente,
      });
      onClose();
    } catch (error: any) {
      console.error('Error saving freight offer:', error);
      alert(`Erro ao criar a oferta de frete. ${error?.message || ''} ${error?.details || ''}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
              <PackageIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Gerar Oferta de Frete</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <form id="freight-offer-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Origem (Cidade)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPinIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input required type="text" name="origin" value={formData.origin} onChange={handleChange} className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" placeholder="Ex: São Paulo - SP" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Local da Origem</label>
                <input type="text" name="originLocation" value={formData.originLocation} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" placeholder="Ex: Fazenda Boa Esperança" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destino (Cidade)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPinIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input required type="text" name="destination" value={formData.destination} onChange={handleChange} className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" placeholder="Ex: Santos - SP" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Local do Destino</label>
                <input type="text" name="destinationLocation" value={formData.destinationLocation} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" placeholder="Ex: Porto de Santos" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Volume Total (Ton)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ScaleIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input required type="number" min="0" step="0.01" name="totalTonnage" value={formData.totalTonnage} onChange={handleChange} className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" placeholder="Ex: 500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cadência Diária</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CalendarIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input type="text" name="dailySchedule" value={formData.dailySchedule} onChange={handleChange} className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" placeholder="Ex: 50 ton/dia, ou Livre" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor do Frete (R$/Ton)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSignIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input required type="number" min="0" step="0.01" name="freightValuePerTon" value={formData.freightValuePerTon} onChange={handleChange} className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" placeholder="Ex: 120.00" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Produto</label>
                <select required name="productId" value={formData.productId} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
                  <option value="">Selecione um produto</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" form="freight-offer-form" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50">
            {isSubmitting ? 'Salvando...' : 'Criar Oferta'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FreightOfferModal;
