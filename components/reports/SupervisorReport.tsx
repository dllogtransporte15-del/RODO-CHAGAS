import React, { useMemo, useState } from 'react';
import type { Shipment, User, Cargo } from '../../types';
import { ShipmentStatus, UserProfile, CargoStatus } from '../../types';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { StayRecord } from '../../utils/toolStorage';
import { 
  Briefcase, 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  Truck, 
  Package, 
  Search, 
  Percent, 
  Info,
  Award,
  LayoutGrid,
  Table as TableIcon,
  X,
  ExternalLink
} from 'lucide-react';

interface SupervisorReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  users: User[];
  stays?: StayRecord[];
}

interface ResponsibleStats {
  user: User;
  isFallback: boolean;
  cargos: Cargo[];
  shipments: Shipment[];
  totalTonnage: number;
  grossCompanyFreight: number;
  grossDriverFreight: number;
  totalDemurrageProfit: number;
  netProfit: number;
  commission: number; // 3% do lucro líquido das suas próprias cargas
}

const COUNTABLE_STATUSES = [
  ShipmentStatus.AguardandoNota,
  ShipmentStatus.AguardandoAdiantamento,
  ShipmentStatus.AguardandoAgendamento,
  ShipmentStatus.AguardandoDescarga,
  ShipmentStatus.AguardandoPagamentoSaldo,
  ShipmentStatus.Finalizado
];

