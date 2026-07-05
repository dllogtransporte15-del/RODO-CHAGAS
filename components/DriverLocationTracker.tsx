import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import type { User, DriverLocation } from '../types';

interface DriverLocationTrackerProps {
  user: User;
}

const DriverLocationTracker: React.FC<DriverLocationTrackerProps> = ({ user }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Start tracking automatically on mount
    startTracking();

    // Cleanup on unmount
    return () => {
      stopTracking();
    };
  }, []);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada pelo navegador.');
      return;
    }

    setIsSharing(true);
    setError(null);

    // Initialize Supabase Channel for Presence
    const channel = supabase.channel('driver_tracking', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel.on('presence', { event: 'sync' }, () => {
      console.log('Presence synced');
    }).on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('join', key, newPresences);
    }).on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('leave', key, leftPresences);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Start watching position
        watchIdRef.current = navigator.geolocation.watchPosition(
          async (position) => {
            const location: DriverLocation = {
              driverId: user.id,
              driverName: user.name,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              speed: position.coords.speed,
              heading: position.coords.heading,
              timestamp: new Date(position.timestamp).toISOString(),
            };

            await channel.track({ location });
          },
          (err) => {
            console.error('Error watching position:', err);
            setError(err.message);
            stopTracking();
          },
          {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 10000,
          }
        );
      }
    });

    channelRef.current = channel;
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    if (channelRef.current) {
      channelRef.current.untrack();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setIsSharing(false);
  };

  // Retorna null pois não precisa mais de interface visual (botão foi removido)
  return null;
};

export default DriverLocationTracker;
