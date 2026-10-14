import React, { useState, useMemo } from 'react';
import Header from '../components/Header';
import type { Shipment, User, Cargo, Client, Branch } from '../types';
import { UserProfile, ShipmentStatus, DailyScheduleType, CargoStatus } from '../types';
import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { ShipIcon } from '../components/icons/ShipIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { ClockIcon } from '../components/icons/ClockIcon';
import { Filter, X, Calendar, DollarSign, Package, CheckCircle, Building2, TrendingUp } from 'lucide-react';
import SalespersonReport from '../components/reports/SalespersonReport';
import SupervisorReport from '../components/reports/SupervisorReport';
import ShipperReport from '../components/reports/ShipperReport';
import ClientReport from '../components/reports/ClientReport';
import OperationalTimingReport from '../components/reports/OperationalTimingReport';
import ExternalSalespersonReport from '../components/reports/ExternalSalespersonReport';
import BranchReport from '../components/reports/BranchReport';
import StayFinancialReport from '../components/reports/StayFinancialReport';
import DemandForecastReport from '../components/reports/DemandForecastReport';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { getAllToolStays, getToolStays, StayRecord } from '../utils/toolStorage';
import { resolveShipmentRequesterId } from '../utils/shipperUtils';

interface ReportsPageProps {
  shipments: Shipment[];
  embarcadores: User[];
  cargos: Cargo[];
  users: User[];
  currentUser: User | null;
  clients: Client[];
  branches: Branch[];
  stays?: StayRecord[];
  companyLogo?: string | null;
}

type ActiveReport = 'comercial' | 'embarcadores' | 'clientes' | 'vendedores' | 'tempo-operacao' | 'filiais' | 'estadias' | 'previsao-demandas';

