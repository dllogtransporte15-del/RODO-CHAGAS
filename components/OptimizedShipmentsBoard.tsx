import React, { useState, useMemo, useCallback } from 'react';
import type { Shipment, Cargo, Client, Product, Driver, Vehicle, User } from '../types';
import { ShipmentStatus, REQUIRED_DOCUMENT_MAP } from '../types';
import { 
  Search, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Check, 
  Paperclip, 
  Eye, 
  LayoutGrid, 
  ListFilter, 
  ArrowRight, 
  MapPin, 
  Building2, 
  Phone, 
  Share2, 
  ShieldCheck, 
  FileCheck2, 
  Receipt, 
  Wallet, 
  Truck, 
  Sparkles,
  UserCheck
} from 'lucide-react';
import { WhatsAppIcon } from './icons/WhatsAppIcon';

export interface BoardColumnConfig {
  id: string;
  title: string;
  status: ShipmentStatus;
  thresholds?: { yellow: number; red: number }; // in minutes
  colorTheme?: 'blue' | 'amber' | 'purple' | 'emerald' | 'indigo' | 'rose' | 'cyan';
  icon?: React.ReactNode;
}

export interface OptimizedShipmentsBoardProps {
  columns: BoardColumnConfig[];
  shipments: Shipment[];
  cargos: Cargo[];
  clients: Client[];
  products: Product[];
  drivers?: Driver[];
  vehicles?: Vehicle[];
  users: User[];
  currentUser?: User | null;
  onShowDetails?: (shipment: Shipment) => void;
  onAttach?: (shipment: Shipment) => void;
}

