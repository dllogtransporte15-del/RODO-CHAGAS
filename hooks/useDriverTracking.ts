import { useEffect } from 'react';
import { supabase } from '../supabase';
import { User, UserProfile } from '../types';

export function useDriverTracking(currentUser: User | null) {
  useEffect(() => {
    const isMotoristaUser = currentUser?.profile === UserProfile.Motorista || String(currentUser?.profile).toLowerCase() === 'motorista';
    if (!currentUser || !isMotoristaUser) return;

    const cleanCpf = (currentUser.email || '').replace(/\D/g, '');

    // Atualiza status de aplicativo ativo no banco
    supabase.from('drivers').update({ has_app: true }).eq('id', currentUser.id).then(({ error }) => {
      if (error) console.log('has_app column might not exist yet', error);
    });

    const channel = supabase.channel('driver_locations_monitor', {
      config: { presence: { key: currentUser.id } },
    });

    let watchId: number | null = null;

    const broadcastPosition = async (lat: number, lng: number, speed: number | null = null, heading: number | null = null) => {
      const now = new Date().toISOString();
      const locationPayload = {
        driverId: currentUser.id,
        driverName: currentUser.name,
        driverCpf: currentUser.email,
        lat,
        lng,
        speed,
        heading,
        timestamp: now,
        isAppActive: true,
        location: {
          driverId: currentUser.id,
          driverName: currentUser.name,
          driverCpf: currentUser.email,
          lat,
          lng,
          speed,
          heading,
          timestamp: now,
        }
      };

      try {
        await channel.track(locationPayload);
      } catch (err) {
        console.warn('Error broadcasting driver GPS presence:', err);
      }

      // Persiste no banco se forem coordenadas válidas
      if (lat !== 0 && lng !== 0) {
        const updateData: any = {
          has_app: true,
        };
        if (cleanCpf) {
          supabase.from('drivers').update(updateData).eq('cpf', cleanCpf).then(() => {});
        }
        supabase.from('drivers').update(updateData).eq('id', currentUser.id).then(() => {});
      }
    };

    const requestSinglePosition = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            broadcastPosition(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.speed,
              pos.coords.heading
            );
          },
          (err) => console.warn('Single GPS error:', err),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestSinglePosition();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Ping inicial
        await broadcastPosition(0, 0);

        // Inicia GPS contínuo
        if ('geolocation' in navigator) {
          requestSinglePosition();

          watchId = navigator.geolocation.watchPosition(
            (pos) => {
              broadcastPosition(
                pos.coords.latitude,
                pos.coords.longitude,
                pos.coords.speed,
                pos.coords.heading
              );
            },
            (err) => console.warn('Watch GPS error:', err),
            { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
          );
        }
      }
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [currentUser]);
}
