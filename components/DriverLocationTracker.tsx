import React, { useState, useEffect, useRef } from 'react';
import { MapPin, MapPinOff } from 'lucide-react';
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
    const channel = supabase.channel('driver_locations_monitor', {
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

  const toggleTracking = () => {
    if (isSharing) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  return (
    <div className="relative flex items-center">
      <button
        onClick={toggleTracking}
        title={isSharing ? "Parar de compartilhar localização" : "Compartilhar localização em tempo real"}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all shadow-sm ${
          isSharing 
            ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800' 
            : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
        }`}
      >
        {isSharing ? (
          <>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <MapPinOff className="w-4 h-4" />
            <span className="hidden md:inline">Parar GPS</span>
          </>
        ) : (
          <>
            <MapPin className="w-4 h-4" />
            <span className="hidden md:inline">Compartilhar GPS</span>
          </>
        )}
      </button>
      {error && (
        <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-gray-800 text-red-500 text-xs p-2 rounded shadow-lg border border-red-200 z-50">
          {error}
        </div>
      )}
    </div>
  );
};

export default DriverLocationTracker;
