import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { DriverLocation } from '../types';

const CHANNEL_NAME = 'driver_locations_monitor';

export function useDriverLocations() {
  const [driverLocations, setDriverLocations] = useState<Map<string, DriverLocation>>(new Map());

  useEffect(() => {
    const channel = supabase.channel(CHANNEL_NAME);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const locations = new Map<string, DriverLocation>();

        console.log('[useDriverLocations] Presence state sync:', state);

        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          if (presences && presences.length > 0) {
            const latest = presences[presences.length - 1];
            const loc = latest.location || latest;
            const lat = typeof loc?.lat === 'number' ? loc.lat : (typeof latest?.lat === 'number' ? latest.lat : 0);
            const lng = typeof loc?.lng === 'number' ? loc.lng : (typeof latest?.lng === 'number' ? latest.lng : 0);

            const driverName = loc?.driverName || latest?.driverName || '';
            const driverCpf = loc?.driverCpf || latest?.driverCpf || '';
            const driverId = loc?.driverId || latest?.driverId || key;

            const driverLocationObj: DriverLocation & { isAppActive?: boolean; driverCpf?: string } = {
              driverId,
              driverName,
              driverCpf,
              lat,
              lng,
              speed: loc?.speed ?? latest?.speed ?? null,
              heading: loc?.heading ?? latest?.heading ?? null,
              timestamp: loc?.timestamp || latest?.timestamp || new Date().toISOString(),
              isAppActive: true
            };

            locations.set(key, driverLocationObj as DriverLocation);
            if (driverName) {
              locations.set(driverName.toLowerCase().trim(), driverLocationObj as DriverLocation);
            }
            if (driverCpf) {
              const cleanCpf = driverCpf.replace(/\D/g, '');
              if (cleanCpf) locations.set(cleanCpf, driverLocationObj as DriverLocation);
            }
          }
        });

        setDriverLocations(locations);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log(`[useDriverLocations] Motorista entrou: ${key}`, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log(`[useDriverLocations] Motorista saiu: ${key}`, leftPresences);
        // Remover do mapa quando o motorista desconectar
        setDriverLocations(prev => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe((status) => {
        console.log(`[useDriverLocations] Canal status: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return driverLocations;
}
