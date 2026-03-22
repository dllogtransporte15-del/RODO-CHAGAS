
import React, { useMemo } from 'react';
import type { Shipment, Cargo, User } from '../types';
import { UserProfile } from '../types';

interface ShipperRankingCardProps {
  shipments: Shipment[];
  cargos: Cargo[];
  users: User[];
}

interface ShipperStat {
  id: string;
  name: string;
  vehicleCount: number;
  netMargin: number;
}

const ShipperRankingCard: React.FC<ShipperRankingCardProps> = ({ shipments, cargos, users }) => {
  const shipperStats = useMemo<ShipperStat[]>(() => {
    const shippers = users.filter(u => u.profile === UserProfile.Embarcador);
    // FIX: Explicitly type `cargoMap` to ensure correct type inference.
    const cargoMap: Map<string, Cargo> = new Map(cargos.map(c => [c.id, c]));

    const stats = shippers.map(shipper => {
      const shipperShipments = shipments.filter(s => s.embarcadorId === shipper.id);
      
      const uniqueVehicles = new Set(shipperShipments.map(s => s.horsePlate));

      const netMargin = shipperShipments.reduce((totalMargin, shipment) => {
        const cargo = cargoMap.get(shipment.cargoId);
        if (!cargo) return totalMargin;
        
        const companyFreightValue = cargo.companyFreightValuePerTon * shipment.shipmentTonnage;
        const driverFreightValue = shipment.driverFreightValue;
        
        return totalMargin + (companyFreightValue - driverFreightValue);
      }, 0);

      return {
        id: shipper.id,
        name: shipper.name,
        vehicleCount: uniqueVehicles.size,
        netMargin: netMargin,
      };
    });

    return stats.sort((a, b) => b.netMargin - a.netMargin);
  }, [shipments, cargos, users]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md col-span-1 lg:col-span-2">
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Ranking de Embarcadores (Margem Líquida)</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="border-b dark:border-gray-700">
            <tr>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">#</th>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Embarcador</th>
              <th className="py-2 px-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Veículos</th>
              <th className="py-2 px-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 tracking-wider">Margem Líquida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {shipperStats.map((stat, index) => (
              <tr key={stat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="py-3 px-3 text-sm font-medium text-gray-500 dark:text-gray-400">{index + 1}</td>
                <td className="py-3 px-3 text-sm font-medium text-gray-900 dark:text-white">{stat.name}</td>
                <td className="py-3 px-3 text-sm text-center text-gray-500 dark:text-gray-400">{stat.vehicleCount}</td>
                <td className="py-3 px-3 text-sm text-right font-semibold text-green-600 dark:text-green-400">{formatCurrency(stat.netMargin)}</td>
              </tr>
            ))}
            {shipperStats.length === 0 && (
                <tr>
                    <td colSpan={4} className="py-4 px-3 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum embarcador com movimentação.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ShipperRankingCard;
