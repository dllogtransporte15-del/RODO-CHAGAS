import React, { useState, useRef, useEffect } from 'react';
import type { Client, Product, FreightOffer } from '../types';
import { FreightOfferStatus } from '../types';
import { XIcon, PackageIcon, MapPinIcon, DollarSignIcon, CalendarIcon, ScaleIcon, PaperclipIcon, MapIcon, RouteIcon, FileTextIcon, Building2, Plus } from 'lucide-react';
import { supabase } from '../supabase';
import { cleanOrShortenLocationInput, parseLocation } from '../utils/locationUtils';
import { validateCityFormat, formatCityState } from '../utils/cityUtils';
import { formatCpfCnpj, formatPhone } from '../utils/formatters';
import { fetchRecipientClients, saveRecipientClient, type RecipientClient } from '../utils/recipientClientStorage';
import { BRAZILIAN_CITIES } from '../brazilianCities';
import FreightRouteMap, { RouteCalculatedData } from './FreightRouteMap';

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
    recipientClient: '',
    totalTonnage: '',
    dailySchedule: '',
    productId: '',
    observations: '',
  });

  const [additionalDestinations, setAdditionalDestinations] = useState<{city: string, location: string}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState<'form' | 'map'>('form');
  const [calculatedRoute, setCalculatedRoute] = useState<RouteCalculatedData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recipientList, setRecipientList] = useState<RecipientClient[]>([]);
  const [isQuickRecipientModalOpen, setIsQuickRecipientModalOpen] = useState(false);
  const [quickRecipientData, setQuickRecipientData] = useState({
    name: '',
    cpfCnpj: '',
    phone: '',
  });
  const [quickRecipientError, setQuickRecipientError] = useState<string | null>(null);
  const [isSavingRecipient, setIsSavingRecipient] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRecipientClients(currentClient?.id).then(setRecipientList);
    }
  }, [isOpen, currentClient?.id]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'originLocation' || name === 'destinationLocation') {
      formattedValue = cleanOrShortenLocationInput(value);
    }
    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'origin' || name === 'destination') {
      const formatted = formatCityState(value);
      if (formatted && formatted !== value) {
        setFormData(prev => ({ ...prev, [name]: formatted }));
      }
    }
  };

  const handleAddDestination = () => {
    setAdditionalDestinations([...additionalDestinations, { city: '', location: '' }]);
  };

  const handleAdditionalDestinationChange = (index: number, field: 'city' | 'location', value: string) => {
    const newDests = [...additionalDestinations];
    newDests[index][field] = field === 'location' ? cleanOrShortenLocationInput(value) : value;
    setAdditionalDestinations(newDests);
  };

  const handleAdditionalDestinationBlur = (index: number) => {
    const newDests = [...additionalDestinations];
    const currentCity = newDests[index].city;
    const formatted = formatCityState(currentCity);
    if (formatted && formatted !== currentCity) {
      newDests[index].city = formatted;
      setAdditionalDestinations(newDests);
    }
  };

  const handleRemoveDestination = (index: number) => {
    setAdditionalDestinations(additionalDestinations.filter((_, i) => i !== index));
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setAttachments(prev => {
        const existingNames = prev.map(f => f.name);
        const filesToAdd = newFiles.filter(f => !existingNames.includes(f.name));
        return [...prev, ...filesToAdd];
      });
    }
    e.target.value = '';
  };

  const handleRemoveAttachment = (fileName: string) => {
    setAttachments(prev => prev.filter(file => file.name !== fileName));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClient) return;

    // Validação estrita da Cidade de Origem
    const originValidation = validateCityFormat(formData.origin, 'Origem (Cidade)');
    if (!originValidation.isValid) {
      alert(originValidation.errorMessage);
      return;
    }

    // Validação estrita da Cidade de Destino
    const destValidation = validateCityFormat(formData.destination, 'Destino (Cidade)');
    if (!destValidation.isValid) {
      alert(destValidation.errorMessage);
      return;
    }

    // Validação estrita de Destinos Adicionais
    const validatedAdditionalDestinations: { city: string; location: string }[] = [];
    for (let i = 0; i < additionalDestinations.length; i++) {
      const item = additionalDestinations[i];
      if (item.city.trim()) {
        const addValidation = validateCityFormat(item.city, `Destino Adicional ${i + 1} (Cidade)`);
        if (!addValidation.isValid) {
          alert(addValidation.errorMessage);
          return;
        }
        validatedAdditionalDestinations.push({
          city: addValidation.formatted,
          location: cleanOrShortenLocationInput(item.location)
        });
      }
    }

    setIsSubmitting(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of attachments) {
        const fileExt = file.name.split('.').pop();
        const fileName = `freight_offer_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `freight_offers/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('shipment_attachments')
          .upload(filePath, file);
          
        if (uploadError) {
          throw new Error('Falha ao fazer upload de anexo: ' + file.name);
        }
        
        const { data } = supabase.storage
          .from('shipment_attachments')
          .getPublicUrl(filePath);
          
        uploadedUrls.push(`${data.publicUrl}?name=${encodeURIComponent(file.name)}`);
      }

      await onSave({
        clientId: currentClient.id,
        recipientClient: formData.recipientClient?.trim() || undefined,
        origin: originValidation.formatted,
        originLocation: cleanOrShortenLocationInput(formData.originLocation),
        destination: destValidation.formatted,
        destinationLocation: cleanOrShortenLocationInput(formData.destinationLocation),
        totalTonnage: Number(formData.totalTonnage),
        dailySchedule: formData.dailySchedule,
        productId: formData.productId,
        status: FreightOfferStatus.AguardandoPreco,
        observations: formData.observations,
        additionalDestinations: validatedAdditionalDestinations,
        attachments: uploadedUrls,
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col h-[92vh] max-h-[820px] border border-gray-100 dark:border-gray-700 overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center px-5 sm:px-6 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
              <PackageIcon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white leading-tight">Gerar Oferta de Frete</h2>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">Preencha os dados e acompanhe a rota no mapa</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile Tab Toggle */}
            <div className="flex lg:hidden bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'form'
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <FileTextIcon className="w-3.5 h-3.5" />
                <span>Dados</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'map'
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>Mapa</span>
                {calculatedRoute && (
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                )}
              </button>
            </div>

            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
              <XIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content Body (Flex Layout: Left Form, Right Map) */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Left Side: Form */}
          <div className={`w-full lg:w-7/12 p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 ${activeTab === 'map' ? 'hidden lg:block' : 'block'}`}>
            <form id="freight-offer-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              
              {/* Distance Info Banner if calculated */}
              {calculatedRoute && calculatedRoute.distanceKm > 0 && (
                <div className="p-2.5 sm:p-3 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl flex items-center justify-between text-xs animate-fade-in">
                  <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-300 font-semibold">
                    <RouteIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Distância estimada:</span>
                    <span className="text-indigo-900 dark:text-indigo-200 font-bold bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                      {calculatedRoute.distanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km
                    </span>
                  </div>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium hidden sm:inline">
                    Trajeto mapeado na lateral ➔
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Origem (Cidade) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPinIcon className="h-4 w-4 text-green-600" />
                    </div>
                    <input
                      required
                      type="text"
                      name="origin"
                      value={formData.origin}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      list="brazilian-cities-offer-list"
                      className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ex: Rio Verde, GO"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Local da Origem</label>
                    {parseLocation(formData.originLocation).isUrl && (
                      <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.2 rounded">
                        📍 GPS/Link detectado
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    name="originLocation"
                    value={formData.originLocation}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Fazenda Boa Esperança ou Link Google Maps"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Destino (Cidade) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPinIcon className="h-4 w-4 text-red-600" />
                      </div>
                      <input
                        required
                        type="text"
                        name="destination"
                        value={formData.destination}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        list="brazilian-cities-offer-list"
                        className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: Santos, SP"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddDestination}
                      className="p-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex-shrink-0"
                      title="Adicionar outro destino"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Local do Destino</label>
                    {parseLocation(formData.destinationLocation).isUrl && (
                      <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.2 rounded">
                        📍 GPS/Link detectado
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    name="destinationLocation"
                    value={formData.destinationLocation}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Porto de Santos ou Link Google Maps"
                  />
                </div>

                <datalist id="brazilian-cities-offer-list">
                  {BRAZILIAN_CITIES.map(city => (
                    <option key={city} value={city} />
                  ))}
                </datalist>

                {additionalDestinations.map((dest, idx) => (
                  <React.Fragment key={idx}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destino Adicional {idx + 1} (Cidade)</label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MapPinIcon className="h-4 w-4 text-indigo-500" />
                          </div>
                          <input
                            required
                            type="text"
                            value={dest.city}
                            onChange={e => handleAdditionalDestinationChange(idx, 'city', e.target.value)}
                            onBlur={() => handleAdditionalDestinationBlur(idx)}
                            list="brazilian-cities-offer-list"
                            className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            placeholder="Ex: Campinas, SP"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDestination(idx)}
                          className="p-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex-shrink-0"
                          title="Remover destino"
                        >
                          -
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Local do Destino Adicional {idx + 1}</label>
                        {parseLocation(dest.location).isUrl && (
                          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.2 rounded">
                            📍 GPS/Link detectado
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={dest.location}
                        onChange={e => handleAdditionalDestinationChange(idx, 'location', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        placeholder="Ex: Galpão Central ou Link Maps"
                      />
                    </div>
                  </React.Fragment>
                ))}

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Cliente Destinatário <span className="text-xs text-gray-400 font-normal">(Opcional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickRecipientData({
                          name: formData.recipientClient || '',
                          cpfCnpj: '',
                          phone: '',
                        });
                        setQuickRecipientError(null);
                        setIsQuickRecipientModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                      title="Cadastrar novo cliente destinatário sem fechar a oferta"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Cadastrar Novo</span>
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building2 className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="recipientClient"
                      value={formData.recipientClient}
                      onChange={handleChange}
                      list="recipient-clients-offer-list"
                      className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm"
                      placeholder="Selecione ou digite o destinatário..."
                    />
                    <datalist id="recipient-clients-offer-list">
                      {recipientList.map(r => (
                        <option key={r.id} value={r.name}>{r.cpfCnpj ? `${r.name} - ${r.cpfCnpj}` : r.name}</option>
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cadência Diária</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <CalendarIcon className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="dailySchedule"
                      value={formData.dailySchedule}
                      onChange={handleChange}
                      className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ex: 50 ton/dia, ou Livre"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Volume Total (Ton) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <ScaleIcon className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      name="totalTonnage"
                      value={formData.totalTonnage}
                      onChange={handleChange}
                      className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ex: 500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Produto <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    name="productId"
                    value={formData.productId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione um produto</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Anexos</label>
                  <div className="relative">
                    <input
                      type="file"
                      multiple
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={handleAttachmentClick}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg shadow-xs hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 justify-center transition-colors"
                    >
                      <PaperclipIcon className="w-4 h-4" />
                      Anexar Arquivos
                    </button>
                  </div>
                  {attachments.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {attachments.map((file, index) => (
                        <li key={index} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/50 px-2 py-1.5 rounded-md">
                          <span className="truncate max-w-[85%]">{file.name}</span>
                          <button type="button" onClick={() => handleRemoveAttachment(file.name)} className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors">
                            <XIcon className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações / Informações Adicionais</label>
                  <textarea
                    name="observations"
                    value={formData.observations}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Necessário agendamento prévio, veículo sider..."
                  />
                </div>
              </div>
            </form>
          </div>

          {/* Right Side: Map & Route Preview */}
          <div className={`w-full lg:w-5/12 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 flex flex-col flex-1 min-h-0 bg-slate-50 dark:bg-gray-900 ${activeTab === 'form' ? 'hidden lg:flex' : 'flex'}`}>
            <FreightRouteMap
              origin={formData.origin}
              originLocation={formData.originLocation}
              destination={formData.destination}
              destinationLocation={formData.destinationLocation}
              additionalDestinations={additionalDestinations}
              onRouteCalculated={(data) => setCalculatedRoute(data)}
              className="flex-1 min-h-0"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 w-full sm:w-auto">
            {calculatedRoute ? (
              <span className="inline-flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-medium">
                <MapPinIcon className="w-3.5 h-3.5" />
                Trajeto validado ({calculatedRoute.distanceKm.toFixed(1)} km)
              </span>
            ) : (
              <span>Os trajetos são calculados automaticamente via mapa rodoviário.</span>
            )}
          </div>

          <div className="flex justify-end gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-1 sm:flex-initial"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="freight-offer-form"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 flex-1 sm:flex-initial shadow-sm"
            >
              {isSubmitting ? 'Salvando...' : 'Criar Oferta'}
            </button>
          </div>
        </div>

      </div>

      {/* Quick Recipient Client Modal (Inline) */}
      {isQuickRecipientModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-gray-700 p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-800 dark:text-white leading-tight">Cadastrar Cliente Destinatário</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Cadastro rápido sem sair da oferta de frete</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickRecipientModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {quickRecipientError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 font-medium">
                {quickRecipientError}
              </div>
            )}

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Nome / Razão Social <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={quickRecipientData.name}
                  onChange={(e) => setQuickRecipientData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Bunge Alimentos S.A."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  CPF ou CNPJ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickRecipientData.cpfCnpj}
                  onChange={(e) => {
                    const formatted = formatCpfCnpj(e.target.value);
                    setQuickRecipientData(prev => ({ ...prev, cpfCnpj: formatted }));
                  }}
                  placeholder="Ex: 00.000.000/0001-00 ou 000.000.000-00"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Telefone <span className="text-xs text-gray-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={quickRecipientData.phone}
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value);
                    setQuickRecipientData(prev => ({ ...prev, phone: formatted }));
                  }}
                  placeholder="Ex: (64) 99999-9999"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setIsQuickRecipientModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingRecipient}
                onClick={async () => {
                  if (!quickRecipientData.name.trim()) {
                    setQuickRecipientError('Por favor, informe o Nome ou Razão Social do destinatário.');
                    return;
                  }
                  const cleanCpfCnpj = quickRecipientData.cpfCnpj.replace(/\D/g, '');
                  if (!cleanCpfCnpj || (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14)) {
                    setQuickRecipientError('Por favor, informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
                    return;
                  }

                  setIsSavingRecipient(true);
                  setQuickRecipientError(null);
                  try {
                    const saved = await saveRecipientClient({
                      clientId: currentClient?.id,
                      name: quickRecipientData.name.trim(),
                      cpfCnpj: quickRecipientData.cpfCnpj.trim(),
                      phone: quickRecipientData.phone.trim() || undefined,
                    });
                    setRecipientList(prev => [saved, ...prev.filter(r => r.id !== saved.id)]);
                    setFormData(prev => ({ ...prev, recipientClient: saved.name }));
                    setIsQuickRecipientModalOpen(false);
                  } catch (err: any) {
                    setQuickRecipientError(err?.message || 'Erro ao salvar cliente destinatário.');
                  } finally {
                    setIsSavingRecipient(false);
                  }
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingRecipient ? 'Salvando...' : 'Cadastrar e Selecionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreightOfferModal;

