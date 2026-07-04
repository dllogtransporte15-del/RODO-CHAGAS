import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { DriverLocation } from '../types';

export function useDriverLocations() {
  const [driverLocations, setDriverLocations] = useState<Map<string, DriverLocation>>(new Map());

  useEffect(() => {
    const channel = supabase.channel('driver_tracking');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const locations = new Map<string, DriverLocation>();
        
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          if (presences && presences.length > 0) {
            const latest = presences[presences.length - 1];
            if (latest.location) {
              locations.set(key, latest.location as DriverLocation);
            }
          }
        });
        
        setDriverLocations(locations);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return driverLocations;
}
