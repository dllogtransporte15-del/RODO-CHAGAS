
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Cargo, Client, Product, Shipment, User } from '../types';
import { DailyScheduleType, CargoStatus, UserProfile, ShipmentStatus, FreightPricingType } from '../types';
import VolumeBar from './VolumeBar';
import { Trash2, Eye, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import { PlusIcon } from './icons/PlusIcon';
import { HistoryIcon } from './icons/HistoryIcon';
import { Search, Filter, X, ChevronLeft, ChevronRight, ArrowUpDown, MapPin, Calendar } from 'lucide-react';
import MultiSelectDropdown from './MultiSelectDropdown';
import { StayRecord } from '../utils/toolStorage';
import type { Ticket } from '../types';
import { TicketStatus } from '../types';
import { AlertCircle } from 'lucide-react';
import { getCoordsSync, calculateDistanceKm } from '../utils/geocoding';

interface LoadTableProps {
  loads: Cargo[];
  clients: Client[];
  products: Product[];
  shipments: Shipment[];
  dailyBalanceDate: string;
  onDailyBalanceDateChange: (date: string) => void;
  onCreateShipment?: (load: Cargo) => void;
  onSuspend?: (load: Cargo) => void;
  onReactivate?: (load: Cargo) => void;
  onFinalize?: (load: Cargo) => void;
  onEdit?: (load: Cargo) => void;
  onClose?: (load: Cargo) => void;
  onShowHistory?: (load: Cargo) => void;
  onShowDetails?: (load: Cargo) => void;
  onEditSchedule?: (load: Cargo) => void;
  onShowShipments?: (load: Cargo) => void;
  onRecommendDrivers?: (load: Cargo) => void;
  onDelete?: (cargoId: string) => void;
  onRequestLoadOrder?: (load: Cargo) => void;
  currentUser: User;
  users?: User[];
  stays?: StayRecord[];
  tickets?: Ticket[];
  onFilteredLoadsChange?: (loads: Cargo[]) => void;
}

const LoadTable: React.FC<LoadTableProps> = ({ loads, clients, products, shipments, dailyBalanceDate, onDailyBalanceDateChange, onCreateShipment, onSuspend, onReactivate, onFinalize, onEdit, onClose, onShowHistory, onShowDetails, onEditSchedule, onShowShipments, onRecommendDrivers, onDelete, onRequestLoadOrder, currentUser, users = [], stays = [], tickets = [], onFilteredLoadsChange }) => {
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [quickStatusFilter, setQuickStatusFilter] = useState<'all' | 'L' | 'F' | 'V' | 'SP' | 'S'>('all');
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenActionMenu(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenActionMenu(null);
    };
    if (openActionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openActionMenu]);

  const shiftDailyDate = (days: number) => {
    const d = new Date(dailyBalanceDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    onDailyBalanceDateChange(d.toISOString().split('T')[0]);
  };
  
  const [showFilters, setShowFilters] = useState(false);
  const [filterId, setFilterId] = useState<string[]>([]);
  const [filterClient, setFilterClient] = useState<string[]>([]);
  const [filterProduct, setFilterProduct] = useState<string[]>([]);
  const [filterOrigin, setFilterOrigin] = useState<string[]>([]);
  const [filterDest, setFilterDest] = useState<string[]>([]);
  const [filterScheduleType, setFilterScheduleType] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<string>('default');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.nomeFantasia || 'N/A';
  const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || 'N/A';

  // Opções únicas baseadas nas cargas listadas
  const idOptions = Array.from(new Set(loads.map(l => l.sequenceId?.toString() || ''))).filter(Boolean).sort();
  const clientOptions = Array.from(new Set(loads.map(l => getClientName(l.clientId)))).filter(Boolean).sort();
  const productOptions = Array.from(new Set(loads.map(l => getProductName(l.productId)))).filter(Boolean).sort();
  const originOptions = Array.from(new Set(loads.map(l => l.origin))).filter(Boolean).sort();
  const destOptions = Array.from(new Set(loads.map(l => l.destination))).filter(Boolean).sort();
  const scheduleTypeOptions = [...Object.values(DailyScheduleType), 'Carga Suspensa'];

  const isMotorista = currentUser.profile === UserProfile.Motorista || String(currentUser.profile).toLowerCase() === 'motorista';
  const [searchTerm, setSearchTerm] = useState('');
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (isMotorista && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => setDriverCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 8000 }
      );
    }
  }, [isMotorista]);

  const quickStatusCounts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const counts = { all: loads.length, L: 0, F: 0, V: 0, SP: 0, S: 0 };
    loads.forEach(load => {
      if (load.status === CargoStatus.Suspensa) {
        counts.S++;
        return;
      }
      if (load.status === CargoStatus.Fechada) return;
      const hasCurrentOrFuture = load.dailySchedule?.some(ds => ds.date >= today);
      if (load.status === CargoStatus.EmAndamento && !hasCurrentOrFuture) {
        counts.SP++;
        return;
      }
      const info = load.dailySchedule?.find(ds => ds.date === dailyBalanceDate);
      if (info?.type === DailyScheduleType.Livre) counts.L++;
      else if (info?.type === DailyScheduleType.Fixo) counts.F++;
      else if (info?.type === DailyScheduleType.Verificar) counts.V++;
    });
    return counts;
  }, [loads, dailyBalanceDate]);

  const filteredLoads = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const filtered = loads.filter(load => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesId = String(load.sequenceId || '').toLowerCase().includes(term);
        const matchesClient = getClientName(load.clientId).toLowerCase().includes(term);
        const matchesOrigin = load.origin.toLowerCase().includes(term);
        const matchesDest = load.destination.toLowerCase().includes(term);
        const matchesProd = getProductName(load.productId).toLowerCase().includes(term);
        const matchesRecipient = (load.recipientClient || '').toLowerCase().includes(term);
        if (!matchesId && !matchesClient && !matchesOrigin && !matchesDest && !matchesProd && !matchesRecipient) return false;
      }
      if (!isMotorista && quickStatusFilter !== 'all') {
        if (quickStatusFilter === 'S') {
          if (load.status !== CargoStatus.Suspensa) return false;
        } else if (quickStatusFilter === 'SP') {
          const hasCurrentOrFuture = load.dailySchedule?.some(ds => ds.date >= today);
          if (!(load.status === CargoStatus.EmAndamento && !hasCurrentOrFuture)) return false;
        } else {
          if (load.status === CargoStatus.Suspensa || load.status === CargoStatus.Fechada) return false;
          const info = load.dailySchedule?.find(ds => ds.date === dailyBalanceDate);
          const expectedType =
            quickStatusFilter === 'L' ? DailyScheduleType.Livre :
            quickStatusFilter === 'F' ? DailyScheduleType.Fixo :
            DailyScheduleType.Verificar;
          if (!info || info.type !== expectedType) return false;
        }
      }
      if (filterId.length > 0 && !filterId.includes(load.sequenceId?.toString() || '')) return false;
      if (filterClient.length > 0 && !filterClient.includes(getClientName(load.clientId))) return false;
      if (filterProduct.length > 0 && !filterProduct.includes(getProductName(load.productId))) return false;
      if (filterOrigin.length > 0 && !filterOrigin.includes(load.origin)) return false;
      if (filterDest.length > 0 && !filterDest.includes(load.destination)) return false;
      if (filterScheduleType.length > 0) {
        const isSuspended = load.status === CargoStatus.Suspensa;
        if (isSuspended) {
          const matchesSuspended = filterScheduleType.some(t => 
            t === 'Carga Suspensa' || t === 'Cargas Suspensas' || t === 'Suspensa' || t === 'Demanda Suspensa'
          );
          if (!matchesSuspended) return false;
        } else {
          const dailyScheduleInfo = load.dailySchedule?.find(ds => ds.date === dailyBalanceDate);
          if (!dailyScheduleInfo || !filterScheduleType.includes(dailyScheduleInfo.type)) return false;
        }
      }
      return true;
    });

    if (sortKey === 'default') {
      if (isMotorista && driverCoords) {
        return [...filtered].sort((a, b) => {
          const coordA = a.originCoords || getCoordsSync(a.origin);
          const coordB = b.originCoords || getCoordsSync(b.origin);
          const distA = (coordA && calculateDistanceKm(driverCoords, coordA)) ?? 99999;
          const distB = (coordB && calculateDistanceKm(driverCoords, coordB)) ?? 99999;
          return distA - distB;
        });
      }
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      let valA = '';
      let valB = '';
      if (sortKey === 'id') { valA = (a.sequenceId ?? 0).toString().padStart(10, '0'); valB = (b.sequenceId ?? 0).toString().padStart(10, '0'); }
      else if (sortKey === 'client') { valA = getClientName(a.clientId); valB = getClientName(b.clientId); }
      else if (sortKey === 'product') { valA = getProductName(a.productId); valB = getProductName(b.productId); }
      else if (sortKey === 'origin') { valA = a.origin; valB = b.origin; }
      else if (sortKey === 'destination') { valA = a.destination; valB = b.destination; }
      else if (sortKey === 'createdAt') { valA = a.createdAt || ''; valB = b.createdAt || ''; }
      const cmp = valA.localeCompare(valB, 'pt-BR', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [loads, filterId, filterClient, filterProduct, filterOrigin, filterDest, filterScheduleType, quickStatusFilter, dailyBalanceDate, clients, products, sortKey, sortDir, isMotorista, searchTerm, driverCoords]);

  useEffect(() => {
    onFilteredLoadsChange?.(filteredLoads);
  }, [filteredLoads, onFilteredLoadsChange]);

  const driverCargoIdsWithShipment = useMemo(() => {
    if (!isMotorista) return new Set<string>();
    const driverCpfClean = (currentUser.email || '').replace(/\D/g, '');
    return new Set(
      shipments
        .filter(s => 
          (s.driverCpf || '').replace(/\D/g, '') === driverCpfClean &&
          s.status !== ShipmentStatus.Cancelado
        )
        .map(s => s.cargoId)
    );
  }, [currentUser, shipments]);

  const activeFiltersCount = (filterId.length > 0 ? 1 : 0) + (filterClient.length > 0 ? 1 : 0) + (filterProduct.length > 0 ? 1 : 0) + (filterOrigin.length > 0 ? 1 : 0) + (filterDest.length > 0 ? 1 : 0) + (filterScheduleType.length > 0 ? 1 : 0);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredLoads]);

  const totalPages = Math.ceil(filteredLoads.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedLoads = filteredLoads.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

  const clearFilters = () => {
      setFilterId([]);
      setFilterClient([]);
      setFilterProduct([]);
      setFilterOrigin([]);
      setFilterDest([]);
      setFilterScheduleType([]);
      setQuickStatusFilter('all');
      setSearchTerm('');
      setSortKey('default');
      setSortDir('asc');
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  }

  const statusSymbols: { [key in DailyScheduleType]: string } = {
    [DailyScheduleType.Livre]: 'L',
    [DailyScheduleType.Fixo]: 'F',
    [DailyScheduleType.Verificar]: 'V',
  };

  const statusSymbolColors: { [key in DailyScheduleType]: string } = {
    [DailyScheduleType.Livre]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    [DailyScheduleType.Fixo]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    [DailyScheduleType.Verificar]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  };

  return (
    <div className="space-y-4">
      {isMotorista && (
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-5 h-5 text-cyan-500 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar Carga (Origem, Destino, Produto...)"
            className="w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 pl-11 pr-10 py-3.5 rounded-2xl border border-gray-200 dark:border-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none text-sm transition-all shadow-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white bg-gray-100 dark:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="relative z-[45] flex flex-col bg-white/95 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-lg shadow-slate-900/5 dark:shadow-black/20 border border-slate-200/80 dark:border-slate-700/60">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-4 gap-3">
          {/* Left: Quick Search + Advanced Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            {!isMotorista && (
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por #ID, cliente, produto, origem ou destino..."
                  className="w-full pl-9 pr-8 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/40 shadow-sm'
                  : 'bg-slate-50 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filtros Avançados {activeFiltersCount > 0 && `(${activeFiltersCount})`}</span>
            </button>
          </div>

          {/* Right: Daily Balance Date Navigator & Count */}
          <div className="flex flex-wrap items-center gap-3 justify-between lg:justify-end">
            {!isMotorista && (
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-2 pr-1 hidden sm:inline">
                  Balanço:
                </span>
                <button
                  type="button"
                  onClick={() => shiftDailyDate(-1)}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors"
                  title="Dia anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div className="relative flex items-center">
                  <Calendar className="w-3.5 h-3.5 text-blue-500 absolute left-2 pointer-events-none" />
                  <input
                    type="date"
                    value={dailyBalanceDate}
                    onChange={(e) => onDailyBalanceDateChange(e.target.value)}
                    className="pl-7 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => shiftDailyDate(1)}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors"
                  title="Próximo dia"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDailyBalanceDateChange(new Date().toISOString().split('T')[0])}
                  className="px-2 py-1 text-[11px] font-bold rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
                  title="Ir para hoje"
                >
                  Hoje
                </button>
              </div>
            )}
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/60">
              {filteredLoads.length !== loads.length ? `${filteredLoads.length} de ` : ''}{loads.length} cargas
            </div>
          </div>
        </div>

        {/* Quick Status Filter Pills */}
        {!isMotorista && (
          <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'Todas', count: quickStatusCounts.all, activeClass: 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' },
                { id: 'L', label: 'Livres (L)', count: quickStatusCounts.L, activeClass: 'bg-blue-600 text-white' },
                { id: 'F', label: 'Fixas (F)', count: quickStatusCounts.F, activeClass: 'bg-emerald-600 text-white' },
                { id: 'V', label: 'Verificar (V)', count: quickStatusCounts.V, activeClass: 'bg-amber-500 text-white' },
                { id: 'SP', label: 'Sem Prog.', count: quickStatusCounts.SP, activeClass: 'bg-rose-600 text-white' },
                { id: 'S', label: 'Suspensas', count: quickStatusCounts.S, activeClass: 'bg-yellow-600 text-white' },
              ] as const
            ).map((pill) => {
              const isSelected = quickStatusFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setQuickStatusFilter(pill.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    isSelected
                      ? `${pill.activeClass} shadow-sm`
                      : 'bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <span>{pill.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                      isSelected ? 'bg-white/20 text-white dark:bg-black/15' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Expandable Filters Section */}
        {showFilters && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${isMotorista ? 'lg:grid-cols-2' : 'lg:grid-cols-3 xl:grid-cols-6'} gap-4`}>
                    {!isMotorista && (
                      <>
                        <MultiSelectDropdown label="ID da Carga" options={idOptions} selectedValues={filterId} onChange={setFilterId} placeholder="Todos os IDs..." />
                        <MultiSelectDropdown label="Nome do Cliente" options={clientOptions} selectedValues={filterClient} onChange={setFilterClient} placeholder="Todos os Clientes..." />
                        <MultiSelectDropdown label="Nome do Produto" options={productOptions} selectedValues={filterProduct} onChange={setFilterProduct} placeholder="Todos os Produtos..." />
                      </>
                    )}
                    <MultiSelectDropdown label="Cidade de Origem" options={originOptions} selectedValues={filterOrigin} onChange={setFilterOrigin} placeholder="Todas as Origens..." />
                    <MultiSelectDropdown label="Cidade de Destino" options={destOptions} selectedValues={filterDest} onChange={setFilterDest} placeholder="Todos os Destinos..." />
                    {!isMotorista && (
                      <MultiSelectDropdown label="Tipo de Programação" options={scheduleTypeOptions} selectedValues={filterScheduleType} onChange={setFilterScheduleType} placeholder="Todos os Tipos..." />
                    )}
                </div>
                {/* Ordenação */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 flex flex-wrap items-end gap-4">
                    <div className="flex items-center gap-2">
                        <ArrowUpDown className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ordenar por:</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <select
                            value={sortKey}
                            onChange={e => setSortKey(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary outline-none"
                        >
                            <option value="default">Padrão (sem ordenação)</option>
                            {currentUser.profile !== UserProfile.Motorista && <option value="id">ID da Carga</option>}
                            {currentUser.profile !== UserProfile.Motorista && <option value="client">Nome do Cliente</option>}
                            {currentUser.profile !== UserProfile.Motorista && <option value="product">Nome do Produto</option>}
                            <option value="origin">Cidade de Origem</option>
                            <option value="destination">Cidade de Destino</option>
                            <option value="createdAt">Data de Criação</option>
                        </select>
                        {sortKey !== 'default' && (
                            <select
                                value={sortDir}
                                onChange={e => setSortDir(e.target.value as 'asc' | 'desc')}
                                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary outline-none"
                            >
                                <option value="asc">Crescente (A → Z)</option>
                                <option value="desc">Decrescente (Z → A)</option>
                            </select>
                        )}
                    </div>
                    {(activeFiltersCount > 0 || sortKey !== 'default') && (
                        <button onClick={clearFilters} className="ml-auto text-sm flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                            <X className="w-4 h-4" /> Limpar Tudo
                        </button>
                    )}
                </div>
            </div>
        )}
      </div>

      <div className="space-y-3">
        {paginatedLoads.map((load) => {
          const loadShipments = shipments.filter(s => s.cargoId === load.id && s.status !== ShipmentStatus.Cancelado);
          const effectiveScheduledVolume = loadShipments.reduce((sum, s) => sum + (Number(s.shipmentTonnage) || 0), 0);
          const effectiveLoadedVolume = loadShipments
            .filter(s => Object.values(ShipmentStatus).indexOf(s.status) >= Object.values(ShipmentStatus).indexOf(ShipmentStatus.AguardandoDescarga))
            .reduce((sum, s) => sum + (Number(s.shipmentTonnage) || 0), 0);
          const scheduledButNotLoaded = Math.max(0, effectiveScheduledVolume - effectiveLoadedVolume);
          const availableVolume = Math.max(0, (Number(load.totalVolume) || 0) - effectiveScheduledVolume);
          
          const dailyScheduledTonnage = shipments
            .filter(s => s.cargoId === load.id && s.scheduledDate === dailyBalanceDate && s.status !== ShipmentStatus.Cancelado)
            .reduce((sum, s) => sum + (Number(s.shipmentTonnage) || 0), 0);
          const dailyScheduleInfo = load.dailySchedule?.find(ds => ds.date === dailyBalanceDate);

          const freightLegsToDisplay = (load.freightLegs && load.freightLegs.length > 0)
            ? load.freightLegs
            : [{
                companyFreightValuePerTon: load.companyFreightValuePerTon,
                driverFreightValuePerTon: load.driverFreightValuePerTon,
                hasIcms: load.hasIcms,
                icmsPercentage: load.icmsPercentage,
              }];
              
          const totalDriverFreight = freightLegsToDisplay.reduce((sum, leg) => sum + leg.driverFreightValuePerTon, 0);
          const totalNetCompanyValue = freightLegsToDisplay.reduce((sum, leg) => {
              const icmsRate = leg.hasIcms ? leg.icmsPercentage / 100 : 0;
              return sum + (leg.companyFreightValuePerTon * (1 - icmsRate));
          }, 0);

          const totalCommission = load.salespersonCommissionPerTon || 0;
          
          // Calculate average demurrage profit per ton for this load's shipments
          const loadShipmentIds = new Set(loadShipments.map(s => s.id));
          const totalDemurrageProfit = stays
              .filter(s => s.shipmentId && loadShipmentIds.has(s.shipmentId))
              .reduce((sum, s) => sum + ((s.approvedValue || 0) - (s.driverPaidValue || 0)), 0);
          const totalDemurrageRevenue = stays
              .filter(s => s.shipmentId && loadShipmentIds.has(s.shipmentId))
              .reduce((sum, s) => sum + (s.approvedValue || 0), 0);
              
          const loadedTonnage = loadShipments.reduce((sum, s) => sum + (s.shipmentTonnage || 1), 0);
          
          const demurrageProfitPerTon = loadedTonnage > 0 ? (totalDemurrageProfit / loadedTonnage) : 0;
          const demurrageRevenuePerTon = loadedTonnage > 0 ? (totalDemurrageRevenue / loadedTonnage) : 0;
          
          const totalDriverFreightPJ = freightLegsToDisplay.reduce(
            (sum, leg) => sum + (leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon ?? 0),
            0
          );
          const totalDriverFreightPF = freightLegsToDisplay.reduce(
            (sum, leg) => sum + (leg.driverFreightValuePerTonPF ?? leg.driverFreightValuePerTon ?? 0),
            0
          );

          const computeMarginInfo = (driverTotalRate: number) => {
            let m = 0;
            let profit = 0;

            if (load.freightPricingType === FreightPricingType.FreteFechado) {
              const compFixed = Number(load.fixedCompanyFreight) || Number(load.companyFreightValuePerTon) || 0;
              const icmsPct = load.hasIcms ? (Number(load.icmsPercentage) || 0) / 100 : 0;
              const netComp = compFixed * (1 - icmsPct);
              profit = netComp - driverTotalRate;
              m = netComp > 0 ? (profit / netComp) * 100 : 0;
            } else if (load.freightPricingType === FreightPricingType.VlrTonIcms) {
              const baseComp = load.companyFreightValuePerTon || 0;
              profit = baseComp - driverTotalRate - totalCommission;
              m = baseComp > 0 ? (profit / baseComp) * 100 : 0;
            } else {
              profit = totalNetCompanyValue - driverTotalRate - totalCommission + demurrageProfitPerTon;
              const totalCompanyFreightWithEstadias = totalNetCompanyValue + demurrageRevenuePerTon;
              m = totalCompanyFreightWithEstadias > 0 ? (profit / totalCompanyFreightWithEstadias) * 100 : 0;
            }

            const pctStr = isNaN(m) || !isFinite(m) ? '0,00%' : `${m.toFixed(2).replace('.', ',')}%`;
            let colorClass = 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800';
            if (!isNaN(m) && isFinite(m)) {
              if (m < 5) colorClass = 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
              else if (m < 6) colorClass = 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30';
              else if (m < 7) colorClass = 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30';
              else colorClass = 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
            }
            return { profit, pctStr, colorClass };
          };

          const pjRateForMargin =
            load.freightPricingType === FreightPricingType.FreteFechado
              ? Number(load.fixedDriverFreightPJ ?? load.fixedDriverFreight ?? load.driverFreightValuePerTon) || 0
              : load.freightPricingType === FreightPricingType.VlrTonIcms
              ? load.driverFreightValuePerTonPJ ?? load.driverFreightValuePerTon ?? 0
              : totalDriverFreightPJ;

          const pfRateForMargin =
            load.freightPricingType === FreightPricingType.FreteFechado
              ? Number(load.fixedDriverFreightPF ?? load.fixedDriverFreight ?? load.driverFreightValuePerTon) || 0
              : load.freightPricingType === FreightPricingType.VlrTonIcms
              ? load.driverFreightValuePerTonPF ?? load.driverFreightValuePerTon ?? 0
              : totalDriverFreightPF;

          const marginPJ = computeMarginInfo(pjRateForMargin);
          const marginPF = computeMarginInfo(pfRateForMargin);
          const netProfit = marginPJ.profit;

          const canViewCargoDetailsAndId = !isMotorista || driverCargoIdsWithShipment.has(load.id);

          if (isMotorista) {
            const prodName = getProductName(load.productId);
            const origCoords = load.originCoords || getCoordsSync(load.origin);
            const destCoords = load.destinationCoords || getCoordsSync(load.destination);
            const routeKm = (origCoords && destCoords) ? calculateDistanceKm(origCoords, destCoords) : null;
            const distFromDriver = (driverCoords && origCoords) ? calculateDistanceKm(driverCoords, origCoords) : null;

            return (
              <div key={load.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 transition-all duration-200 hover:shadow-md hover:border-cyan-500/30">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 flex-shrink-0">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{load.origin}</span>
                    </div>
                    <div className="ml-3 pl-3 border-l-2 border-dashed border-gray-300 dark:border-slate-700 py-0.5">
                      <div className="flex items-center gap-2 -ml-3 pl-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{load.destination}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
                      {prodName}
                    </span>
                    {canViewCargoDetailsAndId && load.sequenceId && (
                      <span className="text-[10px] font-bold text-cyan-500">#{load.sequenceId}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800 text-xs">
                  <div className="space-y-0.5 text-gray-500 dark:text-gray-400">
                    <p className="font-medium">
                      Rota: <span className="font-bold text-gray-800 dark:text-cyan-400">{routeKm ? `${routeKm} km` : 'Calculando...'}</span>
                    </p>
                    <p className="text-[11px]">
                      {distFromDriver !== null ? (
                        <>Está a <span className="font-bold text-emerald-600 dark:text-emerald-400">{distFromDriver} km</span> de você</>
                      ) : (
                        'Distância calculada'
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {load.freightPricingType === FreightPricingType.FreteFechado ? (
                      <div className="flex flex-col items-end text-xs font-extrabold tabular-nums">
                        <span className="text-blue-600 dark:text-blue-400">
                          PJ: R$ {(load.fixedDriverFreightPJ ?? load.fixedDriverFreight ?? load.driverFreightValuePerTon)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          PF: R$ {(load.fixedDriverFreightPF ?? load.fixedDriverFreight ?? load.driverFreightValuePerTon)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end text-xs font-extrabold tabular-nums">
                        <span className="text-blue-600 dark:text-blue-400">
                          PJ: R$ {(load.driverFreightValuePerTonPJ ?? load.driverFreightValuePerTon)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / ton
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          PF: R$ {(load.driverFreightValuePerTonPF ?? load.driverFreightValuePerTon)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / ton
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => onRequestLoadOrder?.(load)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                    >
                      <span>Solicitar Embarque</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          const todayStr = new Date().toISOString().split('T')[0];
          const hasCurrentOrFutureSchedule = load.dailySchedule?.some(ds => ds.date >= todayStr);
          const isNoSchedule = load.status === CargoStatus.EmAndamento && !hasCurrentOrFutureSchedule;
          const leftAccentColor =
            load.status === CargoStatus.Suspensa ? 'border-l-amber-500' :
            load.status === CargoStatus.Fechada ? 'border-l-slate-400' :
            isNoSchedule ? 'border-l-rose-500' :
            dailyScheduleInfo?.type === DailyScheduleType.Fixo ? 'border-l-emerald-500' :
            dailyScheduleInfo?.type === DailyScheduleType.Livre ? 'border-l-blue-500' :
            dailyScheduleInfo?.type === DailyScheduleType.Verificar ? 'border-l-amber-400' :
            'border-l-slate-600';

          const isCardExpanded = expandedCardId === load.id;
          const comName = users.find(u => u.id === load.createdById)?.name || 'N/A';
          const resolvedSupId = load.supervisorId || (load.history && load.history[0]?.userId);
          const supUser = resolvedSupId ? users.find(u => u.id === resolvedSupId) : null;
          const supName = (supUser && supUser.profile === UserProfile.Supervisor) ? supUser.name : 'N/A';

          return (
            <div key={load.id} className={`relative ${openActionMenu === load.id ? 'z-40' : 'z-0'} bg-white/95 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl shadow-sm hover:shadow-lg hover:shadow-slate-900/5 dark:hover:shadow-black/30 border border-slate-200/80 dark:border-slate-700/70 border-l-4 ${leftAccentColor} hover:border-blue-500/40 transition-all duration-200`}>
              <div className="flex flex-col lg:flex-row lg:items-center p-4 gap-4">
                {/* ID and Status */}
                <div className={`flex items-center gap-3 ${canViewCargoDetailsAndId ? 'min-w-[120px]' : ''}`}>
                  {canViewCargoDetailsAndId && (
                    <div className="flex flex-col">
                      <button 
                        onClick={() => onShowDetails?.(load)}
                        className="text-sm font-extrabold text-blue-600 dark:text-blue-400 hover:text-blue-500 hover:underline text-left tabular-nums"
                        title="Ver detalhes completos da carga"
                      >
                        #{load.sequenceId}
                      </button>
                      {tickets.some(t => t.cargoId === load.id && t.status !== TicketStatus.Fechado && t.status !== TicketStatus.Resolvido) && (
                        <span className="text-red-500 ml-1 inline-flex items-center" title="Chamado(s) Aberto(s)">
                          <AlertCircle className="w-4 h-4" />
                        </span>
                      )}
                      {currentUser.profile !== UserProfile.Motorista && (
                        <span className="text-[10px] text-slate-400 font-mono truncate w-20" title={load.id}>{load.id.substring(0, 8)}...</span>
                      )}
                    </div>
                  )}
                  <span 
                    className={`inline-flex items-center justify-center h-7 w-7 text-[11px] font-extrabold rounded-full shadow-sm transition-transform hover:scale-110 ${
                      load.status === CargoStatus.Suspensa ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300 ring-1 ring-yellow-500/30' :
                      load.status === CargoStatus.Fechada ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' :
                      isNoSchedule ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 ring-1 ring-rose-500/40' :
                      dailyScheduleInfo ? statusSymbolColors[dailyScheduleInfo.type] : 'bg-slate-100 text-slate-400 dark:bg-slate-700/60'
                    }`}
                    title={
                      load.status === CargoStatus.Suspensa ? 'Carga Suspensa' :
                      load.status === CargoStatus.Fechada ? 'Carga Fechada' :
                      isNoSchedule ? 'Sem Programação (Lançar programação para liberar)' :
                      dailyScheduleInfo ? `Programação: ${({ L: 'Livre', F: 'Fixo', V: 'Verificar' } as Record<string, string>)[statusSymbols[dailyScheduleInfo.type]] || statusSymbols[dailyScheduleInfo.type]}` :
                      'Sem programação para esta data'
                    }
                  >
                    {load.status === CargoStatus.Suspensa ? 'S' :
                      load.status === CargoStatus.Fechada ? 'F' :
                      isNoSchedule ? 'SP' :
                      dailyScheduleInfo ? statusSymbols[dailyScheduleInfo.type] : '-'}
                  </span>

                </div>

                {/* Client and Product */}
                <div className="flex-1 xl:flex-none xl:w-[240px] min-w-[190px]">
                  <div
                    onClick={onShowDetails ? () => onShowDetails(load) : undefined}
                    className={`text-sm font-bold text-slate-900 dark:text-white truncate ${onShowDetails ? 'cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 transition-colors' : ''}`}
                    title={getClientName(load.clientId)}
                  >
                    {getClientName(load.clientId)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" title={getProductName(load.productId)}>
                    {getProductName(load.productId)}
                  </div>
                </div>

                {/* Programação Futura (Calendário) */}
                <div 
                  className={`flex flex-col flex-1 min-w-[170px] gap-1 pt-3 xl:pt-0 mt-1 xl:mt-0 xl:px-4 border-t xl:border-t-0 xl:border-l xl:border-r border-slate-100 dark:border-slate-700/60 ${onEditSchedule ? 'hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group py-1 xl:rounded-lg xl:-my-1 relative xl:top-1 xl:bottom-1' : ''}`}
                  onClick={onEditSchedule ? () => onEditSchedule(load) : undefined}
                  role={onEditSchedule ? "button" : undefined}
                  title={onEditSchedule ? "Clique para editar a programação da carga" : undefined}
                >
                  <span className={`text-[9px] uppercase font-bold tracking-wider text-slate-400 w-full text-left ${onEditSchedule ? 'group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors' : ''}`}>Programação</span>
                  <div className="flex flex-wrap gap-1.5 w-full justify-start">
                    {(() => {
                      const upcoming = (load.dailySchedule || [])
                        .filter(ds => ds.date >= todayStr)
                        .sort((a, b) => a.date.localeCompare(b.date));
                        
                      const toShow = upcoming.slice(0, 3);
                      if (upcoming.length === 0) {
                         return <span className={`text-[11px] text-slate-400 font-medium italic mt-1 pb-1 ${onEditSchedule ? 'group-hover:text-slate-500 dark:group-hover:text-slate-300' : ''}`}>Sem lançamentos</span>;
                      }

                      return (
                        <>
                          {toShow.map((ds, idx) => {
                             const d = new Date(ds.date + 'T12:00:00Z');
                             const dayStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                             const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
                             const typeDisplay = ds.type === DailyScheduleType.Fixo ? `F ${ds.tonnage || 0}t` : (statusSymbols[ds.type as DailyScheduleType] || ds.type);
                             const chipHeaderClass =
                               ds.type === DailyScheduleType.Fixo
                                 ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                 : ds.type === DailyScheduleType.Verificar
                                 ? 'bg-amber-500/20 border-amber-500/30 text-amber-700 dark:text-amber-300'
                                 : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-700 dark:text-indigo-300';
                             
                             return (
                               <div key={idx} className="flex flex-col items-center overflow-hidden bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-600/80 rounded-lg shadow-sm w-[48px] h-[38px] shrink-0 hover:scale-105 hover:border-blue-400/60 transition-all" title={`Data: ${ds.date} | Tipo: ${ds.type} | Vol: ${ds.tonnage || 'Livre'}`}>
                                  <div className={`${chipHeaderClass} border-b w-full text-center h-[14px] flex items-center justify-center`}>
                                    <span className="text-[8px] font-extrabold uppercase tracking-wider">{weekday}</span>
                                  </div>
                                  <div className="w-full flex-1 flex flex-col items-center justify-center">
                                    <span className="text-[10px] font-bold text-slate-800 dark:text-slate-100 leading-none tracking-tighter tabular-nums">{dayStr}</span>
                                    <span className="text-[7px] font-bold text-slate-500 dark:text-slate-400 leading-none mt-[2px]">{typeDisplay}</span>
                                  </div>
                               </div>
                             );
                          })}
                          {upcoming.length > 3 && (
                             <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-600/80 rounded-lg w-[34px] h-[38px] shrink-0 hover:border-blue-400/60 transition-colors" title={`Mais ${upcoming.length - 3} lançamentos`}>
                               <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400">+{upcoming.length - 3}</span>
                             </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Route */}
                <div className="flex items-center gap-2.5 min-w-[230px] lg:flex-1 text-xs py-2 lg:py-0 border-t border-slate-100 lg:border-t-0 dark:border-slate-700/50">
                  <div className="text-left lg:text-right flex-1 min-w-0">
                    <div className="text-slate-400 text-[9px] uppercase font-bold tracking-wider">Origem</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 whitespace-normal break-words leading-snug" title={load.origin}>{load.origin}</div>
                  </div>
                  <div className="flex items-center gap-0.5 text-blue-500/70 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    <span className="w-3 h-[1.5px] bg-slate-300 dark:bg-slate-600" />
                    <span className="text-[11px] font-bold">→</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-400 text-[9px] uppercase font-bold tracking-wider">Destino</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 whitespace-normal break-words leading-snug" title={load.destination}>{load.destination}</div>
                    {load.recipientClient && (
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold whitespace-normal break-words leading-snug mt-0.5" title={`Cliente Destinatário: ${load.recipientClient}`}>
                        🏢 {load.recipientClient}
                      </div>
                    )}
                  </div>
                </div>

                {/* Responsáveis (Comercial e Supervisor) */}
                {currentUser.profile !== UserProfile.Motorista && currentUser.profile !== UserProfile.Cliente && (
                  <div className="flex flex-col text-[11px] min-w-[125px] max-w-[155px] truncate justify-center py-1 border-t lg:border-t-0 dark:border-slate-700/50">
                    <div className="flex items-center gap-1.5 truncate text-slate-700 dark:text-slate-300" title={`Comercial: ${comName}`}>
                      <span className="font-bold text-slate-400 text-[10px] uppercase shrink-0">Com:</span>
                      <span className="truncate font-semibold">{comName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate text-slate-700 dark:text-slate-300" title={`Supervisor: ${supName}`}>
                      <span className="font-bold text-indigo-500 dark:text-indigo-400 text-[10px] uppercase shrink-0">Sup:</span>
                      <span className="truncate font-semibold">{supName}</span>
                    </div>
                  </div>
                )}

                {/* Balanço Geral */}
                {currentUser.profile !== UserProfile.Motorista && (
                  <div className="min-w-[175px] space-y-1.5">
                    <div className="flex justify-between items-start text-[10px] font-bold text-slate-400 uppercase">
                      <span>Geral</span>
                      <div className="text-right tabular-nums">
                        <div className="text-slate-700 dark:text-slate-200">{formatNumber(effectiveLoadedVolume)} / {formatNumber(load.totalVolume)}</div>
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">Disp: {formatNumber(availableVolume)} ton</div>
                      </div>
                    </div>
                    <VolumeBar
                      loaded={effectiveLoadedVolume}
                      scheduled={scheduledButNotLoaded}
                      total={load.totalVolume}
                      onClick={onShowShipments ? () => onShowShipments(load) : undefined}
                    />
                  </div>
                )}

                {/* Balanço Diário */}
                {currentUser.profile !== UserProfile.Motorista && (
                  <div className="min-w-[175px] space-y-1.5 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase gap-2">
                      <span>Diário {dailyScheduleInfo?.type ? `(${dailyScheduleInfo.type})` : ''}</span>
                      <span className="text-blue-600 dark:text-blue-400 tabular-nums">
                        {dailyScheduleInfo?.tonnage 
                          ? `${formatNumber(dailyScheduledTonnage)} / ${formatNumber(dailyScheduleInfo.tonnage)} ton`
                          : `${formatNumber(dailyScheduledTonnage)} ton`}
                      </span>
                    </div>
                    <VolumeBar
                      loaded={dailyScheduledTonnage}
                      total={dailyScheduleInfo?.tonnage ? dailyScheduleInfo.tonnage : (dailyScheduledTonnage > 0 ? dailyScheduledTonnage : 1)}
                      scheduled={0}
                      loadedColor="bg-blue-500"
                      onClick={onShowShipments ? () => onShowShipments(load) : undefined}
                    />
                  </div>
                )}

                {/* Freight and Actions */}
                <div className="flex items-center justify-between lg:justify-end gap-3 min-w-[175px]">
                  <div className="text-right flex flex-col items-end">
                    <div className="flex items-center gap-1.5">
                      <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Frete</div>
                      {load.freightPricingType === FreightPricingType.FreteFechado && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Fixo</span>
                      )}
                      {load.freightPricingType === FreightPricingType.VlrTonIcms && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">+ICMS</span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 mt-0.5">
                      {currentUser.profile === UserProfile.Cliente ? (
                        <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                          {load.freightPricingType === FreightPricingType.FreteFechado
                            ? `${formatCurrency(load.fixedCompanyFreight || load.companyFreightValuePerTon)}`
                            : (load.freightPricingType === FreightPricingType.VlrTonIcms ? `${formatCurrency(load.companyFreightValuePerTon)}/t + ICMS` : `${formatCurrency(load.companyFreightValuePerTon)}/t`)}
                        </span>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 text-xs font-extrabold tabular-nums">
                            <span className="text-blue-600 dark:text-blue-400" title="Frete Motorista PJ (ETC)">
                              {load.freightPricingType === FreightPricingType.FreteFechado
                                ? `PJ: ${formatCurrency(load.fixedDriverFreightPJ ?? load.fixedDriverFreight ?? load.driverFreightValuePerTon)}`
                                : `PJ: ${formatCurrency(load.driverFreightValuePerTonPJ ?? load.driverFreightValuePerTon)}/t`}
                            </span>
                            {currentUser.profile !== UserProfile.Motorista && currentUser.profile !== UserProfile.Embarcador && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${marginPJ.colorClass}`}
                                title={`Margem PJ (ETC): ${marginPJ.pctStr} (${formatCurrency(marginPJ.profit)}/t)`}
                              >
                                {marginPJ.pctStr}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-extrabold tabular-nums">
                            <span className="text-emerald-600 dark:text-emerald-400" title="Frete Motorista PF (TAC)">
                              {load.freightPricingType === FreightPricingType.FreteFechado
                                ? `PF: ${formatCurrency(load.fixedDriverFreightPF ?? load.fixedDriverFreight ?? load.driverFreightValuePerTon)}`
                                : `PF: ${formatCurrency(load.driverFreightValuePerTonPF ?? load.driverFreightValuePerTon)}/t`}
                            </span>
                            {currentUser.profile !== UserProfile.Motorista && currentUser.profile !== UserProfile.Embarcador && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${marginPF.colorClass}`}
                                title={`Margem PF (TAC): ${marginPF.pctStr} (${formatCurrency(marginPF.profit)}/t)`}
                              >
                                {marginPF.pctStr}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setExpandedCardId(isCardExpanded ? null : load.id)}
                      className={`p-2 rounded-xl border transition-all ${
                        isCardExpanded
                          ? 'bg-blue-500/15 border-blue-500/40 text-blue-500'
                          : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                      }`}
                      title={isCardExpanded ? 'Recolher resumo rápido' : 'Expandir resumo e ações rápidas'}
                    >
                      {isCardExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    <div className="relative" ref={openActionMenu === load.id ? actionMenuRef : undefined}>
                      <button
                        type="button"
                        onClick={() => setOpenActionMenu(openActionMenu === load.id ? null : load.id)}
                        className={`p-2 rounded-xl transition-all border ${
                          openActionMenu === load.id
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                        }`}
                        title="Menu de ações"
                      >
                        <PlusIcon className={`h-4 w-4 transition-transform duration-200 ${openActionMenu === load.id ? 'rotate-45' : ''}`} />
                      </button>
                    
                    {openActionMenu === load.id && (
                      <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-2xl bg-white dark:bg-slate-800 ring-1 ring-black/10 dark:ring-white/10 z-50 overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="py-1">
                          {onShowHistory && (
                            <button onClick={() => { onShowHistory(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                              <HistoryIcon className="h-4 w-4" /> Histórico
                            </button>
                          )}
                          {onEdit && (
                            <button onClick={() => { onEdit(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Editar Carga
                            </button>
                          )}
                          {onEditSchedule && (
                            <button onClick={() => { onEditSchedule(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Editar Programação
                            </button>
                          )}
                          {onCreateShipment && load.status === CargoStatus.EmAndamento && (
                            <button onClick={() => { onCreateShipment(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-primary dark:text-blue-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
                              Novo Embarque
                            </button>
                          )}
                          {onRequestLoadOrder && currentUser.profile === UserProfile.Motorista && load.status === CargoStatus.EmAndamento && (
                            <button onClick={() => { onRequestLoadOrder(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-700">
                              Solicitar Embarque
                            </button>
                          )}
                          {onRecommendDrivers && load.status === CargoStatus.EmAndamento && (
                            <button onClick={() => { onRecommendDrivers(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
                              Motoristas Indicados
                            </button>
                          )}
                          {onSuspend && load.status === CargoStatus.EmAndamento && (
                            <button onClick={() => { onSuspend(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Suspender Carga
                            </button>
                          )}
                          {onReactivate && (load.status === CargoStatus.Suspensa || load.status === CargoStatus.Fechada) && (
                            <button onClick={() => { onReactivate(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Reativar Carga
                            </button>
                          )}
                          {onFinalize && (
                            <button onClick={() => { onFinalize(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Finalizar Carga
                            </button>
                          )}
                          {onClose && (
                            <button onClick={() => { onClose(load); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                              Fechar Carga
                            </button>
                          )}
                          {onDelete && currentUser.profile === UserProfile.Admin && (
                            <button onClick={() => { onDelete(load.id); setOpenActionMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-700 dark:text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center gap-2">
                              <Trash2 className="h-4 w-4" /> Excluir Carga
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expandable Quick Summary & Quick Actions */}
              {isCardExpanded && (
                <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-900/40 rounded-b-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-bold mr-1">Embarques Ativos:</span>
                      <span className="font-bold text-slate-800 dark:text-white">{loadShipments.length}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-bold mr-1">Agendado (não carregado):</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">{formatNumber(scheduledButNotLoaded)} t</span>
                    </div>
                    {currentUser.profile !== UserProfile.Cliente && currentUser.profile !== UserProfile.Motorista && currentUser.profile !== UserProfile.Embarcador && (
                      <div>
                        <span className="text-slate-400 uppercase text-[10px] font-bold mr-1">Lucro Líq. Est.:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(netProfit)}/t</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onShowDetails && (
                      <button
                        type="button"
                        onClick={() => onShowDetails(load)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detalhes</span>
                      </button>
                    )}
                    {onShowShipments && (
                      <button
                        type="button"
                        onClick={() => onShowShipments(load)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Embarques ({loadShipments.length})</span>
                      </button>
                    )}
                    {onCreateShipment && load.status === CargoStatus.EmAndamento && (
                      <button
                        type="button"
                        onClick={() => onCreateShipment(load)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
                      >
                        <PlusIcon className="w-3.5 h-3.5" />
                        <span>Novo Embarque</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 gap-4 rounded-lg shadow-sm border mt-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Mostrando <span className="font-medium">{(safeCurrentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(safeCurrentPage * itemsPerPage, filteredLoads.length)}</span> de <span className="font-medium">{filteredLoads.length}</span> cargas
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={safeCurrentPage === 1}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Página {safeCurrentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={safeCurrentPage === totalPages}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadTable;
