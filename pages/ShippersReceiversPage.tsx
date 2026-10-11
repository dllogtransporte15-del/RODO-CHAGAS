import React, { useState, useEffect, useMemo } from 'react';
import Header from '../components/Header';
import { 
  Building2, Plus, Search, Edit2, Trash2, MapPin, Phone, 
  MessageCircle, ExternalLink, FileText, CheckCircle2, Navigation
} from 'lucide-react';
import type { ShipperReceiver, User, ProfilePermissions } from '../types';
import { can } from '../auth';
import { 
  fetchShipperReceivers, saveShipperReceiver, deleteShipperReceiver 
} from '../utils/shipperReceiverStorage';
import ShipperReceiverFormModal from '../components/ShipperReceiverFormModal';
import { useToast } from '../hooks/useToast';

interface ShippersReceiversPageProps {
  currentUser: User | null;
  profilePermissions: ProfilePermissions;
}

const ShippersReceiversPage: React.FC<ShippersReceiversPageProps> = ({
  currentUser,
  profilePermissions,
}) => {
  const [items, setItems] = useState<ShipperReceiver[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<ShipperReceiver | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const canCreate = can('create', currentUser, 'shippers-receivers', profilePermissions);
  const canUpdate = can('update', currentUser, 'shippers-receivers', profilePermissions);
  const canDelete = can('delete', currentUser, 'shippers-receivers', profilePermissions);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchShipperReceivers();
      setItems(data);
    } catch (err) {
      console.error('Error loading shipper/receivers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenNew = () => {
    setItemToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: ShipperReceiver) => {
    setItemToEdit(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Deseja realmente excluir o local "${name}"?`)) {
      try {
        await deleteShipperReceiver(id);
        setItems(prev => prev.filter(i => i.id !== id));
        showToast(`Local "${name}" excluído com sucesso.`, 'success');
      } catch (err) {
        showToast('Erro ao excluir local.', 'error');
      }
    }
  };

  const handleSave = async (data: Omit<ShipperReceiver, 'id' | 'createdAt'> & { id?: string }) => {
    try {
      const saved = await saveShipperReceiver(data);
      setItems(prev => {
        const filtered = prev.filter(i => i.id !== saved.id);
        return [saved, ...filtered];
      });
      showToast(`Local "${saved.name}" salvo com sucesso!`, 'success');
    } catch (err) {
      showToast('Erro ao salvar cadastro.', 'error');
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filterType !== 'all') {
        if (filterType === 'expedidor' && item.type !== 'expedidor' && item.type !== 'ambos') return false;
        if (filterType === 'recebedor' && item.type !== 'recebedor' && item.type !== 'ambos') return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = item.name?.toLowerCase().includes(term);
        const matchDoc = item.documentNumber?.replace(/\D/g, '').includes(term.replace(/\D/g, ''));
        const matchPhone = item.phone?.replace(/\D/g, '').includes(term.replace(/\D/g, ''));
        const matchCity = item.city?.toLowerCase().includes(term);
        return matchName || matchDoc || matchPhone || matchCity;
      }

      return true;
    });
  }, [items, searchTerm, filterType]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header title="Cadastro de Expedidor / Recebedor">
        {canCreate && (
          <button
            onClick={handleOpenNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold shadow-md shadow-primary/20 transition active:scale-95 text-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Expedidor / Recebedor
          </button>
        )}
      </Header>

      {/* Info Banner */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/10 rounded-2xl border border-blue-100 dark:border-blue-900/40 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Gestão de Locais de Carga e Descarga
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Registra os "Nomes de Locais" informados no cadastro de cargas, com CNPJ/CPF e telefone WhatsApp.
              No PDF da Ordem de Carregamento, o nome do local será exibido sem expor o número de telefone.
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-800 dark:text-blue-300">
          <span>{items.length} cadastrados</span>
        </div>
      </div>

      {/* Controls: Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome do local, CNPJ/CPF, cidade..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 self-start sm:self-auto text-xs font-semibold">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'expedidor', label: 'Expedidores' },
            { id: 'recebedor', label: 'Recebedores' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 rounded-lg transition ${
                filterType === f.id
                  ? 'bg-white dark:bg-gray-700 text-primary dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List / Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium">Carregando locais...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-400 flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-gray-800 dark:text-white">
              Nenhum Expedidor ou Recebedor encontrado
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
              {searchTerm 
                ? 'Nenhum resultado corresponde à sua busca.' 
                : 'Cadastre fazendas, portos, armazéns e clientes destinatários com seus dados fiscais e contatos.'}
            </p>
            {canCreate && !searchTerm && (
              <button
                onClick={handleOpenNew}
                className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition"
              >
                Cadastrar Primeiro Local
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-900/60 text-gray-700 dark:text-gray-300 text-xs uppercase font-bold border-b border-gray-200 dark:border-gray-700">
                  <th className="py-3.5 px-6">Nome do Local</th>
                  <th className="py-3.5 px-6">Classificação</th>
                  <th className="py-3.5 px-6">Documento</th>
                  <th className="py-3.5 px-6">Telefone (WhatsApp)</th>
                  <th className="py-3.5 px-6">Cidade / Localização</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                {filteredItems.map(item => (
                  <tr 
                    key={item.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-gray-700/40 transition group"
                  >
                    <td className="py-4 px-6 font-semibold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-primary dark:text-blue-300 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <span>{item.name}</span>
                          {item.notes && (
                            <p className="text-xs text-gray-400 font-normal line-clamp-1">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        item.type === 'expedidor' 
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          : item.type === 'recebedor'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                      }`}>
                        {item.type === 'expedidor' ? 'Expedidor' : item.type === 'recebedor' ? 'Recebedor' : 'Ambos'}
                      </span>
                    </td>

                    <td className="py-4 px-6 font-mono text-xs">
                      {item.documentNumber ? (
                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                          <span className="font-bold text-[10px] uppercase bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-gray-500">
                            {item.documentType}
                          </span>
                          <span>{item.documentNumber}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Não informado</span>
                      )}
                    </td>

                    <td className="py-4 px-6">
                      {item.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{item.phone}</span>
                          {item.isWhatsapp && (
                            <span 
                              title="Contato via WhatsApp" 
                              className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            >
                              <MessageCircle className="w-3 h-3 fill-emerald-600/30 text-emerald-600" />
                              WhatsApp
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Sem telefone</span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-xs text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        {item.city && <span>{item.city}</span>}
                        {item.mapLink && (
                          <a
                            href={item.mapLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir no Google Maps"
                            className="text-primary hover:text-blue-700 inline-flex items-center gap-1 font-semibold"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Mapa</span>
                          </a>
                        )}
                        {!item.city && !item.mapLink && (
                          <span className="text-gray-400 italic">-</span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <button
                            onClick={() => handleEdit(item)}
                            title="Editar"
                            className="p-1.5 text-gray-400 hover:text-primary dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(item.id, item.name)}
                            title="Excluir"
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <ShipperReceiverFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        itemToEdit={itemToEdit}
      />
    </div>
  );
};

export default ShippersReceiversPage;
