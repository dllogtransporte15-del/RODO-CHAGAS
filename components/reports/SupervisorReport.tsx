import React, { useMemo, useState } from 'react';
import type { Shipment, User, Cargo } from '../../types';
import { ShipmentStatus, UserProfile, CargoStatus } from '../../types';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { StayRecord } from '../../utils/toolStorage';
import { resolveShipmentRequesterId } from '../../utils/shipperUtils';
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
  Users, 
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';

interface SupervisorReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  users: User[];
  stays?: StayRecord[];
  currentUser?: User | null;
}

export interface ShipmentCommissionDetail {
  shipment: Shipment;
  cargo: Cargo;
  tonnage: number;
  grossCompanyFreight: number;
  grossDriverFreight: number;
  netRevenue: number;
  netProfit: number;
  scenario: 'equipe' | 'terceiros' | 'padrao';
  scenarioTag: string; // Ex: '[Equipe - 25% s/ Lucro]' ou '[Terceiros - 1.5% s/ Fat.]'
  rate: number;
  calculationBase: number;
  calculationBaseLabel: string;
  commissionValue: number;
  operatorId: string;
  operatorName: string;
  isTeamOperator: boolean;
}

export interface ResponsibleStats {
  user: User;
  isFallback: boolean;
  cargos: Cargo[];
  shipments: Shipment[];
  totalTonnage: number;
  grossCompanyFreight: number;
  grossDriverFreight: number;
  totalDemurrageProfit: number;
  totalDemurrageRevenue: number;
  netProfit: number;
  netRevenue: number;
  commission: number; // Total de comissão

  // Discriminação Híbrida do Agenciador Líder
  isLeader: boolean;
  teamRate: number; // Ex: 25%
  externalRate: number; // Ex: 1.5%

  // Cenário A: Equipe / Próprio
  teamShipmentsCount: number;
  teamTonnage: number;
  teamNetProfit: number;
  teamCommission: number;

  // Cenário B: Cargas Externas (Terceiros)
  externalShipmentsCount: number;
  externalTonnage: number;
  externalNetRevenue: number;
  externalCommission: number;

  // Detalhes por embarque
  shipmentDetails: ShipmentCommissionDetail[];
}

const COUNTABLE_STATUSES = [
  ShipmentStatus.AguardandoNota,
  ShipmentStatus.AguardandoAdiantamento,
  ShipmentStatus.AguardandoAgendamento,
  ShipmentStatus.AguardandoDescarga,
  ShipmentStatus.AguardandoPagamentoSaldo,
  ShipmentStatus.Finalizado
];