const ReportsPage: React.FC<ReportsPageProps> = ({ shipments, embarcadores, cargos, users, currentUser, clients, branches, stays = [], companyLogo }) => {
  const [activeReport, setActiveReport] = useState<ActiveReport>('comercial');
  const [loadingStays, setLoadingStays] = useState(false);
  
  // Date range defaults to current month
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterOperator, setFilterOperator] = useState<string[]>([]);
  const [filterClient, setFilterClient] = useState<string[]>([]);
  const [filterOrigin, setFilterOrigin] = useState<string[]>([]);
  const [filterDest, setFilterDest] = useState<string[]>([]);
  const [filterBranch, setFilterBranch] = useState<string[]>([]);
  const [filterScheduleType, setFilterScheduleType] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Escopo de Visibilidade e Privacidade: Perfil Agenciador / Agenciador Líder
  const isAdminOrDirector = useMemo(() => {
    if (!currentUser) return false;
    return [UserProfile.Admin, UserProfile.Diretor].includes(currentUser.profile);
  }, [currentUser]);

  const isRestrictedAgent = useMemo(() => {
    if (!currentUser) return false;
    return !isAdminOrDirector;
  }, [currentUser, isAdminOrDirector]);

  // Equipe formal do usuário logado (ele próprio + subordinados vinculados)
  const allowedTeamIds = useMemo(() => {
    const set = new Set<string>();
    if (!currentUser) return set;
    set.add(currentUser.id);
    if (currentUser.profile === UserProfile.AgenciadorLider) {
      users.filter(u => u.leaderId === currentUser.id).forEach(u => set.add(u.id));
    } else if (currentUser.profile === UserProfile.AgenciadorEmbarque) {
      if (currentUser.leaderId) {
        set.add(currentUser.leaderId);
        users.filter(u => u.leaderId === currentUser.leaderId).forEach(u => set.add(u.id));
      }
    }
    return set;
  }, [currentUser, users]);

  // Usuários com escopo restrito à equipe
  const scopedUsers = useMemo(() => {
    if (!isRestrictedAgent) return users;
    return users.filter(u => allowedTeamIds.has(u.id));
  }, [users, isRestrictedAgent, allowedTeamIds]);

  // Filiais com escopo restrito à filial do usuário
  const scopedBranches = useMemo(() => {
    if (!isRestrictedAgent || !currentUser?.branchId) return branches;
    return branches.filter(b => b.id === currentUser.branchId);
  }, [branches, isRestrictedAgent, currentUser]);

  // Cargas com escopo restrito (equipe, filial ou cargas com embarques da equipe)
  const scopedCargos = useMemo(() => {
    if (!isRestrictedAgent) return cargos;
    return cargos.filter(c => {
      // Cargas criadas pela equipe
      if (c.createdById && allowedTeamIds.has(c.createdById)) return true;
      if (c.history?.[0]?.userId && allowedTeamIds.has(c.history[0].userId)) return true;
      // Cargas vinculadas à própria filial
      if (currentUser?.branchId && c.branchId === currentUser.branchId) return true;
      // Cargas com embarques operados pela equipe
      const hasTeamShipment = shipments.some(s => {
        if (s.cargoId !== c.id) return false;
        const opId = resolveShipmentRequesterId(s, users);
        return allowedTeamIds.has(opId) || (s.createdById && allowedTeamIds.has(s.createdById)) || (s.embarcadorId && allowedTeamIds.has(s.embarcadorId));
      });
      return hasTeamShipment;
    });
  }, [cargos, isRestrictedAgent, allowedTeamIds, currentUser, shipments, users]);

  const scopedCargoIds = useMemo(() => new Set(scopedCargos.map(c => c.id)), [scopedCargos]);

  // Embarques com escopo restrito (equipe, filial ou cargas sob sua responsabilidade - Cenário B)
  const scopedShipments = useMemo(() => {
    if (!isRestrictedAgent) return shipments;
    return shipments.filter(s => {
      const opId = resolveShipmentRequesterId(s, users);
      if (opId && allowedTeamIds.has(opId)) return true;
      if (s.createdById && allowedTeamIds.has(s.createdById)) return true;
      if (s.embarcadorId && allowedTeamIds.has(s.embarcadorId)) return true;
      if (currentUser?.branchId && s.branchId === currentUser.branchId) return true;
      // Cargas sob responsabilidade do Agenciador Líder com embarque externo (Cenário B)
      if (scopedCargoIds.has(s.cargoId)) return true;
      return false;
    });
  }, [shipments, isRestrictedAgent, users, allowedTeamIds, currentUser, scopedCargoIds]);

  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);
  
  const statusOptions = Object.values(ShipmentStatus);
  const operatorOptions = useMemo(() => {
    return scopedUsers.map(u => u.name).filter(Boolean).sort();
  }, [scopedUsers]);
  const clientOptions = Array.from(new Set(scopedCargos.map(c => clients.find(cl => cl.id === c.clientId)?.nomeFantasia || 'N/A'))).filter(Boolean).sort();
  const originOptions = Array.from(new Set(scopedCargos.map(c => c.origin))).filter(Boolean).sort();
  const destOptions = Array.from(new Set(scopedCargos.map(c => c.destination))).filter(Boolean).sort();
  const branchOptions = scopedBranches.map(b => b.name).sort();
  const scheduleTypeOptions = [...Object.values(DailyScheduleType), 'Carga Suspensa'];

  const getEffectiveDate = (s: Shipment) => {
    // Find when it reached Aguardando Nota (effective volume)
    const effectiveEntry = s.statusHistory?.find(h => h.status === ShipmentStatus.AguardandoNota);
    if (effectiveEntry) return effectiveEntry.timestamp.substring(0, 10);
    
    // Fallback if already in effective status
    const isEffectiveStatus = [
      ShipmentStatus.AguardandoNota,
      ShipmentStatus.AguardandoAdiantamento,
      ShipmentStatus.AguardandoAgendamento,
      ShipmentStatus.AguardandoDescarga,
      ShipmentStatus.AguardandoPagamentoSaldo,
      ShipmentStatus.Finalizado
    ].includes(s.status);

    if (isEffectiveStatus && s.createdAt) {
      return s.createdAt.substring(0, 10);
    }
    
    // Return scheduledDate if not effective yet
    return s.scheduledDate;
  };

  const filteredShipments = useMemo(() => {
    return scopedShipments.filter(s => {
       // Filter by effective date (the moment it was loaded/became effective)
       const effDate = getEffectiveDate(s);
       if (!effDate) return false; // Not effective yet

       if (effDate < startDate || effDate > endDate) return false;

       if (filterStatus.length > 0 && !filterStatus.includes(s.status)) return false;

       const cargo = cargoMap.get(s.cargoId);
       if (!cargo) return false;

       if (filterOperator.length > 0) {
         const opId = resolveShipmentRequesterId(s, users);
         const opUser = users.find(u => u.id === opId);
         const opName = opUser?.name || 'N/A';
         if (!filterOperator.includes(opName)) return false;
       }

       if (filterClient.length > 0) {
           const clientName = clients.find(cl => cl.id === cargo.clientId)?.nomeFantasia || 'N/A';
           if (!filterClient.includes(clientName)) return false;
       }

       if (filterOrigin.length > 0 && !filterOrigin.includes(cargo.origin)) return false;
       if (filterDest.length > 0 && !filterDest.includes(cargo.destination)) return false;

       if (filterBranch.length > 0) {
         const branchName = scopedBranches.find(b => b.id === s.branchId)?.name || 'N/A';
         if (!filterBranch.includes(branchName)) return false;
       }

       if (filterScheduleType.length > 0) {
         const isSuspended = cargo.status === CargoStatus.Suspensa;
         if (isSuspended) {
           const matchesSuspended = filterScheduleType.some(t => 
             t === 'Carga Suspensa' || t === 'Cargas Suspensas' || t === 'Suspensa' || t === 'Demanda Suspensa'
           );
           if (!matchesSuspended) return false;
         } else {
           const scheduleEntry = cargo.dailySchedule?.find(e => e.date === effDate || e.date === s.scheduledDate);
           if (!scheduleEntry || !filterScheduleType.includes(scheduleEntry.type)) return false;
         }
       }

       return true;
    });
  }, [scopedShipments, startDate, endDate, filterStatus, filterOperator, filterClient, filterOrigin, filterDest, filterBranch, filterScheduleType, cargoMap, clients, scopedBranches, users]);

  const filteredStays = useMemo(() => {
    return stays.filter(s => {
      const stayDate = s.date.substring(0, 10);
      return stayDate >= startDate && stayDate <= endDate;
    });
  }, [stays, startDate, endDate]);

  const filteredStats = useMemo(() => {
    let totalProgramado = 0;
    let totalEfetivado = 0;

    const programmedStatuses = [
      ShipmentStatus.Pendente,
      ShipmentStatus.AguardandoSeguradora,
      ShipmentStatus.PreCadastro,
      ShipmentStatus.AguardandoCarregamento
    ];

    scopedShipments.forEach(s => {
      // Total Programado: Based on requested statuses and date range
      const isProgrammedStatus = programmedStatuses.includes(s.status);
      if (isProgrammedStatus && s.scheduledDate >= startDate && s.scheduledDate <= endDate) {
        totalProgramado += s.shipmentTonnage || 0;
      }

      // Total Efetivado: Based on reaching 'Ag. Nota' WITHIN FILTER RANGE
      const effectiveEntry = s.statusHistory?.find(h => h.status === ShipmentStatus.AguardandoNota);
      let effDateStr: string | null = null;
      if (effectiveEntry) {
        effDateStr = effectiveEntry.timestamp.substring(0, 10);
      } else if ([
        ShipmentStatus.AguardandoNota,
        ShipmentStatus.AguardandoAdiantamento,
        ShipmentStatus.AguardandoAgendamento,
        ShipmentStatus.AguardandoDescarga,
        ShipmentStatus.AguardandoPagamentoSaldo,
        ShipmentStatus.Finalizado
      ].includes(s.status) && s.createdAt) {
        effDateStr = s.createdAt.substring(0, 10);
      }

      if (effDateStr && effDateStr >= startDate && effDateStr <= endDate) {
        totalEfetivado += s.shipmentTonnage || 0;
      }
    });

    return { totalProgramado, totalEfetivado };
  }, [scopedShipments, startDate, endDate]);

  const kpis = useMemo(() => {
    let grossBilled = 0;
    let effectiveGrossBilled = 0;
    let profitMargin = 0; 
    let totalProfitMargin = 0; 

    const profitMarginStatuses = [
        ShipmentStatus.Pendente,
        ShipmentStatus.AguardandoSeguradora,
        ShipmentStatus.PreCadastro,
        ShipmentStatus.AguardandoCarregamento,
        ShipmentStatus.AguardandoNota,
        ShipmentStatus.AguardandoAdiantamento,
        ShipmentStatus.AguardandoAgendamento,
        ShipmentStatus.AguardandoDescarga,
        ShipmentStatus.AguardandoPagamentoSaldo,
        ShipmentStatus.Finalizado
    ];

    const totalProfitMarginStatuses = [
        ShipmentStatus.AguardandoNota,
        ShipmentStatus.AguardandoAdiantamento,
        ShipmentStatus.AguardandoAgendamento,
        ShipmentStatus.AguardandoDescarga,
        ShipmentStatus.AguardandoPagamentoSaldo,
        ShipmentStatus.Finalizado
    ];

    filteredShipments.forEach(s => {
       const cargo = cargoMap.get(s.cargoId);
       if (!cargo) return;

       if (profitMarginStatuses.includes(s.status)) {
           const grossRate = s.companyFreightRateSnapshot || cargo.companyFreightValuePerTon;
           const driverRate = s.driverFreightRateSnapshot || cargo.driverFreightValuePerTon;
           const commissionRate = cargo.salespersonCommissionPerTon || 0;
           
           const demurrageRevenue = stays
               .filter(stay => stay.shipmentId === s.id)
               .reduce((sum, stay) => sum + (stay.approvedValue || 0), 0);
               
           const demurrageProfit = stays
               .filter(stay => stay.shipmentId === s.id)
               .reduce((sum, stay) => sum + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);
               
           const profit = ((grossRate - driverRate - commissionRate) * s.shipmentTonnage) + demurrageProfit;
           const revenue = (grossRate * s.shipmentTonnage) + demurrageRevenue;
           
           grossBilled += revenue;
           profitMargin += profit;

           if (totalProfitMarginStatuses.includes(s.status)) {
               totalProfitMargin += profit;
               effectiveGrossBilled += revenue;
           }
       }
    });

    const percentageMargin = grossBilled > 0 ? (profitMargin / grossBilled) * 100 : 0;
    const effectivePercentageMargin = effectiveGrossBilled > 0 ? (totalProfitMargin / effectiveGrossBilled) * 100 : 0;

    return { 
        grossBilled, 
        profitMargin, 
        totalProfitMargin, 
        percentageMargin,
        effectivePercentageMargin,
        count: filteredShipments.length 
    };
  }, [filteredShipments, cargoMap, stays]);

  const canViewCommercialReport = useMemo(() => {
    if (!currentUser) return false;
    return [
      UserProfile.Comercial, 
      UserProfile.Admin, 
      UserProfile.Supervisor, 
      UserProfile.Diretor,
      UserProfile.Coordenador,
      UserProfile.AgenciadorLider,
      UserProfile.AgenciadorEmbarque
    ].includes(currentUser.profile);
  }, [currentUser]);

  const renderReport = () => {
    switch(activeReport) {
      case 'comercial':
        return <SupervisorReport shipments={filteredShipments} cargos={scopedCargos} users={scopedUsers} stays={stays} currentUser={currentUser} />;
      case 'embarcadores':
        return <ShipperReport shipments={filteredShipments} cargos={scopedCargos} clients={clients} users={scopedUsers} currentUser={currentUser} companyLogo={companyLogo} />;
      case 'clientes':
        return <ClientReport shipments={filteredShipments} cargos={scopedCargos} clients={clients} stays={stays} companyLogo={companyLogo} />;
      case 'vendedores':
        return <ExternalSalespersonReport shipments={filteredShipments} cargos={scopedCargos} />;
      case 'tempo-operacao':
        return <OperationalTimingReport shipments={filteredShipments} />;
      case 'filiais':
        return <BranchReport shipments={filteredShipments} cargos={scopedCargos} branches={scopedBranches} users={scopedUsers} stays={stays} currentUser={currentUser} />;
      case 'estadias':
        if (loadingStays) {
          return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium animate-pulse">Carregando dados financeiros das estadias...</p>
            </div>
          );
        }
        return <StayFinancialReport stays={filteredStays} />;
      case 'previsao-demandas':
        return <DemandForecastReport cargos={scopedCargos} clients={clients} shipments={filteredShipments} companyLogo={companyLogo} filterScheduleTypeExternal={filterScheduleType} />;
      default:
        return null;
    }
  };
  
  const isEmbarcador = currentUser?.profile === UserProfile.Embarcador;

  const navItems = [
      ...(canViewCommercialReport ? [{ id: 'comercial', label: 'Relatório Supervisão', icon: BriefcaseIcon }] : []),
      { id: 'embarcadores', label: 'Embarcadores', icon: ShipIcon },
      ...(!isEmbarcador ? [
        { id: 'clientes', label: 'Clientes', icon: UsersIcon },
        { id: 'vendedores', label: 'Vendedores', icon: UsersIcon },
        { id: 'filiais', label: 'Filiais', icon: Building2 },
        { id: 'estadias', label: 'Financeiro Estadias', icon: DollarSign },
      ] : []),
      { id: 'tempo-operacao', label: 'Tempo de Operação', icon: ClockIcon },
      { id: 'previsao-demandas', label: 'Previsão de Demandas', icon: TrendingUp },
  ];

  /* Ensure initial tab is permissible */
  useState(() => {
    if (!canViewCommercialReport && activeReport === 'comercial') {
      setActiveReport('embarcadores');
    }
  });

  const activeFiltersCount = (filterStatus.length > 0 ? 1 : 0) + (filterOperator.length > 0 ? 1 : 0) + (filterClient.length > 0 ? 1 : 0) + (filterOrigin.length > 0 ? 1 : 0) + (filterDest.length > 0 ? 1 : 0) + (filterBranch.length > 0 ? 1 : 0) + (filterScheduleType.length > 0 ? 1 : 0);

  const clearFilters = () => {
      setFilterStatus([]);
      setFilterOperator([]);
      setFilterClient([]);
      setFilterOrigin([]);
      setFilterDest([]);
      setFilterBranch([]);
      setFilterScheduleType([]);
  };

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
      <Header title="Relatórios" />

      {/* HORIZONTAL REPORTS NAVIGATION (ACIMA DOS FILTROS) */}
      <div className="glass-panel rounded-2xl p-2 mb-6 overflow-x-auto scrollbar-thin">
        <nav className="flex items-center gap-2 min-w-max" aria-label="Navegação de Relatórios">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveReport(item.id as ActiveReport)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer ${
                activeReport === item.id
                  ? 'bg-primary text-white shadow-md shadow-primary/25 font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-gray-800/70'
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
      
      {/* GLOBAL FILTERS SECTION (COMPACTO E MODERNO) */}
      <div className="glass-panel rounded-2xl mb-4">
        <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 gap-3">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md px-3 py-1.5 rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-inner">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-xs focus:ring-0 outline-none font-medium text-gray-700 dark:text-gray-200 cursor-pointer" title="Data Inicial" />
              <span className="text-gray-400 text-xs font-medium">até</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-xs focus:ring-0 outline-none font-medium text-gray-700 dark:text-gray-200 cursor-pointer" title="Data Final" />
            </div>
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all duration-200 font-medium text-xs cursor-pointer ${showFilters || activeFiltersCount > 0 ? 'bg-primary text-white shadow-sm' : 'bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtros Avançados {activeFiltersCount > 0 && <span className="ml-1 bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{activeFiltersCount}</span>}</span>
            </button>
          </div>
        </div>

        {showFilters && (
            <div className="p-4 border-t border-gray-200/30 dark:border-gray-700/30 bg-gray-50/30 dark:bg-gray-900/20 rounded-b-2xl animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    <MultiSelectDropdown label="Status do Embarque" options={statusOptions} selectedValues={filterStatus} onChange={setFilterStatus} placeholder="Todos..." />
                    <MultiSelectDropdown label="Operador / Equipe" options={operatorOptions} selectedValues={filterOperator} onChange={setFilterOperator} placeholder="Todos..." />
                    <MultiSelectDropdown label="Cliente" options={clientOptions} selectedValues={filterClient} onChange={setFilterClient} placeholder="Todos..." />
                    <MultiSelectDropdown label="Origem" options={originOptions} selectedValues={filterOrigin} onChange={setFilterOrigin} placeholder="Todas..." />
                    <MultiSelectDropdown label="Destino" options={destOptions} selectedValues={filterDest} onChange={setFilterDest} placeholder="Todos..." />
                    <MultiSelectDropdown label="Filial" options={branchOptions} selectedValues={filterBranch} onChange={setFilterBranch} placeholder="Todas..." />
                    <MultiSelectDropdown label="Tipo de Programação" options={scheduleTypeOptions} selectedValues={filterScheduleType} onChange={setFilterScheduleType} placeholder="Todos..." />
                </div>
                {activeFiltersCount > 0 && (
                    <div className="mt-4 flex justify-end">
                        <button onClick={clearFilters} className="text-xs flex items-center gap-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors font-medium">
                            <X className="w-3.5 h-3.5" /> Limpar Filtros
                        </button>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* GLOBAL KPIs SECTION (Visível nos relatórios gerais, para não duplicar no Relatório Supervisão) */}
      {activeReport !== 'comercial' && (
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${isEmbarcador ? 'lg:grid-cols-3' : 'lg:grid-cols-4 xl:grid-cols-7'} gap-3 mb-5`}>
           <div className="p-3.5 glass-panel rounded-xl flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
               <div className="w-9 h-9 rounded-lg bg-blue-50/80 dark:bg-blue-900/40 flex flex-shrink-0 items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner"><ShipIcon className="w-5 h-5" /></div>
               <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5">Embarques</p>
                  <p className="text-lg font-black text-gray-800 dark:text-gray-100 tracking-tight truncate">{kpis.count}</p>
               </div>
           </div>
           <div className="p-3.5 glass-panel rounded-xl flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
               <div className="w-9 h-9 rounded-lg bg-gray-50/80 dark:bg-gray-800/40 flex flex-shrink-0 items-center justify-center text-gray-600 dark:text-gray-400 shadow-inner"><Package className="w-5 h-5" /></div>
               <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Total Programado">Total Prog.</p>
                  <p className="text-lg font-black text-gray-800 dark:text-gray-100 tracking-tight truncate">{Math.round(filteredStats.totalProgramado).toLocaleString('pt-BR')} <span className="text-[10px] font-medium text-gray-400">ton</span></p>
               </div>
           </div>
           <div className="p-3.5 glass-panel rounded-xl flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
               <div className="w-9 h-9 rounded-lg bg-emerald-50/80 dark:bg-emerald-900/30 flex flex-shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner"><CheckCircle className="w-5 h-5" /></div>
               <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Total Efetivado">Total Efetiv.</p>
                  <p className="text-lg font-black text-gray-800 dark:text-gray-100 tracking-tight truncate">{Math.round(filteredStats.totalEfetivado).toLocaleString('pt-BR')} <span className="text-[10px] font-medium text-gray-400">ton</span></p>
               </div>
           </div>
           {!isEmbarcador && (
             <>
               <div className="p-3.5 glass-panel rounded-xl flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                   <div className="w-9 h-9 rounded-lg bg-green-50/80 dark:bg-green-900/40 flex flex-shrink-0 items-center justify-center text-green-600 dark:text-green-400 shadow-inner"><DollarSign className="w-5 h-5" /></div>
                   <div className="min-w-0 flex-1">
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Faturamento Bruto">Fat. Bruto</p>
                      <p className="text-lg font-black text-gray-800 dark:text-gray-100 tracking-tight truncate" title={formatCurrency(kpis.grossBilled)}>
                         R$ {(kpis.grossBilled / 1000).toFixed(1)}k
                      </p>
                   </div>
               </div>

               <div className="p-3.5 glass-panel rounded-xl flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                   <div className="w-9 h-9 rounded-lg bg-teal-50/80 dark:bg-teal-900/40 flex flex-shrink-0 items-center justify-center text-teal-600 dark:text-teal-400 shadow-inner"><DollarSign className="w-5 h-5" /></div>
                   <div className="min-w-0 flex-1">
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Lucro Estimado">Lucro Est.</p>
                      <p className="text-lg font-black text-gray-800 dark:text-gray-100 tracking-tight truncate" title={formatCurrency(kpis.profitMargin)}>
                         R$ {(kpis.profitMargin / 1000).toFixed(1)}k
                      </p>
                   </div>
               </div>

               <div className="p-3.5 glass-panel rounded-xl flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                   <div className="w-9 h-9 rounded-lg bg-indigo-50/80 dark:bg-indigo-900/40 flex flex-shrink-0 items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner"><DollarSign className="w-5 h-5" /></div>
                   <div className="min-w-0 flex-1">
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Lucro Efetivado">Lucro Efe.</p>
                      <p className="text-lg font-black text-gray-800 dark:text-gray-100 tracking-tight truncate" title={formatCurrency(kpis.totalProfitMargin)}>
                         R$ {(kpis.totalProfitMargin / 1000).toFixed(1)}k
                      </p>
                   </div>
               </div>

               <div className="p-3.5 glass-panel rounded-xl flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                   <div className="w-9 h-9 rounded-lg bg-purple-50/80 dark:bg-purple-900/40 flex flex-shrink-0 items-center justify-center text-purple-600 dark:text-purple-400 shadow-inner"><TrendingUp className="w-5 h-5" /></div>
                   <div className="min-w-0 flex-1">
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Margem de Lucro Total">Margem</p>
                      <p className="text-lg font-black text-gray-800 dark:text-gray-100 tracking-tight truncate" title={`${kpis.percentageMargin.toFixed(2)}% (Efetivado: ${kpis.effectivePercentageMargin.toFixed(2)}%)`}>
                         {kpis.percentageMargin.toFixed(1)}%
                      </p>
                   </div>
               </div>
             </>
           )}
        </div>
      )}

      {/* ÁREA PRINCIPAL DO RELATÓRIO (LARGURA TOTAL) */}
      <main className="w-full pb-16">
        {renderReport()}
      </main>
    </>
  );
};

export default ReportsPage;