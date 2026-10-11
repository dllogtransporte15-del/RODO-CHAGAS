import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, Phone, MessageCircle, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ShipperReceiver } from '../types';
import { formatCPF, formatCpfCnpj, formatPhone, cleanOrShortenLocationInput } from '../utils/formatters';
import { BRAZILIAN_CITIES } from '../brazilianCities';

interface ShipperReceiverFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<ShipperReceiver, 'id' | 'createdAt'> & { id?: string }) => void;
  itemToEdit?: ShipperReceiver | null;
  defaultType?: 'expedidor' | 'recebedor' | 'ambos';
  initialName?: string;
}

const ShipperReceiverFormModal: React.FC<ShipperReceiverFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  itemToEdit,
  initialName = '',
}) => {
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState<'CNPJ' | 'CPF'>('CNPJ');
  const [documentNumber, setDocumentNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [isWhatsapp, setIsWhatsapp] = useState(true);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [notes, setNotes] = useState('');

  // Classificação do Local é sempre "Ambos" (Expedidor e Recebedor)
  const type: 'expedidor' | 'recebedor' | 'ambos' = 'ambos';

  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
        setName(itemToEdit.name || '');
        setDocumentType(itemToEdit.documentType || 'CNPJ');
        setDocumentNumber(itemToEdit.documentNumber || '');
        setPhone(itemToEdit.phone || '');
        setIsWhatsapp(itemToEdit.isWhatsapp ?? true);
        setCity(itemToEdit.city || '');
        setState(itemToEdit.state || '');
        setMapLink(itemToEdit.mapLink || '');
        setNotes(itemToEdit.notes || '');
      } else {
        setName(initialName || '');
        setDocumentType('CNPJ');
        setDocumentNumber('');
        setPhone('');
        setIsWhatsapp(true);
        setCity('');
        setState('');
        setMapLink('');
        setNotes('');
      }
    }
  }, [isOpen, itemToEdit, initialName]);

  const handleDocumentChange = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (documentType === 'CPF') {
      setDocumentNumber(formatCPF(raw));
    } else {
      setDocumentNumber(formatCpfCnpj(raw));
    }
  };

  const handleDocumentTypeSwitch = (newType: 'CNPJ' | 'CPF') => {
    setDocumentType(newType);
    const raw = documentNumber.replace(/\D/g, '');
    if (newType === 'CPF') {
      setDocumentNumber(formatCPF(raw.slice(0, 11)));
    } else {
      setDocumentNumber(formatCpfCnpj(raw.slice(0, 14)));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('O Nome do Local é obrigatório.');
      return;
    }

    onSave({
      ...(itemToEdit ? { id: itemToEdit.id } : {}),
      name: name.trim(),
      documentType,
      documentNumber: documentNumber.trim(),
      phone: phone.trim() || undefined,
      isWhatsapp,
      type: 'ambos', // Sempre Ambos
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      mapLink: mapLink.trim() ? cleanOrShortenLocationInput(mapLink.trim()) : undefined,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">
                {itemToEdit ? 'Editar Expedidor / Recebedor' : 'Novo Expedidor / Recebedor'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cadastro do local de carga/descarga, documento e contato
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Nome do Local */}
          <div>
            <label className="block text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
              Nome do Local <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Fazenda Santa Maria, Porto de Santos, Terminal 02..."
              className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs text-sm font-medium"
              required
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Nome informado no campo de origem ou destino das cargas.
            </p>
          </div>

          {/* Classificação do Local (Sempre Ambos) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
              Classificação do Local
            </label>
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                <span className="text-sm font-bold text-blue-900 dark:text-blue-200">
                  Ambos (Expedidor e Recebedor)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-md">
                Coleta & Entrega
              </span>
            </div>
          </div>

          {/* Documento (CNPJ ou CPF) */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Documento do Local</span>
              </label>
              <div className="flex bg-gray-200/80 dark:bg-gray-800 p-0.5 rounded-xl border border-gray-300/50 dark:border-gray-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => handleDocumentTypeSwitch('CNPJ')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    documentType === 'CNPJ'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  CNPJ
                </button>
                <button
                  type="button"
                  onClick={() => handleDocumentTypeSwitch('CPF')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    documentType === 'CPF'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  CPF
                </button>
              </div>
            </div>

            <div>
              <input
                type="text"
                value={documentNumber}
                onChange={e => handleDocumentChange(e.target.value)}
                placeholder={documentType === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                maxLength={documentType === 'CNPJ' ? 18 : 14}
                className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Telefone e WhatsApp */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
            <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Número de Telefone</span>
            </label>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="flex-1">
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Toggle WhatsApp com alto contraste */}
              <button
                type="button"
                onClick={() => setIsWhatsapp(!isWhatsapp)}
                className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  isWhatsapp
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 shadow-sm shadow-emerald-600/30'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isWhatsapp ? 'É WhatsApp' : 'Não é WhatsApp'}</span>
                {isWhatsapp && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </button>
            </div>

            {/* Aviso visual nítido do PDF */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Este telefone <strong>não será exibido</strong> no PDF da Ordem de Carregamento para garantir privacidade.
              </span>
            </div>
          </div>

          {/* Cidade e Link do Maps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1">
                Cidade (Opcional)
              </label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Ex: Rio Verde, GO"
                list="modal-sr-cities-list"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="modal-sr-cities-list">
                {BRAZILIAN_CITIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1">
                Link do Google Maps (Opcional)
              </label>
              <input
                type="text"
                value={mapLink}
                onChange={e => setMapLink(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1">
              Observações / Ponto de Referência
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Instruções de portaria, horários ou referências..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Botões do Rodapé */}
          <div className="flex gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-semibold text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition active:scale-95 cursor-pointer"
            >
              {itemToEdit ? 'Salvar Alterações' : 'Salvar Local'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShipperReceiverFormModal;