const SupervisorReport: React.FC<SupervisorReportProps> = ({ shipments, cargos, users, stays = [], currentUser }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [expandedUserIds, setExpandedUserIds] = useState<Record<string, boolean>>({});
  const [expandedSubTab, setExpandedSubTab] = useState<Record<string, 'fretes' | 'cargos'>>({});
  const [showRuleModal, setShowRuleModal] = useState<boolean>(false);

  const toggleExpand = (userId: string) => {
    setExpandedUserIds(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const setSubTab = (userId: string, tab: 'fretes' | 'cargos') => {
    setExpandedSubTab(prev => ({
      ...prev,
      [userId]: tab
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

  // Motor de Cálculo comissionário híbrido
  const responsibleStats = useMemo(() => {
    const statsMap = new Map<string, ResponsibleStats>();

    // Pré-popula usuários elegíveis: Supervisor, Coordenador, Agenciador Líder e Diretor
    users
      .filter(u => 
        u.profile === UserProfile.Supervisor || 
        u.profile === UserProfile.Coordenador ||
        u.profile === UserProfile.AgenciadorLider ||
        u.profile === UserProfile.Diretor
      )
      .forEach(u => {
        const isLeader = u.profile === UserProfile.AgenciadorLider;
        const teamRate = u.leaderProfitCommissionRate !== undefined ? Number(u.leaderProfitCommissionRate) : 25;
        const externalRate = u.leaderRevenueCommissionRate !== undefined ? Number(u.leaderRevenueCommissionRate) : 1.5;

        statsMap.set(u.id, {
          user: u,
          isFallback: false,
          cargos: [],
          shipments: [],
          totalTonnage: 0,
          grossCompanyFreight: 0,
          grossDriverFreight: 0,
          totalDemurrageProfit: 0,
          totalDemurrageRevenue: 0,
          netProfit: 0,
          netRevenue: 0,
          commission: 0,
          isLeader,
          teamRate,
          externalRate,
          teamShipmentsCount: 0,
          teamTonnage: 0,
          teamNetProfit: 0,
          teamCommission: 0,
          externalShipmentsCount: 0,
          externalTonnage: 0,
          externalNetRevenue: 0,
          externalCommission: 0,
          shipmentDetails: [],
        });
      });

    // Mapeia cargas para seus responsáveis
    cargos.forEach(cargo => {
      const { user: responsible, isFallback } = getCargoResponsible(cargo);
      
      if (!statsMap.has(responsible.id)) {
        const isLeader = responsible.profile === UserProfile.AgenciadorLider;
        const teamRate = responsible.leaderProfitCommissionRate !== undefined ? Number(responsible.leaderProfitCommissionRate) : 25;
        const externalRate = responsible.leaderRevenueCommissionRate !== undefined ? Number(responsible.leaderRevenueCommissionRate) : 1.5;

        statsMap.set(responsible.id, {
          user: responsible,
          isFallback,
          cargos: [],
          shipments: [],
          totalTonnage: 0,
          grossCompanyFreight: 0,
          grossDriverFreight: 0,
          totalDemurrageProfit: 0,
          totalDemurrageRevenue: 0,
          netProfit: 0,
          netRevenue: 0,
          commission: 0,
          isLeader,
          teamRate,
          externalRate,
          teamShipmentsCount: 0,
          teamTonnage: 0,
          teamNetProfit: 0,
          teamCommission: 0,
          externalShipmentsCount: 0,
          externalTonnage: 0,
          externalNetRevenue: 0,
          externalCommission: 0,
          shipmentDetails: [],
        });
      }

      const existingCargos = statsMap.get(responsible.id)!.cargos;
      if (!existingCargos.some(c => c.id === cargo.id)) {
        existingCargos.push(cargo);
      }
    });

    // Mapeamento de equipes por Líder
    const leaderTeamMap = new Map<string, Set<string>>();
    users
      .filter(u => u.profile === UserProfile.AgenciadorLider)
      .forEach(leader => {
        const memberIds = new Set<string>();
        memberIds.add(leader.id);
        users
          .filter(u => u.leaderId === leader.id)
          .forEach(member => memberIds.add(member.id));
        leaderTeamMap.set(leader.id, memberIds);
      });

    // Processamento de cada embarque elegível
    shipments.forEach(shipment => {
      if (!COUNTABLE_STATUSES.includes(shipment.status)) return;

      const cargo = cargoMap.get(shipment.cargoId);
      if (!cargo) return;

      const { user: responsible } = getCargoResponsible(cargo);
      const operatorId = resolveShipmentRequesterId(shipment, users);
      const operatorUser = usersMap.get(operatorId);
      const operatorName = operatorUser ? operatorUser.name : (shipment.driverName || 'Operador');

      // Métricas financeiras do frete
      const grossRate = shipment.companyFreightRateSnapshot || cargo.companyFreightValuePerTon;
      const driverRate = shipment.driverFreightRateSnapshot || cargo.driverFreightValuePerTon;
      const commissionRate = cargo.salespersonCommissionPerTon || 0;

      const demurrageProfit = stays
        .filter(stay => stay.shipmentId === shipment.id)
        .reduce((sum, stay) => sum + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);

      const demurrageRevenue = stays
        .filter(stay => stay.shipmentId === shipment.id)
        .reduce((sum, stay) => sum + (stay.approvedValue || 0), 0);

      const tonnage = shipment.shipmentTonnage || 0;
      const companyVal = grossRate * tonnage;
      const driverVal = driverRate * tonnage;
      const netRevenue = companyVal + demurrageRevenue;
      const netProfit = ((grossRate - driverRate - commissionRate) * tonnage) + demurrageProfit;

      // 1. Apuração para o Responsável da Carga
      const respStats = statsMap.get(responsible.id);
      if (respStats) {
        if (!respStats.shipments.some(s => s.id === shipment.id)) {
          respStats.shipments.push(shipment);
        }

        respStats.totalTonnage += tonnage;
        respStats.grossCompanyFreight += companyVal;
        respStats.grossDriverFreight += driverVal;
        respStats.totalDemurrageProfit += demurrageProfit;
        respStats.totalDemurrageRevenue += demurrageRevenue;
        respStats.netProfit += netProfit;
        respStats.netRevenue += netRevenue;

        if (respStats.isLeader) {
          const leaderTeam = leaderTeamMap.get(responsible.id) || new Set([responsible.id]);
          const isTeamOperator = leaderTeam.has(operatorId) || 
            (shipment.embarcadorId ? leaderTeam.has(shipment.embarcadorId) : false) || 
            (shipment.createdById ? leaderTeam.has(shipment.createdById) : false);

          if (isTeamOperator) {
            // CENÁRIO A: Operação da Equipe / Própria -> % sobre Lucro Líquido
            const rate = respStats.teamRate;
            const commVal = netProfit > 0 ? netProfit * (rate / 100) : 0;
            respStats.teamShipmentsCount += 1;
            respStats.teamTonnage += tonnage;
            respStats.teamNetProfit += netProfit;
            respStats.teamCommission += commVal;

            respStats.shipmentDetails.push({
              shipment,
              cargo,
              tonnage,
              grossCompanyFreight: companyVal,
              grossDriverFreight: driverVal,
              netRevenue,
              netProfit,
              scenario: 'equipe',
              scenarioTag: `[Equipe - ${rate}% s/ Lucro]`,
              rate,
              calculationBase: netProfit,
              calculationBaseLabel: 'Lucro Líquido',
              commissionValue: commVal,
              operatorId,
              operatorName,
              isTeamOperator: true,
            });
          } else {
            // CENÁRIO B: Cargas Sob Responsabilidade do Líder com Embarque Externo -> % sobre Faturamento Líquido
            const rate = respStats.externalRate;
            const commVal = netRevenue > 0 ? netRevenue * (rate / 100) : 0;
            respStats.externalShipmentsCount += 1;
            respStats.externalTonnage += tonnage;
            respStats.externalNetRevenue += netRevenue;
            respStats.externalCommission += commVal;

            respStats.shipmentDetails.push({
              shipment,
              cargo,
              tonnage,
              grossCompanyFreight: companyVal,
              grossDriverFreight: driverVal,
              netRevenue,
              netProfit,
              scenario: 'terceiros',
              scenarioTag: `[Terceiros - ${rate}% s/ Fat.]`,
              rate,
              calculationBase: netRevenue,
              calculationBaseLabel: 'Faturamento Líquido',
              commissionValue: commVal,
              operatorId,
              operatorName,
              isTeamOperator: false,
            });
          }

          respStats.commission = respStats.teamCommission + respStats.externalCommission;
        } else {
          // Regra Tradicional para Supervisor / Coordenador: 3,0% sobre o Lucro Líquido
          const rate = 3.0;
          const commVal = netProfit > 0 ? netProfit * 0.03 : 0;
          respStats.commission += commVal;

          respStats.shipmentDetails.push({
            shipment,
            cargo,
            tonnage,
            grossCompanyFreight: companyVal,
            grossDriverFreight: driverVal,
            netRevenue,
            netProfit,
            scenario: 'padrao',
            scenarioTag: `[Padrão - ${rate}% s/ Lucro]`,
            rate,
            calculationBase: netProfit,
            calculationBaseLabel: 'Lucro Líquido',
            commissionValue: commVal,
            operatorId,
            operatorName,
            isTeamOperator: true,
          });
        }
      }

      // 2. Cenário A Adicional: Carga de terceiros embarcada por equipe de um Agenciador Líder
      leaderTeamMap.forEach((teamSet, leaderId) => {
        if (leaderId === responsible.id) return; // Já foi contabilizado acima

        const isTeamOperator = teamSet.has(operatorId) || 
          (shipment.embarcadorId ? teamSet.has(shipment.embarcadorId) : false) ||
          (shipment.createdById ? teamSet.has(shipment.createdById) : false);

        if (isTeamOperator) {
          const leaderStat = statsMap.get(leaderId);
          if (leaderStat) {
            // Adiciona a carga à lista do líder se não estiver lá
            if (!leaderStat.cargos.some(c => c.id === cargo.id)) {
              leaderStat.cargos.push(cargo);
            }
            if (!leaderStat.shipments.some(s => s.id === shipment.id)) {
              leaderStat.shipments.push(shipment);
            }

            leaderStat.totalTonnage += tonnage;
            leaderStat.grossCompanyFreight += companyVal;
            leaderStat.grossDriverFreight += driverVal;
            leaderStat.totalDemurrageProfit += demurrageProfit;
            leaderStat.totalDemurrageRevenue += demurrageRevenue;
            leaderStat.netProfit += netProfit;
            leaderStat.netRevenue += netRevenue;

            const rate = leaderStat.teamRate;
            const commVal = netProfit > 0 ? netProfit * (rate / 100) : 0;
            leaderStat.teamShipmentsCount += 1;
            leaderStat.teamTonnage += tonnage;
            leaderStat.teamNetProfit += netProfit;
            leaderStat.teamCommission += commVal;
            leaderStat.commission = leaderStat.teamCommission + leaderStat.externalCommission;

            leaderStat.shipmentDetails.push({
              shipment,
              cargo,
              tonnage,
              grossCompanyFreight: companyVal,
              grossDriverFreight: driverVal,
              netRevenue,
              netProfit,
              scenario: 'equipe',
              scenarioTag: `[Equipe - ${rate}% s/ Lucro]`,
              rate,
              calculationBase: netProfit,
              calculationBaseLabel: 'Lucro Líquido',
              commissionValue: commVal,
              operatorId,
              operatorName,
              isTeamOperator: true,
            });
          }
        }
      });
    });

    const allStats = Array.from(statsMap.values())
      .filter(stat => {
        const hasShipmentHistory = stat.shipments.length > 0;
        const hasActiveCargo = stat.cargos.some(c => 
          c.status === CargoStatus.EmAndamento || 
          String(c.status).toLowerCase().includes('andamento')
        );
        return hasShipmentHistory || hasActiveCargo;
      });

    // Escopo e Privacidade: Se o usuário logado for Agenciador Líder, Agenciador ou Embarcador (não Admin/Diretor)
    // restringe os dados, métricas e listagem exclusivamente para a sua equipe
    if (currentUser && ![UserProfile.Admin, UserProfile.Diretor].includes(currentUser.profile)) {
      const allowedTeamIds = new Set<string>();
      allowedTeamIds.add(currentUser.id);

      if (currentUser.profile === UserProfile.AgenciadorLider) {
        users.filter(u => u.leaderId === currentUser.id).forEach(u => allowedTeamIds.add(u.id));
      } else if (currentUser.profile === UserProfile.AgenciadorEmbarque) {
        if (currentUser.leaderId) {
          allowedTeamIds.add(currentUser.leaderId);
          users.filter(u => u.leaderId === currentUser.leaderId).forEach(u => allowedTeamIds.add(u.id));
        }
      }

      return allStats
        .filter(stat => allowedTeamIds.has(stat.user.id))
        .sort((a, b) => b.commission - a.commission || b.netProfit - a.netProfit);
    }

    return allStats.sort((a, b) => b.commission - a.commission || b.netProfit - a.netProfit);
  }, [cargos, shipments, users, cargoMap, usersMap, stays, currentUser]);

  // Filtros aplicados
  const filteredStats = useMemo(() => {
    return responsibleStats.filter(stat => {
      const matchesUser = selectedUserId === 'all' || stat.user.id === selectedUserId;
      const matchesSearch = searchTerm.trim() === '' || 
        stat.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stat.user.profile.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesUser && matchesSearch;
    });
  }, [responsibleStats, selectedUserId, searchTerm]);

  // Totais consolidados
  const totals = useMemo(() => {
    return filteredStats.reduce((acc, curr) => ({
      cargosCount: acc.cargosCount + curr.cargos.length,
      shipmentsCount: acc.shipmentsCount + curr.shipments.length,
      tonnage: acc.tonnage + curr.totalTonnage,
      grossCompany: acc.grossCompany + curr.grossCompanyFreight,
      grossDriver: acc.grossDriver + curr.grossDriverFreight,
      netProfit: acc.netProfit + curr.netProfit,
      netRevenue: acc.netRevenue + curr.netRevenue,
      commission: acc.commission + curr.commission,

      teamShipmentsCount: acc.teamShipmentsCount + curr.teamShipmentsCount,
      teamNetProfit: acc.teamNetProfit + curr.teamNetProfit,
      teamCommission: acc.teamCommission + curr.teamCommission,

      externalShipmentsCount: acc.externalShipmentsCount + curr.externalShipmentsCount,
      externalNetRevenue: acc.externalNetRevenue + curr.externalNetRevenue,
      externalCommission: acc.externalCommission + curr.externalCommission,
    }), {
      cargosCount: 0,
      shipmentsCount: 0,
      tonnage: 0,
      grossCompany: 0,
      grossDriver: 0,
      netProfit: 0,
      netRevenue: 0,
      commission: 0,
      teamShipmentsCount: 0,
      teamNetProfit: 0,
      teamCommission: 0,
      externalShipmentsCount: 0,
      externalNetRevenue: 0,
      externalCommission: 0,
    });
  }, [filteredStats]);

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getProfileBadgeColor = (profile: UserProfile | string) => {
    switch (profile) {
      case UserProfile.AgenciadorLider:
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case UserProfile.Supervisor:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case UserProfile.Coordenador:
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800';
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

  const selectedLeaderStat = useMemo(() => {
    if (selectedUserId !== 'all') {
      return filteredStats.find(s => s.user.id === selectedUserId && s.isLeader);
    }
    return null;
  }, [selectedUserId, filteredStats]);

  return (
    <div className="space-y-5 w-full">
      {/* BARRA SUPERIOR INTEGRADA E OTIMIZADA */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-4 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Lado Esquerdo: Identificação & Regra */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                Relatório Supervisão & Líderes
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-300/40 flex items-center gap-1">
                <Percent className="w-3 h-3" /> Regra Híbrida Ativa
              </span>
              <button
                type="button"
                onClick={() => setShowRuleModal(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                title="Ver regra de apuração"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Entender Regra</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Apuração detalhada de comissões com distinção transparente de operações próprias e externas.
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

      {/* CARDS DE KPIS CONSOLIDADOS (DISCRIMINAÇÃO TRANSPARENTE CONFORME REQUISITOS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Card 1: Cargas Ativas */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Cargas Ativas</p>
            <p className="text-base font-black text-gray-900 dark:text-white truncate">{totals.cargosCount}</p>
          </div>
        </div>

        {/* Card 2: Embarques */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Embarques Efetivados</p>
            <p className="text-base font-black text-gray-900 dark:text-white truncate">{totals.shipmentsCount}</p>
          </div>
        </div>

        {/* Card 3: Lucro Líquido Geral */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 shrink-0">
            <DollarSignIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Lucro Líquido Operações</p>
            <p className="text-base font-black text-gray-900 dark:text-white truncate">{formatCurrency(totals.netProfit)}</p>
          </div>
        </div>

        {/* Card 4: Comissão Equipe / Própria (Lucro) */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-50 via-white to-indigo-50/30 dark:from-indigo-950/40 dark:via-gray-800 dark:to-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Comissão Equipe / Própria
            </span>
            <span className="text-[9px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 px-1.5 py-0.2 rounded">
              {selectedLeaderStat ? `${selectedLeaderStat.teamRate}% s/ Lucro` : '25% s/ Lucro'}
            </span>
          </div>
          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 truncate">
            {formatCurrency(selectedLeaderStat ? selectedLeaderStat.teamCommission : totals.teamCommission)}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-1">
            {selectedLeaderStat ? selectedLeaderStat.teamShipmentsCount : totals.teamShipmentsCount} fretes • Lucro {formatCurrency(selectedLeaderStat ? selectedLeaderStat.teamNetProfit : totals.teamNetProfit)}
          </p>
        </div>

        {/* Card 5: Comissão Cargas Externas (Faturamento) */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-50 via-white to-blue-50/30 dark:from-blue-950/40 dark:via-gray-800 dark:to-blue-950/20 border border-blue-200/80 dark:border-blue-800/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Comissão Cargas Externas
            </span>
            <span className="text-[9px] font-black bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 px-1.5 py-0.2 rounded">
              {selectedLeaderStat ? `${selectedLeaderStat.externalRate}% s/ Fat.` : '1,5% s/ Fat.'}
            </span>
          </div>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400 truncate">
            {formatCurrency(selectedLeaderStat ? selectedLeaderStat.externalCommission : totals.externalCommission)}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-1">
            {selectedLeaderStat ? selectedLeaderStat.externalShipmentsCount : totals.externalShipmentsCount} fretes terc. • Fat. {formatCurrency(selectedLeaderStat ? selectedLeaderStat.externalNetRevenue : totals.externalNetRevenue)}
          </p>
        </div>

        {/* Card 6: Total Geral de Comissão */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/40 dark:border-emerald-500/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Total Geral Comissão
            </span>
            <span className="text-[9px] font-extrabold bg-emerald-200/80 dark:bg-emerald-800/80 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.2 rounded-full">
              Soma
            </span>
          </div>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 truncate">
            {formatCurrency(selectedLeaderStat ? selectedLeaderStat.commission : totals.commission)}
          </p>
          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 truncate mt-1 font-medium">
            Equipe + Cargas de Terceiros
          </p>
        </div>
      </div>

      {/* ÁREA PRINCIPAL: LISTAGEM UTILIZANDO OS ESPAÇOS LATERAIS */}
      {filteredStats.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700">
          <Briefcase className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="font-semibold text-base">Nenhum responsável encontrado</p>
          <p className="text-xs">Ajuste os filtros de busca ou período selecionado.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* ========================================================================= */
        /* MODO 1: TABELA EXECUTIVA CONSOLIDADA (COM DISCRIMINAÇÃO DETALHADA)        */
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
                  <th className="py-3 px-3 text-right">Lucro Líquido</th>
                  <th className="py-3 px-4 text-left">Discriminação das Comissões</th>
                  <th className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-black">Total Comissão</th>
                  <th className="py-3 px-3 text-center">Detalhamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium">
                {filteredStats.map(stat => {
                  const isExpanded = !!expandedUserIds[stat.user.id];
                  const currentSubTab = expandedSubTab[stat.user.id] || 'fretes';

                  return (
                    <React.Fragment key={stat.user.id}>
                      <tr className={`hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors ${isExpanded ? 'bg-indigo-50/20 dark:bg-indigo-950/20' : ''}`}>
                        {/* Nome + Avatar */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs">
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

                        {/* Lucro Líquido */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className={`font-black text-sm ${stat.netProfit >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                            {formatCurrency(stat.netProfit)}
                          </span>
                        </td>

                        {/* Discriminação da Comissão (Híbrida transparente para Líder) */}
                        <td className="py-3 px-4 min-w-[280px]">
                          {stat.isLeader ? (
                            <div className="space-y-1.5 py-0.5">
                              {/* Cenário A: Equipe */}
                              <div className="flex items-center justify-between text-[11px] gap-2">
                                <span className="inline-flex items-center gap-1 font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/40">
                                  <span>Equipe ({stat.teamRate}% s/ Lucro):</span>
                                  <span className="text-[10px] opacity-75">{stat.teamShipmentsCount} fretes</span>
                                </span>
                                <span className="font-black text-indigo-700 dark:text-indigo-300">
                                  {formatCurrency(stat.teamCommission)}
                                </span>
                              </div>
                              {/* Cenário B: Terceiros */}
                              <div className="flex items-center justify-between text-[11px] gap-2">
                                <span className="inline-flex items-center gap-1 font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-800/40">
                                  <span>Terceiros ({stat.externalRate}% s/ Fat.):</span>
                                  <span className="text-[10px] opacity-75">{stat.externalShipmentsCount} fretes</span>
                                </span>
                                <span className="font-black text-blue-700 dark:text-blue-300">
                                  {formatCurrency(stat.externalCommission)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] font-bold text-gray-600 dark:text-gray-300 flex items-center justify-between">
                              <span className="bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded">
                                Padrão (3,0% s/ Lucro Líquido)
                              </span>
                              <span>{formatCurrency(stat.commission)}</span>
                            </div>
                          )}
                        </td>

                        {/* Total Comissão */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="inline-block px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 font-black text-sm text-emerald-600 dark:text-emerald-400 shadow-xs">
                            {formatCurrency(stat.commission)}
                          </span>
                        </td>

                        {/* Ações / Expandir */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleExpand(stat.user.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
                            title={isExpanded ? 'Recolher detalhes' : 'Ver fretes e comissões'}
                          >
                            <span>{stat.shipmentDetails.length} fretes</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* LINHA EXPANSÍVEL: DISCRIMINAÇÃO DETALHADA POR FRETE / CARGA */}
                      {isExpanded && (
                        <tr className="bg-gray-50/70 dark:bg-gray-900/60">
                          <td colSpan={10} className="p-4 border-y border-gray-200/60 dark:border-gray-700/60">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200/80 dark:border-gray-700/80 shadow-xs space-y-4">
                              {/* Cabeçalho da Expansão com Alternador de Sub-Abas */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700 gap-3">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                                    Detalhamento de Comissões — {stat.user.name}
                                  </h4>
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                    Total: {formatCurrency(stat.commission)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-700/60 rounded-xl">
                                  <button
                                    type="button"
                                    onClick={() => setSubTab(stat.user.id, 'fretes')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      currentSubTab === 'fretes'
                                        ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
                                    }`}
                                  >
                                    Listagem por Frete / Embarque ({stat.shipmentDetails.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSubTab(stat.user.id, 'cargos')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      currentSubTab === 'cargos'
                                        ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
                                    }`}
                                  >
                                    Resumo por Cargas ({stat.cargos.length})
                                  </button>
                                </div>
                              </div>

                              {/* SUB-ABA 1: LISTAGEM POR FRETE / EMBARQUE (DISCRIMINAÇÃO TRANSPARENTE E TAGS) */}
                              {currentSubTab === 'fretes' && (
                                <div className="overflow-x-auto">
                                  {stat.shipmentDetails.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic py-4 text-center">Nenhum frete efetivado encontrado para este período.</p>
                                  ) : (
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="border-b border-gray-200/70 dark:border-gray-700/70 text-gray-400 uppercase text-[10px] font-bold">
                                          <th className="py-2.5 px-3">#Seq / Carga</th>
                                          <th className="py-2.5 px-3">Rota</th>
                                          <th className="py-2.5 px-3">Agenciador / Operador</th>
                                          <th className="py-2.5 px-3 text-right">Volume</th>
                                          <th className="py-2.5 px-3 text-right">Base de Cálculo</th>
                                          <th className="py-2.5 px-3 text-center">Origem / Regra</th>
                                          <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-black">Comissão Apurada</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium">
                                        {stat.shipmentDetails.map((detail, idx) => (
                                          <tr key={`${detail.shipment.id}-${idx}`} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                #{detail.cargo.sequenceId}
                                              </span>
                                              <span className="text-[10px] text-gray-400 block font-mono">
                                                {detail.shipment.horsePlate || detail.shipment.id}
                                              </span>
                                            </td>

                                            <td className="py-2.5 px-3 whitespace-nowrap text-gray-800 dark:text-gray-200">
                                              {detail.cargo.origin} <span className="text-gray-400">→</span> {detail.cargo.destination}
                                            </td>

                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-semibold text-gray-800 dark:text-gray-200">
                                                  {detail.operatorName}
                                                </span>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                                  detail.isTeamOperator 
                                                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' 
                                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                                }`}>
                                                  {detail.isTeamOperator ? 'Equipe' : 'Externo'}
                                                </span>
                                              </div>
                                            </td>

                                            <td className="py-2.5 px-3 text-right whitespace-nowrap text-gray-700 dark:text-gray-300 font-semibold">
                                              {detail.tonnage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ton
                                            </td>

                                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                              <span className="font-bold text-gray-900 dark:text-white block">
                                                {formatCurrency(detail.calculationBase)}
                                              </span>
                                              <span className="text-[10px] text-gray-400 block">
                                                {detail.calculationBaseLabel}
                                              </span>
                                            </td>

                                            {/* Tag / Regra Conforme Especificação */}
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                              <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-black border ${
                                                detail.scenario === 'equipe'
                                                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                                  : detail.scenario === 'terceiros'
                                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                              }`}>
                                                {detail.scenarioTag}
                                              </span>
                                            </td>

                                            {/* Valor Apurado */}
                                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-black text-sm text-emerald-600 dark:text-emerald-400">
                                              {formatCurrency(detail.commissionValue)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              )}

                              {/* SUB-ABA 2: RESUMO POR CARGAS */}
                              {currentSubTab === 'cargos' && (
                                <div className="overflow-x-auto">
                                  {stat.cargos.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic py-4 text-center">Nenhuma carga cadastrada para este responsável.</p>
                                  ) : (
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="border-b border-gray-200/70 dark:border-gray-700/70 text-gray-400 uppercase text-[10px] font-bold">
                                          <th className="py-2 px-3">#Seq</th>
                                          <th className="py-2 px-3">Rota (Origem → Destino)</th>
                                          <th className="py-2 px-3 text-center">Status</th>
                                          <th className="py-2 px-3 text-right">Fretes Apurados</th>
                                          <th className="py-2 px-3 text-right">Volume</th>
                                          <th className="py-2 px-3 text-right">Lucro Carga</th>
                                          <th className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">Comissão da Carga</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {stat.cargos.map(cargo => {
                                          const cargoDetails = stat.shipmentDetails.filter(d => d.cargo.id === cargo.id);
                                          const cargoTonnage = cargoDetails.reduce((sum, d) => sum + d.tonnage, 0);
                                          const cargoProfit = cargoDetails.reduce((sum, d) => sum + d.netProfit, 0);
                                          const cargoComm = cargoDetails.reduce((sum, d) => sum + d.commissionValue, 0);

                                          return (
                                            <tr key={cargo.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                              <td className="py-2 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                #{cargo.sequenceId}
                                              </td>
                                              <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-200">
                                                {cargo.origin} <span className="text-gray-400">→</span> {cargo.destination}
                                              </td>
                                              <td className="py-2 px-3 text-center">
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
                                              <td className="py-2 px-3 text-right font-semibold text-gray-700 dark:text-gray-300">
                                                {cargoDetails.length} fretes
                                              </td>
                                              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                                                {cargoTonnage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ton
                                              </td>
                                              <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white">
                                                {formatCurrency(cargoProfit)}
                                              </td>
                                              <td className="py-2 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(cargoComm)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  )}
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
        /* MODO 2: GRID DUPLO DE CARDS (2 COLUNAS LADO A LADO)                       */
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
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs">
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
                          {stat.cargos.length} cargas • {stat.shipmentDetails.length} fretes
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total de Comissão */}
                  <div className="text-right">
                    <p className="text-[9px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Total Comissão</p>
                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(stat.commission)}
                    </p>
                  </div>
                </div>

                {/* Sub-cards da Regra Híbrida quando for Agenciador Líder */}
                {stat.isLeader && (
                  <div className="p-3 bg-indigo-50/30 dark:bg-indigo-950/20 border-b border-indigo-100/50 dark:border-indigo-900/30 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-white dark:bg-gray-800/80 border border-indigo-100 dark:border-indigo-900/40">
                      <div className="flex items-center justify-between text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                        <span>Equipe / Próprio</span>
                        <span className="bg-indigo-100 dark:bg-indigo-900/60 px-1 rounded">{stat.teamRate}%</span>
                      </div>
                      <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {formatCurrency(stat.teamCommission)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {stat.teamShipmentsCount} fretes • Lucro {formatCurrency(stat.teamNetProfit)}
                      </p>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-gray-800/80 border border-blue-100 dark:border-blue-900/40">
                      <div className="flex items-center justify-between text-[10px] font-bold text-blue-700 dark:text-blue-300">
                        <span>Cargas de Terceiros</span>
                        <span className="bg-blue-100 dark:bg-blue-900/60 px-1 rounded">{stat.externalRate}%</span>
                      </div>
                      <p className="text-sm font-black text-blue-600 dark:text-blue-400 mt-0.5">
                        {formatCurrency(stat.externalCommission)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {stat.externalShipmentsCount} fretes • Fat {formatCurrency(stat.externalNetRevenue)}
                      </p>
                    </div>
                  </div>
                )}

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

                {/* Botão de Ver Fretes */}
                <div className="px-4 py-2 bg-gray-50/70 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleExpand(stat.user.id)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 py-1 transition-colors cursor-pointer"
                  >
                    <span>{isExpanded ? 'Recolher fretes' : `Ver ${stat.shipmentDetails.length} fretes comissíveis`}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Sanfona de Fretes */}
                {isExpanded && (
                  <div className="p-3 bg-gray-50/50 dark:bg-gray-900/60 border-t border-gray-100 dark:border-gray-700 space-y-2">
                    {stat.shipmentDetails.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2 text-center">Nenhum frete comissível atribuído.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                        {stat.shipmentDetails.map((detail, idx) => (
                          <div key={`${detail.shipment.id}-${idx}`} className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-xs flex items-center justify-between gap-2 shadow-2xs">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">#{detail.cargo.sequenceId}</span>
                                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{detail.cargo.origin} → {detail.cargo.destination}</span>
                                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                                  detail.scenario === 'equipe'
                                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                                    : detail.scenario === 'terceiros'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                }`}>
                                  {detail.scenarioTag}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-400 truncate mt-0.5">
                                Operador: <strong className="text-gray-600 dark:text-gray-300">{detail.operatorName}</strong> • {detail.tonnage.toLocaleString('pt-BR')} ton • Base ({detail.calculationBaseLabel}): {formatCurrency(detail.calculationBase)}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] text-gray-400">Comissão Apurada</p>
                              <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(detail.commissionValue)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL EXPLICATIVO DA REGRA */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                <Info className="w-5 h-5" />
                <h3 className="text-base text-gray-900 dark:text-white">Regra de Comissionamento Comercial</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowRuleModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4 text-xs text-gray-600 dark:text-gray-300 space-y-3.5 leading-relaxed">
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40">
                <p className="font-bold text-indigo-900 dark:text-indigo-200 text-sm mb-1">
                  1. Regra Híbrida para Agenciador Líder
                </p>
                <p className="text-[11px] text-indigo-800/90 dark:text-indigo-300/90">
                  O Agenciador Líder tem seu ganho dividido de forma transparente em duas categorias:
                </p>
                <div className="mt-2 space-y-2">
                  <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
                    <strong className="text-indigo-600 dark:text-indigo-400 block">
                      • Cenário A: Operações da Equipe / Próprias (Padrão: 25% s/ Lucro Líquido)
                    </strong>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Cargas cadastradas e/ou embarcadas pelo próprio líder ou por agenciadores vinculados à equipe dele. 
                      Base de Cálculo: Margem líquida de lucro do frete.
                    </span>
                  </div>
                  <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-blue-100 dark:border-blue-900/40">
                    <strong className="text-blue-600 dark:text-blue-400 block">
                      • Cenário B: Cargas do Líder com Embarque Externo (Padrão: 1,5% s/ Faturamento)
                    </strong>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Cargas sob responsabilidade do líder que foram embarcadas por um agenciador que NÃO faz parte da sua equipe.
                      Base de Cálculo: Faturamento líquido da carga.
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200/60 dark:border-gray-700/60">
                <p className="font-bold text-gray-800 dark:text-gray-200 mb-1">
                  2. Regra para Supervisores e Coordenadores
                </p>
                <p className="text-[11px]">
                  Aplica-se a alíquota padrão de <strong>3,0% sobre o Lucro Líquido</strong> apurado exclusivamente nas cargas em que é o titular cadastrado.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300">
                <strong>Base de Margem Líquida do Frete:</strong> (Frete Empresa - Frete Motorista - Comissões Externas) × Toneladas + Estadias Líquidas.
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRuleModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 cursor-pointer shadow-sm"
              >
                Compreendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorReport;
