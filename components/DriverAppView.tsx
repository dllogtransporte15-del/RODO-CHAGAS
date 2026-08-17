import React, { useState, useMemo, useEffect } from 'react';
import type { Cargo, Shipment, Client, Product, Driver, Vehicle, User } from '../types';
import { CargoStatus, ShipmentStatus } from '../types';
import { supabase } from '../supabase';
import { getCoordsSync, calculateDistanceKm } from '../utils/geocoding';
import { Search, MapPin, Navigation, Truck, Package, FileText, User as UserIcon, LogOut, Phone, ShieldCheck, Upload, ChevronRight, ChevronDown, Compass, X, ExternalLink } from 'lucide-react';
import { REQUIRED_DOCUMENT_MAP } from '../types';
import type { StayRecord } from '../utils/toolStorage';

interface DriverAppViewProps {
  loads: Cargo[];
  shipments: Shipment[];
  clients: Client[];
  products: Product[];
  drivers: Driver[];
  vehicles: Vehicle[];
  currentUser: User;
  onRequestLoadOrder?: (cargo: Cargo) => void;
  onShowCargoDetails: (cargo: Cargo) => void;
  onAttach?: (shipment: Shipment) => void;
  onNavigateToMap: () => void;
  onLogout: () => void;
  companyLogo?: string | null;
  stays?: StayRecord[];
}

// ─── History Shipment Card ────────────────────────────────────────────────────
interface HistoryShipmentCardProps {
  shipment: Shipment;
  cargo: Cargo | undefined;
  ratePerTon: number | null;
  docUrls: { label: string; url: string }[];
}

