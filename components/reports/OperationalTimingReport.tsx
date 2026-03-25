
import React, { useMemo, useState } from 'react';
import type { Shipment } from '../../types';
import { ShipmentStatus } from '../../types';

interface OperationalTimingReportProps {
  shipments: Shipment[];
}

interface StatusTimeStat {
  status: ShipmentStatus;
  averageDurationHours: number;
  averageDurationText: string;
}

// Helper function to format milliseconds into a readable string
const formatDuration = (ms: number): string => {
  if (isNaN(ms) || ms < 0) return 'N/A';

  const seconds = ms / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;

  if (days >= 1) return `${days.toFixed(1)} dias`;
  if (hours >= 1) return `${hours.toFixed(1)} horas`;
  if (minutes >= 1) return `${minutes.toFixed(1)} min`;
  return `${seconds.toFixed(0)} seg`;
};

const OperationalTimingReport: React.FC<OperationalTimingReportProps> = ({ shipments }) => {
  const timingStats = useMemo<StatusTimeStat[]>(() => {
    const stats: { [key in ShipmentStatus]?: { totalDuration: number; count: number } } = {};

    shipments.forEach(shipment => {
      // Ignore shipments with incomplete history
      if (!shipment.statusHistory || shipment.statusHistory.length < 2) {
        return;
      }

      for (let i = 0; i < shipment.statusHistory.length - 1; i++) {
        const currentEntry = shipment.statusHistory[i];
        const nextEntry = shipment.statusHistory[i+1];

        const startTime = new Date(currentEntry.timestamp).getTime();
        const endTime = new Date(nextEntry.timestamp).getTime();
        const duration = endTime - startTime;

        if (!stats[currentEntry.status]) {
          stats[currentEntry.status] = { totalDuration: 0, count: 0 };
        }
        stats[currentEntry.status]!.totalDuration += duration;
        stats[currentEntry.status]!.count += 1;
      }
    });
    
    return Object.entries(stats).map(([status, data]) => {
      const averageDurationMs = data.totalDuration / data.count;
      return {
        status: status as ShipmentStatus,
        averageDurationHours: averageDurationMs / (1000 * 60 * 60),
        averageDurationText: formatDuration(averageDurationMs),
      };
    }).sort((a,b) => {
        // Sort by the canonical order of statuses
        const orderA = Object.values(ShipmentStatus).indexOf(a.status);
        const orderB = Object.values(ShipmentStatus).indexOf(b.status);
        return orderA - orderB;
    });

  }, [shipments]);

  const maxDurationHours = useMemo(() => {
      return Math.max(...timingStats.map(s => s.averageDurationHours), 0) || 1;
  }, [timingStats]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Tempo Médio por Status</h2>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        {timingStats.length > 0 ? (
          <div className="space-y-6">
            {timingStats.map(stat => (
              <div key={stat.status}>
                <div className="flex justify-between items-center mb-1 text-sm">
                  <span className="font-medium text-gray-600 dark:text-gray-400">{stat.status}</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">{stat.averageDurationText}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
                  <div
                    className="bg-primary h-4 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${(stat.averageDurationHours / maxDurationHours) * 100}%` }}
                    title={`Média: ${stat.averageDurationText}`}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-10">
            Nenhum dado de tempo de operação encontrado para o período selecionado.
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationalTimingReport;