const SupervisorReport: React.FC<SupervisorReportProps> = ({ shipments, cargos, users, stays = [] }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [expandedUserIds, setExpandedUserIds] = useState<Record<string, boolean>>({});
  const [showRuleModal, setShowRuleModal] = useState<boolean>(false);

  const toggleExpand = (userId: string) => {
    setExpandedUserIds(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const usersMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);

  // Função para determinar o Comercial Responsável por uma carga
  const getCargoResponsible = (cargo: Cargo): { user: User; isFallback: boolean } => {
    if (cargo.createdById && usersMap.has(cargo.createdById)) {
      return { user: usersMap.get(cargo.createdById)!, isFallback: false };
    }

    if (cargo.history && cargo.history.length > 0) {
      const creatorLog = cargo.history[0];
      if (creatorLog?.userId && usersMap.has(creatorLog.userId)) {
        return { user: usersMap.get(creatorLog.userId)!, isFallback: true };
      }
    }

    const fallbackUser: User = {
      id: cargo.createdById || 'sem-responsavel',
      name: cargo.salespersonName || 'Sem Responsável Definido',
      email: '',
      profile: UserProfile.Supervisor,
      active: true,
    };
    return { user: fallbackUser, isFallback: true };
  };

  // Mapeia todas as estatísticas agrupadas por Comercial Responsável
  const responsibleStats = useMemo(() => {
    const statsMap = new Map<string, ResponsibleStats>();

    // Usuários com perfil Supervisor ou Coordenador pré-inclusos
    users
      .filter(u => u.profile === UserProfile.Supervisor || u.profile === UserProfile.Coordenador)
      .forEach(u => {
        statsMap.set(u.id, {
          user: u,
          isFallback: false,
          cargos: [],
          shipments: [],
          totalTonnage: 0,
          grossCompanyFreight: 0,
          grossDriverFreight: 0,
          totalDemurrageProfit: 0,
          netProfit: 0,
          commission: 0,
        });
      });

    // Mapeia cargas para seus responsáveis
    cargos.forEach(cargo => {
      const { user: responsible, isFallback } = getCargoResponsible(cargo);
      
      if (!statsMap.has(responsible.id)) {
        statsMap.set(responsible.id, {
          user: responsible,
          isFallback,
          cargos: [],
          shipments: [],
          totalTonnage: 0,
          grossCompanyFreight: 0,
          grossDriverFreight: 0,
          totalDemurrageProfit: 0,
          netProfit: 0,
          commission: 0,
        });
      }

      statsMap.get(responsible.id)!.cargos.push(cargo);
    });

    // Mapeia embarques para as cargas
    shipments.forEach(shipment => {
      if (!COUNTABLE_STATUSES.includes(shipment.status)) return;

      const cargo = cargoMap.get(shipment.cargoId);
      if (!cargo) return;

      const { user: responsible } = getCargoResponsible(cargo);
      const stats = statsMap.get(responsible.id);
      if (!stats) return;

      stats.shipments.push(shipment);

      const grossRate = shipment.companyFreightRateSnapshot || cargo.companyFreightValuePerTon;
      const driverRate = shipment.driverFreightRateSnapshot || cargo.driverFreightValuePerTon;
      const commissionRate = cargo.salespersonCommissionPerTon || 0;

      const demurrageProfit = stays
        .filter(stay => stay.shipmentId === shipment.id)
        .reduce((sum, stay) => sum + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);

      const tonnage = shipment.shipmentTonnage || 0;
      const companyVal = grossRate * tonnage;
      const driverVal = driverRate * tonnage;
      const shipmentNetProfit = ((grossRate - driverRate - commissionRate) * tonnage) + demurrageProfit;

      stats.totalTonnage += tonnage;
      stats.grossCompanyFreight += companyVal;
      stats.grossDriverFreight += driverVal;
      stats.totalDemurrageProfit += demurrageProfit;
      stats.netProfit += shipmentNetProfit;
    });

    // Comissão individual de 3% sobre o Lucro Líquido das próprias cargas
    statsMap.forEach(stat => {
      stat.commission = stat.netProfit > 0 ? stat.netProfit * 0.03 : 0;
    });

    return Array.from(statsMap.values())
      .filter(stat => {
        // Regra do relatório:
        // Deve aparecer apenas se tiver histórico de embarque (mesmo com cargas Fechadas)
        // OU se tiver pelo menos uma carga com status "Em andamento".
        const hasShipmentHistory = stat.shipments.length > 0;
        const hasActiveCargo = stat.cargos.some(c => 
          c.status === CargoStatus.EmAndamento || 
          String(c.status).toLowerCase().includes('andamento')
        );
        return hasShipmentHistory || hasActiveCargo;
      })
      .sort((a, b) => b.netProfit - a.netProfit);
  }, [cargos, shipments, users, cargoMap, usersMap, stays]);

  // Filtro
  const filteredStats = useMemo(() => {
    return responsibleStats.filter(stat => {
      const matchesUser = selectedUserId === 'all' || stat.user.id === selectedUserId;
      const matchesSearch = searchTerm.trim() === '' || 
        stat.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stat.user.profile.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesUser && matchesSearch;
    });
  }, [responsibleStats, selectedUserId, searchTerm]);

  // Totais
  const totals = useMemo(() => {
    return filteredStats.reduce((acc, curr) => ({
      cargosCount: acc.cargosCount + curr.cargos.length,
      shipmentsCount: acc.shipmentsCount + curr.shipments.length,
      tonnage: acc.tonnage + curr.totalTonnage,
      grossCompany: acc.grossCompany + curr.grossCompanyFreight,
      grossDriver: acc.grossDriver + curr.grossDriverFreight,
      netProfit: acc.netProfit + curr.netProfit,
      commission: acc.commission + curr.commission,
    }), {
      cargosCount: 0,
      shipmentsCount: 0,
      tonnage: 0,
      grossCompany: 0,
      grossDriver: 0,
      netProfit: 0,
      commission: 0,
    });
  }, [filteredStats]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getProfileBadgeColor = (profile: UserProfile | string) => {
    switch (profile) {
      case UserProfile.Supervisor:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case UserProfile.Coordenador:
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case UserProfile.AgenciadorLider:
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case UserProfile.AgenciadorEmbarque:
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
      case UserProfile.Comercial:
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case UserProfile.Diretor:
      case UserProfile.Admin:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* BARRA SUPERIOR INTEGRADA E OTIMIZADA */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-4 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Lado Esquerdo: Identificação & Regra */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-400/10 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                Relatório Supervisão
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                3,0% s/ Lucro Líquido
              </span>
              <button
                type="button"
                onClick={() => setShowRuleModal(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                title="Ver regra de apuração"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Regra</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Apuração individual das cargas sob a titularidade de cada responsável.
            </p>
          </div>
        </div>

        {/* Lado Direito: Alternador de Visualização & Filtros Rápidos */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Alternador de Modo de Exibição */}
          <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-700/60 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
              title="Visualização em Tabela Expandida"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabela</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
              title="Visualização em Cards Laterais (2 Colunas)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative min-w-[180px] sm:min-w-[210px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar responsável..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200"
            />
          </div>

          {/* Seletor de Responsável */}
          <div className="min-w-[190px]">
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200 font-medium"
            >
              <option value="all">Todos os Responsáveis ({responsibleStats.length})</option>
              {responsibleStats.map(s => (
                <option key={s.user.id} value={s.user.id}>
                  {s.user.name} ({s.user.profile})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* CARDS DE KPIS CONSOLIDADOS (COMPACTOS, 5 COLUNAS APROVEITANDO TODA A LARGURA) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Cargas Ativas</p>
            <p className="text-base font-black text-gray-900 dark:text-white truncate">{totals.cargosCount}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Embarques</p>
            <p className="text-base font-black text-gray-900 dark:text-white truncate">{totals.shipmentsCount}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Volume (Ton)</p>
            <p className="text-base font-black text-gray-900 dark:text-white truncate">
              {totals.tonnage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 shrink-0">
            <DollarSignIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Lucro Líquido</p>
            <p className="text-base font-black text-gray-900 dark:text-white truncate">
              {formatCurrency(totals.netProfit)}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/30 dark:border-emerald-500/30 shadow-xs flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="p-2.5 rounded-lg bg-emerald-600 text-white shrink-0 shadow-sm shadow-emerald-500/30">
            <Percent className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Comissão (3%)</p>
              <span className="text-[9px] font-extrabold bg-emerald-200/80 dark:bg-emerald-800/80 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.2 rounded-full">3,0%</span>
            </div>
            <p className="text-base font-black text-emerald-600 dark:text-emerald-400 truncate">
              {formatCurrency(totals.commission)}
            </p>
          </div>
        </div>
      </div>

      {/* MODAL / POPUP DA REGRA */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
                <Info className="w-5 h-5" />
                <h3 className="text-base text-gray-900 dark:text-white">Regra de Cálculo de Supervisão</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowRuleModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4 text-xs text-gray-600 dark:text-gray-300 space-y-3 leading-relaxed">
              <p>
                <strong>1. Titularidade da Carga:</strong> Cada Comercial Responsável tem seus números apurados exclusivamente pelas cargas em que é o titular registrado.
              </p>
              <p>
                <strong>2. Cargas sem Responsável Explícito:</strong> Caso uma carga antiga não tenha um responsável definido, o sistema considera automaticamente o usuário que realizou a criação original da carga através do histórico.
              </p>
              <p>
                <strong>3. Lucro Líquido do Embarque:</strong>
                <br />
                <span className="font-mono bg-gray-100 dark:bg-gray-700/60 p-1 rounded inline-block mt-1">
                  (Frete Empresa - Frete Motorista - Comissões Externas) × Toneladas + Estadias Líquidas
                </span>
              </p>
              <p>
                <strong>4. Comissão Individual:</strong> Aplica-se a alíquota de <strong>3,0% sobre o Lucro Líquido</strong> gerado pelas cargas de cada responsável.
              </p>
            </div>
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRuleModal(false)}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÁREA PRINCIPAL: LISTAGEM UTILIZANDO OS ESPAÇOS LATERAIS */}
      {filteredStats.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700">
          <Briefcase className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="font-semibold text-base">Nenhum responsável encontrado</p>
          <p className="text-xs">Ajuste os filtros de busca ou período selecionado.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* ========================================================================= */
        /* MODO 1: TABELA EXECUTIVA CONSOLIDADA (APROVEITA 100% DA LARGURA LATERAL) */
        /* ========================================================================= */
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-900/50 border-b border-gray-200/80 dark:border-gray-700/80 font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-[11px]">
                  <th className="py-3 px-4">Responsável</th>
                  <th className="py-3 px-3 text-center">Perfil</th>
                  <th className="py-3 px-3 text-right">Cargas</th>
                  <th className="py-3 px-3 text-right">Embarques</th>
                  <th className="py-3 px-3 text-right">Volume (Ton)</th>
                  <th className="py-3 px-3 text-right">Frete Empresa</th>
                  <th className="py-3 px-3 text-right">Frete Motorista</th>
                  <th className="py-3 px-3 text-right">Lucro Líquido</th>
                  <th className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-black">Comissão (3%)</th>
                  <th className="py-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium">
                {filteredStats.map(stat => {
                  const isExpanded = !!expandedUserIds[stat.user.id];
                  return (
                    <React.Fragment key={stat.user.id}>
                      <tr className={`hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors ${isExpanded ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''}`}>
                        {/* Nome + Avatar */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs">
                              {stat.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-gray-900 dark:text-white block text-sm">
                                {stat.user.name}
                              </span>
                              {stat.isFallback && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                  Criador Original
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Perfil */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getProfileBadgeColor(stat.user.profile)}`}>
                            {stat.user.profile}
                          </span>
                        </td>

                        {/* Cargas */}
                        <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-gray-800 dark:text-gray-200">
                          {stat.cargos.length}
                        </td>

                        {/* Embarques */}
                        <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-gray-800 dark:text-gray-200">
                          {stat.shipments.length}
                        </td>

                        {/* Volume */}
                        <td className="py-3 px-3 text-right whitespace-nowrap text-gray-700 dark:text-gray-300 font-semibold">
                          {stat.totalTonnage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                        </td>

                        {/* Frete Empresa */}
                        <td className="py-3 px-3 text-right whitespace-nowrap text-gray-700 dark:text-gray-300">
                          {formatCurrency(stat.grossCompanyFreight)}
                        </td>

                        {/* Frete Motorista */}
                        <td className="py-3 px-3 text-right whitespace-nowrap text-gray-500 dark:text-gray-400">
                          {formatCurrency(stat.grossDriverFreight)}
                        </td>

                        {/* Lucro Líquido */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className={`font-black text-sm ${stat.netProfit >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                            {formatCurrency(stat.netProfit)}
                          </span>
                        </td>

                        {/* Comissão 3% */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 font-black text-sm text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(stat.commission)}
                          </span>
                        </td>

                        {/* Ações / Expandir */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleExpand(stat.user.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
                            title={isExpanded ? 'Recolher detalhes' : 'Ver cargas e embarques'}
                          >
                            <span>{stat.cargos.length} cargas</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* LINHA EXPANSÍVEL COM AS CARGAS DO RESPONSÁVEL */}
                      {isExpanded && (
                        <tr className="bg-gray-50/60 dark:bg-gray-900/60">
                          <td colSpan={10} className="p-4 border-y border-gray-200/50 dark:border-gray-700/50">
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200/60 dark:border-gray-700/60 shadow-xs space-y-3">
                              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                  Detalhamento de Cargas — {stat.user.name} ({stat.cargos.length} cargas vinculadas)
                                </h4>
                                <span className="text-[11px] text-gray-400">
                                  Lucro Líquido Total: <strong className="text-gray-700 dark:text-gray-200">{formatCurrency(stat.netProfit)}</strong>
                                </span>
                              </div>

                              {stat.cargos.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Nenhuma carga cadastrada para este responsável.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="border-b border-gray-200/60 dark:border-gray-700/60 text-gray-400 uppercase text-[10px] font-bold">
                                        <th className="py-2 px-2.5">#Seq</th>
                                        <th className="py-2 px-2.5">Rota (Origem → Destino)</th>
                                        <th className="py-2 px-2.5">Local Origem / Destino</th>
                                        <th className="py-2 px-2.5 text-center">Status</th>
                                        <th className="py-2 px-2.5 text-right">Embarques</th>
                                        <th className="py-2 px-2.5 text-right">Volume</th>
                                        <th className="py-2 px-2.5 text-right">Lucro Carga</th>
                                        <th className="py-2 px-2.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">Comissão 3%</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                      {stat.cargos.map(cargo => {
                                        const cargoShipments = stat.shipments.filter(s => s.cargoId === cargo.id);
                                        const cargoTonnage = cargoShipments.reduce((sum, s) => sum + (s.shipmentTonnage || 0), 0);
                                        const cargoProfit = cargoShipments.reduce((sum, s) => {
                                          const grossRate = s.companyFreightRateSnapshot || cargo.companyFreightValuePerTon;
                                          const driverRate = s.driverFreightRateSnapshot || cargo.driverFreightValuePerTon;
                                          const commRate = cargo.salespersonCommissionPerTon || 0;
                                          const demurrageProfit = stays
                                            .filter(stay => stay.shipmentId === s.id)
                                            .reduce((acc, stay) => acc + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);
                                          return sum + (((grossRate - driverRate - commRate) * s.shipmentTonnage) + demurrageProfit);
                                        }, 0);
                                        const cargoCommission = cargoProfit > 0 ? cargoProfit * 0.03 : 0;

                                        return (
                                          <tr key={cargo.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                            <td className="py-2 px-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                                              #{cargo.sequenceId}
                                            </td>
                                            <td className="py-2 px-2.5 font-medium text-gray-800 dark:text-gray-200">
                                              {cargo.origin} <span className="text-gray-400">→</span> {cargo.destination}
                                            </td>
                                            <td className="py-2 px-2.5 text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                              {cargo.originLocation || cargo.destinationLocation || '-'}
                                            </td>
                                            <td className="py-2 px-2.5 text-center">
                                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                                cargo.status === 'Em andamento'
                                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                                  : cargo.status === 'Fechada'
                                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                              }`}>
                                                {cargo.status}
                                              </span>
                                            </td>
                                            <td className="py-2 px-2.5 text-right font-semibold text-gray-700 dark:text-gray-300">
                                              {cargoShipments.length}
                                            </td>
                                            <td className="py-2 px-2.5 text-right text-gray-700 dark:text-gray-300">
                                              {cargoTonnage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ton
                                            </td>
                                            <td className="py-2 px-2.5 text-right font-bold text-gray-900 dark:text-white">
                                              {formatCurrency(cargoProfit)}
                                            </td>
                                            <td className="py-2 px-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                                              {formatCurrency(cargoCommission)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MODO 2: GRID DUPLO DE CARDS (2 COLUNAS LADO A LADO - OCUPA AS LATERAIS)   */
        /* ========================================================================= */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 w-full">
          {filteredStats.map(stat => {
            const isExpanded = !!expandedUserIds[stat.user.id];
            return (
              <div 
                key={stat.user.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-all flex flex-col justify-between"
              >
                {/* Cabeçalho do Card */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs">
                      {stat.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                          {stat.user.name}
                        </h4>
                        {stat.isFallback && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.2 rounded font-medium">
                            Criador Original
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${getProfileBadgeColor(stat.user.profile)}`}>
                          {stat.user.profile}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {stat.cargos.length} cargas • {stat.shipments.length} embarques
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Badge de Comissão 3% */}
                  <div className="text-right">
                    <p className="text-[9px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Comissão (3%)</p>
                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(stat.commission)}
                    </p>
                  </div>
                </div>

                {/* Métricas do Responsável em Grade 4 Colunas */}
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-gray-800 text-center">
                  <div className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700/40">
                    <p className="text-[10px] uppercase font-semibold text-gray-400">Volume</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5">
                      {stat.totalTonnage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ton
                    </p>
                  </div>

                  <div className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700/40">
                    <p className="text-[10px] uppercase font-semibold text-gray-400">Frete Empresa</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5 truncate" title={formatCurrency(stat.grossCompanyFreight)}>
                      {formatCurrency(stat.grossCompanyFreight)}
                    </p>
                  </div>

                  <div className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700/40">
                    <p className="text-[10px] uppercase font-semibold text-gray-400">Frete Motorista</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5 truncate" title={formatCurrency(stat.grossDriverFreight)}>
                      {formatCurrency(stat.grossDriverFreight)}
                    </p>
                  </div>

                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
                    <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Lucro Líquido</p>
                    <p className={`text-xs font-black mt-0.5 ${stat.netProfit >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                      {formatCurrency(stat.netProfit)}
                    </p>
                  </div>
                </div>

                {/* Botão de Ver Cargas */}
                <div className="px-4 py-2 bg-gray-50/70 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleExpand(stat.user.id)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors cursor-pointer"
                  >
                    <span>{isExpanded ? 'Recolher cargas' : `Ver ${stat.cargos.length} cargas atribuídas`}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Sanfona de Cargas */}
                {isExpanded && (
                  <div className="p-3 bg-gray-50/50 dark:bg-gray-900/60 border-t border-gray-100 dark:border-gray-700 space-y-2">
                    {stat.cargos.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2 text-center">Nenhuma carga atribuída.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {stat.cargos.map(cargo => {
                          const cargoShipments = stat.shipments.filter(s => s.cargoId === cargo.id);
                          const cargoProfit = cargoShipments.reduce((sum, s) => {
                            const grossRate = s.companyFreightRateSnapshot || cargo.companyFreightValuePerTon;
                            const driverRate = s.driverFreightRateSnapshot || cargo.driverFreightValuePerTon;
                            const commRate = cargo.salespersonCommissionPerTon || 0;
                            const demurrageProfit = stays
                              .filter(stay => stay.shipmentId === s.id)
                              .reduce((acc, stay) => acc + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);
                            return sum + (((grossRate - driverRate - commRate) * s.shipmentTonnage) + demurrageProfit);
                          }, 0);
                          const cargoCommission = cargoProfit > 0 ? cargoProfit * 0.03 : 0;

                          return (
                            <div key={cargo.id} className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-xs flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">#{cargo.sequenceId}</span>
                                  <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{cargo.origin} → {cargo.destination}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 truncate mt-0.5">
                                  {cargoShipments.length} embarques • {cargo.status}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[10px] text-gray-400">Lucro: {formatCurrency(cargoProfit)}</p>
                                <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">3%: {formatCurrency(cargoCommission)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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

export default SupervisorReport;
