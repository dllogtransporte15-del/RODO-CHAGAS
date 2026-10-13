import React, { useMemo } from 'react';
import type { Shipment, Cargo, Branch, User } from '../../types';
import { ShipmentStatus, UserProfile } from '../../types';
import { Building2, TrendingUp, DollarSign, Package, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { StayRecord } from '../../utils/toolStorage';

interface BranchReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  branches: Branch[];
  users: User[];
  stays?: StayRecord[];
  currentUser?: User | null;
}

// Status estritamente efetivados / concluídos / faturados (carregamento físico confirmado)
const EFFECTIVE_STATUSES = [
  ShipmentStatus.AguardandoNota,
  ShipmentStatus.AguardandoAdiantamento,
  ShipmentStatus.AguardandoAgendamento,
  ShipmentStatus.AguardandoDescarga,
  ShipmentStatus.AguardandoPagamentoSaldo,
  ShipmentStatus.Finalizado
];

const BranchReport: React.FC<BranchReportProps> = ({ shipments, cargos, branches, users, stays = [], currentUser }) => {
  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);
  const userBranchMap = useMemo(() => new Map(users.map(u => [u.id, u.branchId])), [users]);

  // Escopo de filiais: se o usuário logado tiver filial e não for Admin/Diretoria, restringe à sua própria filial
  const scopedBranches = useMemo(() => {
    if (!currentUser) return branches;
    const isAdminOrDirector = [UserProfile.Admin, UserProfile.Diretor].includes(currentUser.profile);
    if (!isAdminOrDirector && currentUser.branchId) {
      const userBranch = branches.filter(b => b.id === currentUser.branchId);
      return userBranch.length > 0 ? userBranch : branches;
    }
    return branches;
  }, [branches, currentUser]);

  const branchData = useMemo(() => {
    const statsMap = new Map(scopedBranches.map(b => [b.id, {
      ...b,
      shipmentCount: 0,
      totalWeight: 0,
      totalBilled: 0,
      totalCost: 0,
      totalMargin: 0,
      marginPercent: 0
    }]));

    shipments.forEach(s => {
      // Considera exclusivamente fretes com status efetivado/concluído/faturado
      if (!EFFECTIVE_STATUSES.includes(s.status)) return;

      const cargo = cargoMap.get(s.cargoId);
      if (!cargo) return;

      const effectiveBranchId = s.branchId || userBranchMap.get(s.createdById) || cargo.branchId || userBranchMap.get(cargo.createdById);
      if (!effectiveBranchId) return;

      const stats = statsMap.get(effectiveBranchId);
      if (!stats) return;

      const grossRate = s.companyFreightRateSnapshot || cargo.companyFreightValuePerTon;
      const driverRate = s.driverFreightRateSnapshot || cargo.driverFreightValuePerTon;
      const commissionRate = cargo.salespersonCommissionPerTon || 0;
      const tonnage = s.shipmentTonnage || 0;
      
      const demurrageRevenue = stays
          .filter(stay => stay.shipmentId === s.id)
          .reduce((sum, stay) => sum + (stay.approvedValue || 0), 0);
          
      const demurragePaidToDriver = stays
          .filter(stay => stay.shipmentId === s.id)
          .reduce((sum, stay) => sum + (stay.driverPaidValue || 0), 0);
          
      // Faturamento Líquido Efetivado
      const faturamentoLiquidoEfetivado = (grossRate * tonnage) + demurrageRevenue;

      // Custo Total Realizado/Efetivado do Frete e Motorista
      const custoRealizadoMotorista = (driverRate * tonnage) + demurragePaidToDriver;

      // Despesas Operacionais Efetivadas (Comissões operacionais/comerciais)
      const despesasOperacionaisEfetivadas = (commissionRate * tonnage);

      // Custo Operacional Total Efetivado
      const custoTotalEfetivado = custoRealizadoMotorista + despesasOperacionaisEfetivadas;

      // Lucro Líquido Efetivado: (Faturamento Líquido Efetivado - Custo Total Realizado/Efetivado do Frete e Motorista - Despesas Operacionais Efetivadas)
      const lucroLiquidoEfetivado = faturamentoLiquidoEfetivado - custoRealizadoMotorista - despesasOperacionaisEfetivadas;

      stats.shipmentCount += 1;
      stats.totalWeight += tonnage;
      stats.totalBilled += faturamentoLiquidoEfetivado;
      stats.totalCost += custoTotalEfetivado;
      stats.totalMargin += lucroLiquidoEfetivado;
    });

    const result = Array.from(statsMap.values()).map(s => ({
      ...s,
      marginPercent: s.totalBilled > 0 ? (s.totalMargin / s.totalBilled) * 100 : 0
    }));

    return result.sort((a, b) => b.totalMargin - a.totalMargin);
  }, [shipments, scopedBranches, cargoMap, userBranchMap, stays]);

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const totals = useMemo(() => {
    return branchData.reduce((acc, curr) => ({
      weight: acc.weight + curr.totalWeight,
      billed: acc.billed + curr.totalBilled,
      cost: acc.cost + curr.totalCost,
      margin: acc.margin + curr.totalMargin,
      count: acc.count + curr.shipmentCount
    }), { weight: 0, billed: 0, cost: 0, margin: 0, count: 0 });
  }, [branchData]);

  const avgMargin = totals.billed > 0 ? (totals.margin / totals.billed) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* BANNER INFORMATIVO: APURAÇÃO 100% EFETIVADA */}
      <div className="flex items-center justify-between p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 text-xs">
        <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            <strong>Apuração por Lucro Líquido Efetivado:</strong> Exibe exclusivamente fretes com embarque confirmado e nota fiscal emitida (sem projeções ou valores previstos).
          </span>
        </div>
        <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-bold hidden sm:inline-block">
          Fórmula: Fat. Líq. - Custo Motorista - Desp. Operacionais
        </span>
      </div>

      {/* CARDS DE RESUMO CONSOLIDADO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Lucro Líquido Efetivado */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-5 rounded-2xl text-white shadow-lg shadow-emerald-600/20 flex flex-col justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold opacity-80 mb-1">Lucro Líquido Efetivado</p>
            <h3 className="text-2xl font-black">{formatCurrency(totals.margin)}</h3>
          </div>
          <div className="mt-3 pt-2 border-t border-white/20 flex items-center justify-between text-xs opacity-90">
            <span>{totals.count} embarques efetivados</span>
            <span className="font-bold">{totals.weight.toLocaleString('pt-BR')} ton</span>
          </div>
        </div>

        {/* Card 2: Faturamento Líquido Efetivado */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Faturamento Líquido Efetivado</p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(totals.billed)}</h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span>Receita real de fretes + estadias</span>
          </div>
        </div>

        {/* Card 3: Custos e Despesas Realizadas */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Custos & Despesas Realizadas</p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(totals.cost)}</h3>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            <span>Motoristas + Comissões operacionais</span>
          </div>
        </div>

        {/* Card 4: Margem Média Efetivada */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Margem Média Efetivada</p>
            <h3 className={`text-2xl font-black ${avgMargin >= 10 ? 'text-emerald-500' : 'text-orange-500'}`}>
              {avgMargin.toFixed(1)}%
            </h3>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Melhor: {branchData[0]?.name || 'N/A'}</span>
            <span className="font-bold text-emerald-600">{branchData[0]?.marginPercent ? `${branchData[0].marginPercent.toFixed(1)}%` : ''}</span>
          </div>
        </div>
      </div>

      {/* TABELA DE RESULTADOS POR FILIAL */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-all duration-300">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-800 dark:text-white">
                Desempenho por Filial (Lucro Líquido Efetivado)
              </h3>
              <p className="text-xs text-gray-400">
                Resultado real baseado nos fretes faturados e custos efetivamente realizados
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 self-start sm:self-auto">
            {branchData.length} filial(is)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold tracking-wider border-b border-gray-100 dark:border-gray-700">
                <th className="px-5 py-3.5">Filial</th>
                <th className="px-4 py-3.5 text-center">Embarques Efetivados</th>
                <th className="px-4 py-3.5 text-right">Peso Efetivado</th>
                <th className="px-5 py-3.5 text-right">Fat. Líquido Efetivado</th>
                <th className="px-5 py-3.5 text-right">Custos Realizados</th>
                <th className="px-5 py-3.5 text-right text-emerald-600 dark:text-emerald-400 font-black">Lucro Líquido Efetivado</th>
                <th className="px-5 py-3.5 text-right">% Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium">
              {branchData.map((branch) => (
                <tr key={branch.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors group">
                  {/* Nome da Filial */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Building2 className="w-4 h-4 text-gray-500 group-hover:text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">{branch.name}</p>
                        <p className="text-[10px] text-gray-400">{branch.city} - {branch.state}</p>
                      </div>
                    </div>
                  </td>

                  {/* Embarques Efetivados */}
                  <td className="px-4 py-3.5 text-center font-bold text-gray-800 dark:text-gray-200">
                    {branch.shipmentCount}
                  </td>

                  {/* Peso Efetivado */}
                  <td className="px-4 py-3.5 text-right font-semibold text-gray-700 dark:text-gray-300">
                    <div className="flex items-center justify-end gap-1">
                      <Package className="w-3 h-3 text-gray-400" />
                      <span>{branch.totalWeight.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ton</span>
                    </div>
                  </td>

                  {/* Faturamento Líquido Efetivado */}
                  <td className="px-5 py-3.5 text-right text-gray-700 dark:text-gray-300">
                    {formatCurrency(branch.totalBilled)}
                  </td>

                  {/* Custos Realizados */}
                  <td className="px-5 py-3.5 text-right text-gray-500 dark:text-gray-400">
                    {formatCurrency(branch.totalCost)}
                  </td>

                  {/* Lucro Líquido Efetivado */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <span className={`font-black text-sm ${branch.totalMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                      {formatCurrency(branch.totalMargin)}
                    </span>
                  </td>

                  {/* % Margem Efetivada */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-700" 
                          style={{ width: `${Math.min(Math.max(branch.marginPercent * 2.5, 0), 100)}%` }}
                        />
                      </div>
                      <span className={`font-bold text-xs ${branch.marginPercent >= avgMargin ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500'}`}>
                        {branch.marginPercent.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-[9px] text-right text-gray-400 mt-0.5">
                      {branch.marginPercent >= avgMargin ? 'Acima da média' : 'Abaixo da média'}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BranchReport;
