import React, { useMemo } from 'react';
import type { Shipment, Cargo, Branch } from '../../types';
import { ShipmentStatus } from '../../types';
import { Building2, TrendingUp, TrendingDown, DollarSign, Package } from 'lucide-react';

interface BranchReportProps {
  shipments: Shipment[];
  cargos: Cargo[];
  branches: Branch[];
}

const BranchReport: React.FC<BranchReportProps> = ({ shipments, cargos, branches }) => {
  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);

  const branchData = useMemo(() => {
    const stats = branches.map(branch => {
      const branchShipments = shipments.filter(s => s.branchId === branch.id);
      
      let totalWeight = 0;
      let totalBilled = 0;
      let totalMargin = 0;
      
      branchShipments.forEach(s => {
        const cargo = cargoMap.get(s.cargoId);
        if (!cargo) return;

        const effectiveStatus = [
          ShipmentStatus.AguardandoNota,
          ShipmentStatus.AguardandoAdiantamento,
          ShipmentStatus.AguardandoAgendamento,
          ShipmentStatus.AguardandoDescarga,
          ShipmentStatus.AguardandoPagamentoSaldo,
          ShipmentStatus.Finalizado
        ];

        if (effectiveStatus.includes(s.status)) {
          const grossRate = s.companyFreightRateSnapshot || cargo.companyFreightValuePerTon;
          const driverRate = s.driverFreightRateSnapshot || cargo.driverFreightValuePerTon;
          
          totalWeight += s.shipmentTonnage || 0;
          totalBilled += grossRate * s.shipmentTonnage;
          totalMargin += (grossRate - driverRate) * s.shipmentTonnage;
        }
      });

      return {
        ...branch,
        shipmentCount: branchShipments.length,
        totalWeight,
        totalBilled,
        totalMargin,
        marginPercent: totalBilled > 0 ? (totalMargin / totalBilled) * 100 : 0
      };
    });

    return stats.sort((a, b) => b.totalMargin - a.totalMargin);
  }, [shipments, branches, cargoMap]);

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {branchData.slice(0, 4).map((branch, idx) => (
          <div key={branch.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 group-hover:opacity-10 transition-opacity ${idx === 0 ? 'bg-primary' : 'bg-gray-400'}`} />
            <div className="relative z-10">
              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">{idx === 0 ? '🏆 Melhor Performance' : `Top ${idx + 1}`}</p>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white truncate">{branch.name}</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-black text-primary">{formatCurrency(branch.totalMargin)}</span>
                <span className="text-xs text-gray-500">lucro</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-all duration-300">
        <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Desempenho por Filial
            </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/20 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="px-6 py-4">Filial</th>
                <th className="px-6 py-4 text-center">Embarques</th>
                <th className="px-6 py-4 text-center">Peso Total</th>
                <th className="px-6 py-4 text-right">Fat. Bruto</th>
                <th className="px-6 py-4 text-right">Margem Líquida</th>
                <th className="px-6 py-4 text-right">% Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {branchData.map((branch) => (
                <tr key={branch.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Building2 className="w-4 h-4 text-gray-500 group-hover:text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 dark:text-gray-200">{branch.name}</p>
                        <p className="text-[10px] text-gray-400">{branch.city} - {branch.state}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">{branch.shipmentCount}</td>
                  <td className="px-6 py-4 text-center font-medium">
                    <div className="flex items-center justify-center gap-1">
                      <Package className="w-3 h-3 text-gray-400" />
                      {branch.totalWeight.toLocaleString('pt-BR')} <span className="text-[10px] text-gray-400">ton</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{formatCurrency(branch.totalBilled)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(branch.totalMargin)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-1000" 
                          style={{ width: `${Math.min(branch.marginPercent * 2.5, 100)}%` }}
                        />
                      </div>
                      <span className={`font-bold text-xs ${branch.marginPercent > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {branch.marginPercent.toFixed(1)}%
                      </span>
                    </div>
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