const HistoryShipmentCard: React.FC<HistoryShipmentCardProps> = ({ shipment: s, cargo, ratePerTon, docUrls }) => {
  const [expanded, setExpanded] = useState(false);

  const formatCurrencyLocal = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const docCategories = [
    { label: 'CT-e', keys: ['cte', 'ct-e', 'conhecimento'] },
    { label: 'Nota Fiscal', keys: ['nota', 'nf', 'fiscal'] },
    { label: 'MDF-e', keys: ['mdfe', 'mdf'] },
    { label: 'Carta Frete', keys: ['carta', 'contrato', 'frete'] },
    { label: 'Comp. Adiantamento', keys: ['adiantamento', 'advance'] },
    { label: 'Comp. Saldo', keys: ['saldo', 'balance'] },
  ];

  const getDocsForCategory = (keys: string[]): string[] => {
    const result: string[] = [];
    Object.entries(s.documents || {}).forEach(([k, urls]) => {
      const kl = k.toLowerCase();
      if (keys.some(key => kl.includes(key))) {
        result.push(...(urls || []));
      }
    });
    return result;
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden text-xs transition-all">
      {/* Header row */}
      <div className="p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-slate-200 truncate">{cargo?.origin || 'Origem'} → {cargo?.destination || 'Destino'}</span>
          <span className="shrink-0 px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">Concluído</span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <div className="text-slate-400">
            Valor total: <span className="text-emerald-400 font-bold">{formatCurrencyLocal(s.driverFreightValue)}</span>
          </div>
          {ratePerTon !== null && (
            <div className="text-slate-400">
              Frete/ton: <span className="text-cyan-400 font-bold">R$ {ratePerTon.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {s.shipmentTonnage > 0 && (
            <div className="text-slate-400">
              Tonelagem: <span className="text-slate-200 font-semibold">{s.shipmentTonnage.toLocaleString('pt-BR')} ton</span>
            </div>
          )}
          <div className="text-slate-500 text-[10px] self-end">#{s.orderId || s.id.substring(0, 8)}</div>
        </div>

        {/* Expand/collapse button */}
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="w-full mt-1 flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition-all"
        >
          <div className="flex items-center gap-2 font-semibold">
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>Documentos do Embarque</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Documents panel */}
      {expanded && (
        <div className="border-t border-slate-800 bg-slate-950/60 px-3.5 py-3 space-y-2.5">
          {docCategories.map(cat => {
            const urls = getDocsForCategory(cat.keys);
            return (
              <div key={cat.label} className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <span>{cat.label}</span>
                  {urls.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{urls.length}</span>
                  )}
                </div>
                {urls.length === 0 ? (
                  <p className="text-[11px] text-slate-600 italic pl-1">Nenhum arquivo anexado</p>
                ) : (
                  <div className="space-y-1 pl-1">
                    {urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/60 hover:border-cyan-500/40 hover:bg-slate-800 transition-all text-cyan-300 hover:text-cyan-200"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] font-medium truncate">{cat.label}{urls.length > 1 ? ` ${i + 1}` : ''}</span>
                        <span className="ml-auto text-[10px] text-slate-500">Abrir →</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

export const DriverAppView: React.FC<DriverAppViewProps> = ({
  loads,
  shipments,
  products,
  drivers,
  vehicles,
  currentUser,
  onRequestLoadOrder,
  onShowCargoDetails,
  onAttach,
  onNavigateToMap,
  onLogout,
  companyLogo,
}) => {
  const [activeTab, setActiveTab] = useState<'cargas' | 'fretes' | 'perfil'>('cargas');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');
  const [selectedUfFilter, setSelectedUfFilter] = useState<string>('all');
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isGpsLocating, setIsGpsLocating] = useState(false);

  // Clean Driver CPF from logged-in user
  const driverCpfClean = useMemo(() => {
    return (currentUser.email || '').replace(/\D/g, '');
  }, [currentUser]);

  // Driver data
  const currentDriver = useMemo(() => {
    return drivers.find(d => (d.cpf || '').replace(/\D/g, '') === driverCpfClean);
  }, [drivers, driverCpfClean]);

  // Driver vehicles
  const driverVehicles = useMemo(() => {
    if (!currentDriver) return [];
    return vehicles.filter(v => v.driverId === currentDriver.id || v.ownerId === currentDriver.ownerId);
  }, [vehicles, currentDriver]);

  // Driver active shipments
  const activeShipments = useMemo(() => {
    return shipments.filter(s =>
      (s.driverCpf || '').replace(/\D/g, '') === driverCpfClean &&
      s.status !== ShipmentStatus.Finalizado &&
      s.status !== ShipmentStatus.Cancelado
    );
  }, [shipments, driverCpfClean]);

  // Driver shipment history
  const historyShipments = useMemo(() => {
    return shipments.filter(s =>
      (s.driverCpf || '').replace(/\D/g, '') === driverCpfClean &&
      (s.status === ShipmentStatus.Finalizado || s.status === ShipmentStatus.Cancelado)
    );
  }, [shipments, driverCpfClean]);

  // Approved cargo IDs for this driver
  const approvedCargoIds = useMemo(() => {
    const set = new Set<string>();
    shipments.forEach(s => {
      if (
        (s.driverCpf || '').replace(/\D/g, '') === driverCpfClean &&
        s.status !== ShipmentStatus.Cancelado
      ) {
        set.add(s.cargoId);
      }
    });
    return set;
  }, [shipments, driverCpfClean]);

  // Request driver geolocation on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      setIsGpsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDriverCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setIsGpsLocating(false);
        },
        (error) => {
          console.warn('GPS location not granted:', error.message);
          setIsGpsLocating(false);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    }
  }, []);

  // Broadcast location to presence channel whenever driverCoords changes
  useEffect(() => {
    if (!driverCoords || !currentUser) return;

    const channel = supabase.channel('driver_locations_monitor', {
      config: { presence: { key: currentUser.id } },
    });

    const now = new Date().toISOString();
    const payload = {
      driverId: currentUser.id,
      driverName: currentUser.name,
      driverCpf: currentUser.email,
      lat: driverCoords.lat,
      lng: driverCoords.lng,
      timestamp: now,
      isAppActive: true,
      location: {
        driverId: currentUser.id,
        driverName: currentUser.name,
        driverCpf: currentUser.email,
        lat: driverCoords.lat,
        lng: driverCoords.lng,
        timestamp: now,
      }
    };

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(payload);
      }
    });

    // Persist to database
    if (driverCoords.lat !== 0 && driverCoords.lng !== 0) {
      const updateData: any = {
        has_app: true,
      };
      if (driverCpfClean) {
        supabase.from('drivers').update(updateData).eq('cpf', driverCpfClean).then(() => {});
      }
      supabase.from('drivers').update(updateData).eq('id', currentUser.id).then(() => {});
    }

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [driverCoords, currentUser, driverCpfClean]);

  const handleRefreshGps = () => {
    if (!('geolocation' in navigator)) return;
    setIsGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDriverCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsGpsLocating(false);
      },
      () => {
        setIsGpsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Helper to extract UF from city string "Cidade - UF"
  const extractUF = (cityStr: string) => {
    const parts = cityStr.split('-');
    if (parts.length > 1) return parts[parts.length - 1].trim().toUpperCase();
    return '';
  };

  // Compute available list of UFs for filtering
  const availableUfs = useMemo(() => {
    const ufs = new Set<string>();
    loads.forEach(l => {
      const ufOrig = extractUF(l.origin);
      const ufDest = extractUF(l.destination);
      if (ufOrig) ufs.add(ufOrig);
      if (ufDest) ufs.add(ufDest);
    });
    return Array.from(ufs).sort();
  }, [loads]);

  // Filter and process loads
  const processedLoads = useMemo(() => {
    return loads
      .filter(load => load.status === CargoStatus.EmAndamento)
      .map(load => {
        const product = products.find(p => p.id === load.productId);
        const originCoords = load.originCoords || getCoordsSync(load.origin) || undefined;
        const destinationCoords = load.destinationCoords || getCoordsSync(load.destination) || undefined;

        // Distance between origin and destination (Route km)
        let routeDistanceKm: number | null = null;
        if (originCoords && destinationCoords) {
          routeDistanceKm = calculateDistanceKm(originCoords, destinationCoords);
        }

        // Distance from driver's GPS to the origin
        let distanceFromDriverKm: number | null = null;
        if (driverCoords && originCoords) {
          distanceFromDriverKm = calculateDistanceKm(driverCoords, originCoords);
        }

        const canViewFullDetails = approvedCargoIds.has(load.id);

        return {
          rawCargo: load,
          id: load.id,
          sequenceId: load.sequenceId,
          origin: load.origin,
          destination: load.destination,
          driverFreightValuePerTon: load.driverFreightValuePerTon,
          allowedVehicleTypes: load.allowedVehicleTypes,
          productId: load.productId,
          productName: product?.name || 'Carga Geral',
          originCoords,
          destinationCoords,
          routeDistanceKm,
          distanceFromDriverKm,
          canViewFullDetails,
        };
      })
      .filter(load => {
        // Search term matching (origin, destination, product, body types)
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchesOrigin = load.origin.toLowerCase().includes(term);
          const matchesDest = load.destination.toLowerCase().includes(term);
          const matchesProd = load.productName.toLowerCase().includes(term);
          const matchesBody = load.allowedVehicleTypes?.some(vt =>
            vt.bodyTypes.some(bt => bt.toLowerCase().includes(term))
          );
          if (!matchesOrigin && !matchesDest && !matchesProd && !matchesBody) {
            return false;
          }
        }

        // Product filter
        if (selectedProductFilter !== 'all' && load.productId !== selectedProductFilter) {
          return false;
        }

        // UF filter
        if (selectedUfFilter !== 'all') {
          const origUf = extractUF(load.origin);
          const destUf = extractUF(load.destination);
          if (origUf !== selectedUfFilter && destUf !== selectedUfFilter) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (a.distanceFromDriverKm !== null && b.distanceFromDriverKm !== null) {
          return a.distanceFromDriverKm - b.distanceFromDriverKm;
        }
        return 0;
      });
  }, [loads, products, approvedCargoIds, searchTerm, selectedProductFilter, selectedUfFilter, driverCoords]);

  // Format currency
  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return 'A Combinar';
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: ShipmentStatus) => {
    switch (status) {
      case ShipmentStatus.AguardandoCarregamento:
        return { label: 'Aguardando Carregamento', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      case ShipmentStatus.AguardandoNota:
        return { label: 'Aguardando Nota Fiscal', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      case ShipmentStatus.AguardandoAdiantamento:
        return { label: 'Aguardando Adiantamento', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
      case ShipmentStatus.AguardandoAgendamento:
        return { label: 'Aguardando Agendamento', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' };
      case ShipmentStatus.AguardandoDescarga:
        return { label: 'Em Trânsito / Descarga', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case ShipmentStatus.AguardandoPagamentoSaldo:
        return { label: 'Aguardando Pagamento Saldo', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      case ShipmentStatus.Finalizado:
        return { label: 'Concluído', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
      default:
        return { label: status, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28 font-sans antialiased selection:bg-cyan-500 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3 shadow-lg shadow-black/20">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {companyLogo ? (
              <img src={companyLogo} alt="Logo" className="h-9 w-auto object-contain max-w-[140px]" />
            ) : (
              <div className="flex items-center gap-1.5 font-black text-lg tracking-wider">
                <span className="text-white">RODO</span>
                <span className="text-cyan-400">CHAGAS</span>
              </div>
            )}
            <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Motorista Online</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshGps}
              title={driverCoords ? 'GPS Ativo' : 'Ativar GPS'}
              className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
                driverCoords
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Compass className={`w-4 h-4 ${isGpsLocating ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">{driverCoords ? 'GPS ON' : 'GPS'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-xl mx-auto px-4 pt-4">
        {/* TAB 1: CARGAS (Oportunidades de Carga) */}
        {activeTab === 'cargas' && (
          <div className="space-y-4">
            {/* Active Mission Alert Banner (if driver has active shipment) */}
            {activeShipments.length > 0 && (() => {
              const activeCargo = loads.find(l => l.id === activeShipments[0].cargoId);
              const badge = getStatusBadge(activeShipments[0].status);
              return (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950/80 via-slate-900 to-slate-900 border border-blue-500/40 p-4 shadow-xl shadow-blue-950/40">
                  <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        <Truck className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-blue-400">Meu Frete em Andamento</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-500/20 text-blue-300">
                            #{activeCargo?.sequenceId || 'Ativo'}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white leading-tight">
                          {activeCargo?.origin || 'Origem'} → {activeCargo?.destination || 'Destino'}
                        </h3>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800">
                    <button
                      onClick={() => {
                        if (activeCargo) onShowCargoDetails(activeCargo);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-bold text-slate-200 border border-slate-700/80 transition-all active:scale-95"
                    >
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Detalhes do Frete</span>
                    </button>

                    {onAttach && (
                      <button
                        onClick={() => onAttach(activeShipments[0])}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-xs font-bold text-white shadow-md shadow-cyan-900/30 transition-all active:scale-95"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Enviar Comprovante</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Modern Search Input Container (Matching Image Header) */}
            <div className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-4 w-5 h-5 text-cyan-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquisar Carga (Origem, Destino, Produto...)"
                  className="w-full bg-slate-900/90 text-white placeholder-slate-400 pl-11 pr-10 py-3.5 rounded-2xl border border-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none text-sm transition-all shadow-inner"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3.5 p-1 rounded-full text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>



            </div>

            {/* GPS Proximity Status Note */}
            {driverCoords && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-cyan-400 text-xs">
                <div className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Cargas ordenadas pela mais próxima da sua localização</span>
                </div>
                <span className="font-bold">GPS Ativo</span>
              </div>
            )}

            {/* List of Cargo Cards (Matching Mockup Structure) */}
            <div className="space-y-3">
              {processedLoads.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <Package className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-bounce" />
                  <p className="text-base font-semibold text-slate-300">Nenhuma oportunidade encontrada</p>
                  <p className="text-xs text-slate-500 mt-1">Tente ajustar seus termos de pesquisa ou filtros.</p>
                </div>
              ) : (
                processedLoads.map((load) => {
                  const bodyTypesList = load.allowedVehicleTypes && load.allowedVehicleTypes.length > 0
                    ? Array.from(new Set(load.allowedVehicleTypes.flatMap(v => v.bodyTypes)))
                    : [];

                  return (
                    <div
                      key={load.id}
                      className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-4 transition-all duration-200 shadow-md hover:shadow-xl hover:shadow-cyan-950/20"
                    >
                      {/* Top Row: Route & Product */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        {/* Route Locations (Left Side) */}
                        <div className="flex-1 space-y-2">
                          {/* Origem */}
                          <div className="flex items-center gap-2">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                              <MapPin className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-sm font-black text-white tracking-tight">
                              {load.origin}
                            </span>
                          </div>

                          {/* Connecting line */}
                          <div className="ml-3 pl-3 border-l-2 border-dashed border-slate-700 py-0.5">
                            {/* Destino */}
                            <div className="flex items-center gap-2 -ml-3 pl-3">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                <MapPin className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-sm font-black text-white tracking-tight">
                                {load.destination}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Product Tag (Top-Right) */}
                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700/80 text-xs font-bold text-slate-300">
                            {load.productName}
                          </span>
                          {load.canViewFullDetails && load.sequenceId && (
                            <span className="text-[10px] font-black text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30">
                              #{load.sequenceId}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Route Metrics (Distance & Proximity) */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-300">
                            Rota:{' '}
                            <span className="text-cyan-400 font-bold">
                              {load.routeDistanceKm ? `${load.routeDistanceKm} km` : 'Calculando...'}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {load.distanceFromDriverKm !== null ? (
                              <>
                                Está a{' '}
                                <span className="text-emerald-400 font-bold">
                                  {load.distanceFromDriverKm} km
                                </span>{' '}
                                de você
                              </>
                            ) : (
                              <span className="text-slate-500 italic">Distância aproximada</span>
                            )}
                          </p>
                        </div>

                        {/* Freight Action Button (Bottom Right) */}
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-right">
                            <span className="text-base font-black text-emerald-400 tracking-tight">
                              {formatCurrency(load.driverFreightValuePerTon)}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1">/ ton</span>
                          </div>

                          <button
                            onClick={() => {
                              if (onRequestLoadOrder) {
                                onRequestLoadOrder(load.rawCargo);
                              } else if (load.canViewFullDetails) {
                                onShowCargoDetails(load.rawCargo);
                              }
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-xs font-bold text-white shadow-md shadow-cyan-950/40 transition-all active:scale-95 group-hover:shadow-cyan-500/20 cursor-pointer"
                          >
                            <span>Solicitar Embarque</span>
                            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      </div>

                      {/* Allowed Body Types chips */}
                      {bodyTypesList.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Carrocerias:</span>
                          {bodyTypesList.map(bt => (
                            <span key={bt} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/50">
                              {bt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: FRETES (Meus Embarques e Histórico) */}
        {activeTab === 'fretes' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              <span>Meus Fretes e Embarques</span>
            </h2>

            {/* Active shipments section */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">Embarques Ativos</h3>
              {activeShipments.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
                  <Truck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-400">Nenhum frete em andamento no momento</p>
                  <p className="text-xs text-slate-500 mt-1">Solicite uma carga na aba "Cargas" para iniciar.</p>
                </div>
              ) : (
                activeShipments.map(s => {
                  const badge = getStatusBadge(s.status);
                  const cargo = loads.find(l => l.id === s.cargoId);
                  const prod = products.find(p => p.id === cargo?.productId);

                  return (
                    <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-black text-cyan-400">Embarque #{s.id}</span>
                          <h4 className="text-sm font-bold text-white">{cargo?.origin || 'Origem'} → {cargo?.destination || 'Destino'}</h4>
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Produto</span>
                          <span className="font-semibold text-slate-200">{prod?.name || 'Carga'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Valor Motorista</span>
                          <span className="font-bold text-emerald-400">{formatCurrency(s.driverFreightValue)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        {cargo && (
                          <button
                            onClick={() => onShowCargoDetails(cargo)}
                            className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-all text-center"
                          >
                            Ver Detalhes
                          </button>
                        )}
                        {onAttach && (
                          <button
                            onClick={() => onAttach(s)}
                            className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Comprovante</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* History shipments section */}
            {historyShipments.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Histórico de Concluídos</h3>
                {historyShipments.map(s => {
                  const cargo = loads.find(l => l.id === s.cargoId);
                  const ratePerTon = s.driverFreightRateSnapshot ?? (s.shipmentTonnage > 0 ? s.driverFreightValue / s.shipmentTonnage : null);
                  return (
                    <HistoryShipmentCard
                      key={s.id}
                      shipment={s}
                      cargo={cargo}
                      ratePerTon={ratePerTon}
                      docUrls={[]}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PERFIL (Dados do Motorista) */}
        {activeTab === 'perfil' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-cyan-400" />
              <span>Perfil do Motorista</span>
            </h2>

            {/* Driver Identity Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-lg space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-cyan-900/30">
                  {(currentUser.name || 'M')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{currentUser.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CPF: {currentUser.email}</span>
                  </div>
                </div>
              </div>

              {currentDriver?.phone && (
                <div className="pt-2 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Telefone: {currentDriver.phone}</span>
                </div>
              )}
            </div>

            {/* Vehicles info */}
            {driverVehicles.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Truck className="w-4 h-4" />
                  <span>Veículos Cadastrados</span>
                </h4>
                {driverVehicles.map(v => (
                  <div key={v.id} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-white">
                      <span>Placa: {v.plate}</span>
                      <span className="text-slate-400 text-[11px]">{v.setType} - {v.bodyType}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Links & Logout */}
            <div className="space-y-2 pt-2">
              <button
                onClick={onNavigateToMap}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-left text-sm font-bold text-slate-200 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span>Abrir Mapa Operacional</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>

              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Navigation Dock (Matching Mockup Footer) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-2xl border-t border-slate-800/90 py-2 px-4 shadow-2xl shadow-black">
        <div className="max-w-xl mx-auto grid grid-cols-4 gap-1">
          {/* TAB 1: CARGAS */}
          <button
            onClick={() => setActiveTab('cargas')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'cargas'
                ? 'text-cyan-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Package className="w-5 h-5" />
              {processedLoads.length > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-cyan-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
                  {processedLoads.length > 99 ? '99+' : processedLoads.length}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1 tracking-tight">Cargas</span>
          </button>

          {/* TAB 2: FRETES */}
          <button
            onClick={() => setActiveTab('fretes')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'fretes'
                ? 'text-cyan-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <FileText className="w-5 h-5" />
              {activeShipments.length > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black flex items-center justify-center animate-pulse">
                  {activeShipments.length}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1 tracking-tight">Fretes</span>
          </button>

          {/* TAB 3: MAPA */}
          <button
            onClick={onNavigateToMap}
            className="flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl text-slate-400 hover:text-cyan-400 transition-all cursor-pointer"
          >
            <Compass className="w-5 h-5" />
            <span className="text-[11px] mt-1 tracking-tight">Mapa</span>
          </button>

          {/* TAB 4: PERFIL */}
          <button
            onClick={() => setActiveTab('perfil')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'perfil'
                ? 'text-cyan-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[11px] mt-1 tracking-tight">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