export const OptimizedShipmentsBoard: React.FC<OptimizedShipmentsBoardProps> = ({
  columns,
  shipments,
  cargos,
  clients,
  products,
  drivers = [],
  vehicles = [],
  users,
  currentUser,
  onShowDetails,
  onAttach,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'normal' | 'warning' | 'critical'>('all');
  const [selectedEmbarcador, setSelectedEmbarcador] = useState<string>('all');
  const [viewDensity, setViewDensity] = useState<'rich' | 'compact'>('rich');
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  // Helper to copy text to clipboard with visual feedback
  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItemId(id);
    setTimeout(() => {
      setCopiedItemId(prev => prev === id ? null : prev);
    }, 2000);
  }, []);

  // Helper to copy full summary of shipment
  const handleCopySummary = useCallback((shipment: Shipment, cargo?: Cargo, client?: Client, product?: Product) => {
    const lines = [
      `🚚 *EMBARQUE #${shipment.id}*`,
      `👤 *Motorista:* ${shipment.driverName}${shipment.driverCpf ? ` (CPF: ${shipment.driverCpf})` : ''}`,
      `🚛 *Cavalo:* ${shipment.horsePlate}${shipment.trailer1Plate ? ` | *Carreta:* ${shipment.trailer1Plate}` : ''}`,
      cargo ? `📍 *Rota:* ${cargo.origin} ➔ ${cargo.destination}` : '',
      client ? `🏢 *Cliente:* ${client.nomeFantasia || client.razaoSocial}` : '',
      product ? `📦 *Produto:* ${product.name}` : '',
      `⏱️ *Status Atual:* ${shipment.status}`,
    ].filter(Boolean);

    handleCopy(lines.join('\n'), `summary-${shipment.id}`);
  }, [handleCopy]);

  // Helpers to resolve entities
  const getCargo = useCallback((cargoId: string) => cargos.find(c => c.id === cargoId), [cargos]);
  const getClient = useCallback((clientId?: string) => clientId ? clients.find(c => c.id === clientId) : undefined, [clients]);
  const getProduct = useCallback((productId?: string) => productId ? products.find(p => p.id === productId) : undefined, [products]);
  const getUser = useCallback((userId: string) => users.find(u => u.id === userId), [users]);

  // Get driver phone number (from shipment or drivers catalog)
  const getDriverPhone = useCallback((shipment: Shipment): string | null => {
    if (shipment.driverContact) {
      const clean = shipment.driverContact.replace(/\D/g, '');
      if (clean.length >= 10) return clean;
    }
    const cleanCpf = shipment.driverCpf?.replace(/\D/g, '');
    const driverObj = drivers.find(d => {
      if (cleanCpf && d.cpf && d.cpf.replace(/\D/g, '') === cleanCpf) return true;
      return d.name?.toLowerCase().trim() === shipment.driverName?.toLowerCase().trim();
    });
    if (driverObj?.phone) {
      const clean = driverObj.phone.replace(/\D/g, '');
      if (clean.length >= 10) return clean;
    }
    return null;
  }, [drivers]);

  // WhatsApp link generator
  const getWhatsAppLink = (phone: string, text: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    const phoneWithCountry = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`;
  };

  // SLA and elapsed time calculations
  const getElapsedMinutes = useCallback((shipment: Shipment): number => {
    const currentStatusEntry = shipment.statusHistory?.[shipment.statusHistory.length - 1];
    const timestamp = currentStatusEntry?.timestamp || shipment.createdAt;
    if (!timestamp) return 0;
    const start = new Date(timestamp).getTime();
    return Math.max(0, Math.floor((Date.now() - start) / (1000 * 60)));
  }, []);

  const getUrgencyLevel = useCallback((shipment: Shipment, thresholds?: { yellow: number; red: number }): 'normal' | 'warning' | 'critical' => {
    if (!thresholds) return 'normal';
    const diff = getElapsedMinutes(shipment);
    if (diff >= thresholds.red) return 'critical';
    if (diff >= thresholds.yellow) return 'warning';
    return 'normal';
  }, [getElapsedMinutes]);

  const formatElapsedTime = (minutes: number): string => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    if (hours < 24) return `${hours}h ${remMinutes}m`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  };

  const formatDateTime = (timestamp?: string): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  // Extract unique solicitantes for filter
  const solicitantesList = useMemo(() => {
    const ids = Array.from(new Set(shipments.map(s => s.embarcadorId).filter(Boolean)));
    return ids.map(id => {
      const u = getUser(id);
      return { id, name: u?.name || 'Não atribuído' };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [shipments, getUser]);

  // Filtered shipments
  const filteredShipments = useMemo(() => {
    return shipments.filter(shipment => {
      // Solicitante filter
      if (selectedEmbarcador !== 'all' && shipment.embarcadorId !== selectedEmbarcador) {
        return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const cargo = getCargo(shipment.cargoId);
        const client = getClient(cargo?.clientId);
        const product = getProduct(cargo?.productId);
        const solicitante = getUser(shipment.embarcadorId);

        const matchId = shipment.id?.toLowerCase().includes(term);
        const matchPlate = shipment.horsePlate?.toLowerCase().includes(term) ||
          shipment.trailer1Plate?.toLowerCase().includes(term) ||
          shipment.trailer2Plate?.toLowerCase().includes(term);
        const matchDriver = shipment.driverName?.toLowerCase().includes(term) ||
          shipment.driverCpf?.replace(/\D/g, '').includes(term.replace(/\D/g, ''));
        const matchOrigin = cargo?.origin?.toLowerCase().includes(term);
        const matchDest = cargo?.destination?.toLowerCase().includes(term);
        const matchClient = client?.nomeFantasia?.toLowerCase().includes(term) || client?.razaoSocial?.toLowerCase().includes(term);
        const matchProduct = product?.name?.toLowerCase().includes(term);
        const matchSolicitante = solicitante?.name?.toLowerCase().includes(term);

        if (!matchId && !matchPlate && !matchDriver && !matchOrigin && !matchDest && !matchClient && !matchProduct && !matchSolicitante) {
          return false;
        }
      }

      // Urgency filter
      if (urgencyFilter !== 'all') {
        const colConfig = columns.find(col => col.status === shipment.status);
        const level = getUrgencyLevel(shipment, colConfig?.thresholds);
        if (level !== urgencyFilter) {
          return false;
        }
      }

      return true;
    });
  }, [shipments, selectedEmbarcador, searchTerm, urgencyFilter, columns, getCargo, getClient, getProduct, getUser, getUrgencyLevel]);

  // SLA critical counts for quick badge
  const criticalCount = useMemo(() => {
    return shipments.filter(s => {
      const col = columns.find(c => c.status === s.status);
      return getUrgencyLevel(s, col?.thresholds) === 'critical';
    }).length;
  }, [shipments, columns, getUrgencyLevel]);

  // Color theme mapper for columns
  const getThemeStyles = (theme?: BoardColumnConfig['colorTheme']) => {
    switch (theme) {
      case 'amber':
        return {
          border: 'border-amber-500',
          bgHeader: 'bg-amber-50 dark:bg-amber-950/30',
          headerText: 'text-amber-800 dark:text-amber-200',
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
          cardBorder: 'border-l-amber-500',
        };
      case 'purple':
        return {
          border: 'border-purple-500',
          bgHeader: 'bg-purple-50 dark:bg-purple-950/30',
          headerText: 'text-purple-800 dark:text-purple-200',
          badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
          cardBorder: 'border-l-purple-500',
        };
      case 'emerald':
        return {
          border: 'border-emerald-500',
          bgHeader: 'bg-emerald-50 dark:bg-emerald-950/30',
          headerText: 'text-emerald-800 dark:text-emerald-200',
          badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
          cardBorder: 'border-l-emerald-500',
        };
      case 'indigo':
        return {
          border: 'border-indigo-500',
          bgHeader: 'bg-indigo-50 dark:bg-indigo-950/30',
          headerText: 'text-indigo-800 dark:text-indigo-200',
          badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
          cardBorder: 'border-l-indigo-500',
        };
      case 'rose':
        return {
          border: 'border-rose-500',
          bgHeader: 'bg-rose-50 dark:bg-rose-950/30',
          headerText: 'text-rose-800 dark:text-rose-200',
          badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
          cardBorder: 'border-l-rose-500',
        };
      case 'cyan':
        return {
          border: 'border-cyan-500',
          bgHeader: 'bg-cyan-50 dark:bg-cyan-950/30',
          headerText: 'text-cyan-800 dark:text-cyan-200',
          badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
          cardBorder: 'border-l-cyan-500',
        };
      case 'blue':
      default:
        return {
          border: 'border-blue-500',
          bgHeader: 'bg-blue-50 dark:bg-blue-950/30',
          headerText: 'text-blue-800 dark:text-blue-200',
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
          cardBorder: 'border-l-blue-500',
        };
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Filter and Actions Toolbar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        {/* Left Side: Search & Quick Filters */}
        <div className="flex flex-1 flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por placa, motorista, rota, cliente ou ID..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-white transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Solicitante Filter */}
          {solicitantesList.length > 1 && (
            <div className="w-full sm:w-52">
              <select
                value={selectedEmbarcador}
                onChange={(e) => setSelectedEmbarcador(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-white"
              >
                <option value="all">Todos Solicitantes</option>
                {solicitantesList.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Urgency SLA Filter Pills */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg self-start sm:self-auto overflow-x-auto">
            <button
              onClick={() => setUrgencyFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                urgencyFilter === 'all'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Todos ({shipments.length})
            </button>
            <button
              onClick={() => setUrgencyFilter('critical')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${
                urgencyFilter === 'critical'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              Críticos ({criticalCount})
            </button>
          </div>
        </div>

        {/* Right Side: View density toggle & Total Counter */}
        <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 dark:border-gray-700">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
            <button
              onClick={() => setViewDensity('rich')}
              className={`p-1.5 rounded-md transition-all flex items-center gap-1 text-xs font-medium ${
                viewDensity === 'rich'
                  ? 'bg-white dark:bg-gray-800 text-primary dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
              title="Visualização Expandida (Cards Ricos)"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Rico</span>
            </button>
            <button
              onClick={() => setViewDensity('compact')}
              className={`p-1.5 rounded-md transition-all flex items-center gap-1 text-xs font-medium ${
                viewDensity === 'compact'
                  ? 'bg-white dark:bg-gray-800 text-primary dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
              title="Visualização Compacta (Alta Densidade)"
            >
              <ListFilter className="w-4 h-4" />
              <span className="hidden sm:inline">Compacto</span>
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
            Filtrados: <strong className="text-gray-900 dark:text-white">{filteredShipments.length}</strong> de {shipments.length}
          </div>
        </div>
      </div>

      {/* Kanban Board Columns Grid */}
      <div 
        className="grid gap-5 items-start" 
        style={{ 
          gridTemplateColumns: `repeat(auto-fit, minmax(320px, 1fr))` 
        }}
      >
        {columns.map(column => {
          const colShipments = filteredShipments.filter(s => s.status === column.status);
          const theme = getThemeStyles(column.colorTheme);

          return (
            <div 
              key={column.id}
              className="bg-gray-50/80 dark:bg-gray-900/60 rounded-2xl p-3.5 border border-gray-200/80 dark:border-gray-800 flex flex-col max-h-[calc(100vh-250px)] min-h-[420px] shadow-sm transition-all"
            >
              {/* Column Header */}
              <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl ${theme.bgHeader} border-b-2 ${theme.border} mb-3.5 shadow-sm`}>
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-white/80 dark:bg-gray-800/80 shadow-xs">
                    {column.icon || <ShieldCheck className="w-4 h-4 text-primary dark:text-blue-400" />}
                  </div>
                  <h3 className={`font-bold text-sm tracking-tight ${theme.headerText}`}>
                    {column.title}
                  </h3>
                </div>
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${theme.badge} shadow-xs`}>
                  {colShipments.length}
                </span>
              </div>

              {/* Cards Container with Scroll */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 custom-scrollbar">
                {colShipments.length > 0 ? (
                  colShipments.map(shipment => {
                    const cargo = getCargo(shipment.cargoId);
                    const client = getClient(cargo?.clientId);
                    const product = getProduct(cargo?.productId);
                    const solicitante = getUser(shipment.embarcadorId);
                    const driverPhone = getDriverPhone(shipment);
                    const currentStatusEntry = shipment.statusHistory?.[shipment.statusHistory.length - 1];
                    const requestTimestamp = currentStatusEntry?.timestamp || shipment.createdAt;
                    const elapsedMinutes = getElapsedMinutes(shipment);
                    const urgency = getUrgencyLevel(shipment, column.thresholds);
                    const docName = REQUIRED_DOCUMENT_MAP[shipment.status] || 'Documento';

                    // SLA urgency styling
                    let urgencyBadgeBg = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50';
                    let urgencyDot = 'bg-emerald-500';
                    if (urgency === 'warning') {
                      urgencyBadgeBg = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/50';
                      urgencyDot = 'bg-amber-500';
                    } else if (urgency === 'critical') {
                      urgencyBadgeBg = 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800/50';
                      urgencyDot = 'bg-red-500 animate-pulse';
                    }

                    if (viewDensity === 'compact') {
                      // COMPACT VIEW
                      return (
                        <div
                          key={shipment.id}
                          className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-xs hover:shadow-md transition-all border border-gray-100 dark:border-gray-700/80 border-l-4 border-l-primary group"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-primary dark:text-blue-400">
                                {shipment.id}
                              </span>
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded border border-gray-200 dark:border-gray-600">
                                {shipment.horsePlate}
                              </span>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${urgencyBadgeBg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${urgencyDot}`} />
                              {formatElapsedTime(elapsedMinutes)}
                            </span>
                          </div>

                          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate mb-1">
                            {shipment.driverName}
                          </p>

                          {cargo && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mb-2 flex items-center gap-1">
                              <MapPin className="w-3 h-3 flex-shrink-0 text-gray-400" />
                              {cargo.origin} ➔ {cargo.destination}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60 mt-1">
                            <span className="text-[10px] text-gray-400 truncate max-w-[130px]">
                              {solicitante?.name || 'Solicitante N/A'}
                            </span>
                            <div className="flex items-center gap-1">
                              {onAttach && (
                                <button
                                  onClick={() => onAttach(shipment)}
                                  className="p-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary dark:text-blue-400 rounded-md transition-all"
                                  title={`Anexar ${docName}`}
                                >
                                  <Paperclip className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onShowDetails && (
                                <button
                                  onClick={() => onShowDetails(shipment)}
                                  className="p-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md transition-all"
                                  title="Ver Detalhes"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // RICH DETAILED VIEW (Standard)
                    return (
                      <div
                        key={shipment.id}
                        className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-all border border-gray-150 dark:border-gray-700 border-l-4 ${theme.cardBorder} flex flex-col gap-3 group relative hover:-translate-y-0.5`}
                      >
                        {/* Card Header: ID, Copy, SLA & Time */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {onShowDetails ? (
                              <button
                                onClick={() => onShowDetails(shipment)}
                                className="font-mono text-xs font-bold text-primary hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline flex items-center gap-1 transition-colors"
                                title="Clique para ver todos os detalhes"
                              >
                                {shipment.id}
                              </button>
                            ) : (
                              <span className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">
                                {shipment.id}
                              </span>
                            )}
                            
                            <button
                              onClick={() => handleCopy(shipment.id, `id-${shipment.id}`)}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded transition-colors"
                              title="Copiar ID"
                            >
                              {copiedItemId === `id-${shipment.id}` ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span 
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${urgencyBadgeBg}`}
                              title={`Tempo de espera no status atual: ${formatElapsedTime(elapsedMinutes)}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${urgencyDot}`} />
                              {formatElapsedTime(elapsedMinutes)}
                            </span>
                            <p className="text-[10px] text-gray-400 dark:text-gray-400 mt-0.5">
                              {formatDateTime(requestTimestamp)}
                            </p>
                          </div>
                        </div>

                        {/* Motorista & Placas */}
                        <div className="bg-gray-50/80 dark:bg-gray-750/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700/60 flex flex-col gap-1.5">
                          {/* Driver row */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                                {shipment.driverName}
                              </span>
                              {shipment.driverCpf && (
                                <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">
                                  {shipment.driverCpf}
                                </span>
                              )}
                            </div>

                            {/* Driver WhatsApp Link */}
                            {driverPhone && (
                              <a
                                href={getWhatsAppLink(
                                  driverPhone,
                                  `Olá ${shipment.driverName}, referente ao embarque *${shipment.id}* na Rodochagas Logística.`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded border border-emerald-200 dark:border-emerald-800/40 transition-colors flex-shrink-0"
                                title="Conversar com o Motorista no WhatsApp"
                              >
                                <WhatsAppIcon className="w-3 h-3" />
                                <span className="hidden sm:inline">Whats</span>
                              </a>
                            )}
                          </div>

                          {/* Plates row */}
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <div className="inline-flex items-center gap-1 bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 font-mono font-bold text-gray-800 dark:text-gray-100 shadow-2xs">
                              <Truck className="w-3 h-3 text-primary dark:text-blue-400" />
                              <span>{shipment.horsePlate || 'Sem placa'}</span>
                              <button
                                onClick={() => handleCopy(shipment.horsePlate, `plate-${shipment.id}`)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-0.5"
                                title="Copiar Placa"
                              >
                                {copiedItemId === `plate-${shipment.id}` ? (
                                  <Check className="w-2.5 h-2.5 text-green-500" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>

                            {shipment.trailer1Plate && (
                              <span className="font-mono text-[11px] text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600">
                                Carreta: {shipment.trailer1Plate}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Rota, Cliente e Produto */}
                        {cargo ? (
                          <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                            {/* Route */}
                            <div className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                              <span className="truncate">{cargo.origin}</span>
                              <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{cargo.destination}</span>
                            </div>

                            {/* Client & Product tags */}
                            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                              {client && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded border border-blue-100 dark:border-blue-900/40 font-medium truncate max-w-[150px]">
                                  <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                                  {client.nomeFantasia || client.razaoSocial}
                                </span>
                              )}
                              {product && (
                                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 rounded font-medium truncate max-w-[120px]">
                                  {product.name}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-gray-400 italic">
                            Informações da carga indisponíveis
                          </div>
                        )}

                        {/* Solicitante row */}
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700/60">
                          <span className="flex items-center gap-1 truncate">
                            <UserCheck className="w-3 h-3 text-gray-400" />
                            Solicitante: <strong className="text-gray-700 dark:text-gray-300 font-medium">{solicitante?.name || 'N/A'}</strong>
                          </span>

                          {solicitante?.phone && (
                            <a
                              href={getWhatsAppLink(
                                solicitante.phone,
                                `Olá ${solicitante.name}, referente ao embarque *${shipment.id}* do motorista *${shipment.driverName}* (${shipment.horsePlate}).`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 p-0.5 rounded transition-colors"
                              title="Conversar com o solicitante no WhatsApp"
                            >
                              <WhatsAppIcon className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>

                        {/* Action Buttons Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {onAttach ? (
                            <button
                              onClick={() => onAttach(shipment)}
                              className="w-full px-3 py-2 bg-gradient-to-r from-primary to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition-all transform active:scale-98"
                              title={`Anexar ${docName} e avançar etapa`}
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="truncate">Anexar Documento</span>
                            </button>
                          ) : null}

                          <div className="flex items-center gap-1.5">
                            {onShowDetails && (
                              <button
                                onClick={() => onShowDetails(shipment)}
                                className="flex-1 px-2.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                title="Ver ficha e histórico completos"
                              >
                                <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                                <span>Detalhes</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleCopySummary(shipment, cargo, client, product)}
                              className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-xs transition-colors flex-shrink-0"
                              title="Copiar Ficha Completa para WhatsApp"
                            >
                              {copiedItemId === `summary-${shipment.id}` ? (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Share2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-12 px-4 text-gray-400 dark:text-gray-500">
                    <CheckCircle2 className="w-8 h-8 mb-2 text-gray-300 dark:text-gray-600" />
                    <p className="text-xs font-medium">Nenhum embarque nesta etapa</p>
                    {searchTerm && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Tente ajustar os filtros de busca
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OptimizedShipmentsBoard;
