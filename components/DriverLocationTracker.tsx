import React, { useState, useEffect, useRef } from 'react';
import { MapPin, MapPinOff, AlertTriangle, X, Settings, CheckCircle } from 'lucide-react';
import { supabase } from '../supabase';
import type { User, DriverLocation } from '../types';

interface DriverLocationTrackerProps {
  user: User;
}

const DriverLocationTracker: React.FC<DriverLocationTrackerProps> = ({ user }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'checking' | 'granted' | 'prompt' | 'denied'>('checking');
  const [showInstructions, setShowInstructions] = useState(false);
  
  const watchIdRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const checkPermissionAndTrack = async () => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada pelo navegador.');
      setPermissionState('denied');
      return;
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        setPermissionState(result.state as any);
        
        // Listen for change in permission
        result.onchange = () => {
          setPermissionState(result.state as any);
          if (result.state === 'granted') {
            setError(null);
            startTracking();
          } else {
            stopTracking();
            if (result.state === 'denied') {
              setError('Acesso à localização negado. Por favor, autorize nas configurações.');
              setShowInstructions(true);
            }
          }
        };

        if (result.state === 'granted') {
          setError(null);
          startTracking();
        } else if (result.state === 'prompt') {
          requestBrowserPermission();
        } else if (result.state === 'denied') {
          setError('Acesso à localização negado. Por favor, autorize nas configurações.');
          setShowInstructions(true);
        }
      } else {
        // Fallback for Safari/iOS
        requestBrowserPermission();
      }
    } catch (err) {
      console.error('Error checking permissions:', err);
      requestBrowserPermission();
    }
  };

  const requestBrowserPermission = () => {
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPermissionState('granted');
        setError(null);
        startTracking();
      },
      (err) => {
        console.error('Permission request failed:', err);
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState('denied');
          setError('Acesso à localização negado. Por favor, autorize nas configurações.');
          setShowInstructions(true);
        } else {
          setError(`Erro ao obter localização: ${err.message}`);
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    // Check permission and trigger tracking on mount
    checkPermissionAndTrack();

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

    if (watchIdRef.current !== null) {
      // Already tracking
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
            if (err.code === err.PERMISSION_DENIED) {
              setPermissionState('denied');
              setError('Acesso à localização negado. Por favor, autorize nas configurações.');
              setShowInstructions(true);
            } else {
              setError(`Erro no GPS: ${err.message}`);
            }
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
      if (permissionState === 'denied') {
        setShowInstructions(true);
      } else {
        checkPermissionAndTrack();
      }
    }
  };

  return (
    <div className="relative flex items-center">
      <button
        onClick={toggleTracking}
        title={
          permissionState === 'denied' 
            ? "GPS Bloqueado - Clique para ver como autorizar" 
            : isSharing 
              ? "Parar de compartilhar localização" 
              : "Compartilhar localização em tempo real"
        }
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all shadow-sm ${
          permissionState === 'denied'
            ? 'bg-red-500 hover:bg-red-600 text-white border border-red-600'
            : isSharing 
              ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800' 
              : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
        }`}
      >
        {permissionState === 'denied' ? (
          <>
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            <span>GPS Bloqueado</span>
          </>
        ) : isSharing ? (
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

      {/* Floating Bottom Banner for Denied Permission */}
      {permissionState === 'denied' && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-red-50 dark:bg-slate-900 border border-red-200 dark:border-red-900/50 rounded-xl p-4 shadow-xl z-[100] flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-950 dark:text-red-200">
                Acesso ao GPS Bloqueado
              </h4>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5 leading-relaxed">
                O compartilhamento de localização é obrigatório para realizar viagens na plataforma. Por favor, autorize o acesso.
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end text-xs">
            <button
              onClick={() => setShowInstructions(true)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
            >
              Ver como autorizar
            </button>
            <button
              onClick={checkPermissionAndTrack}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-slate-700 border border-red-200 dark:border-red-800 rounded-lg font-semibold transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 dark:border-slate-800">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2 text-primary dark:text-blue-400">
                <Settings className="w-5 h-5" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Como autorizar o GPS?
                </h3>
              </div>
              <button 
                onClick={() => setShowInstructions(false)}
                className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Para que possamos rastrear suas viagens e atualizar o andamento das entregas, é necessário dar permissão de GPS para o aplicativo.
              </p>

              {/* Android Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-1.5">
                  <span className="text-xs font-bold uppercase text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded">Celular Android (Chrome)</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-xs">
                  <li>Toque no ícone de <strong className="text-gray-900 dark:text-white">Cadeado 🔒 ou Ajustes</strong> no canto esquerdo da barra de endereço do navegador.</li>
                  <li>Clique em <strong className="text-gray-900 dark:text-white">"Configurações do site"</strong> ou <strong className="text-gray-900 dark:text-white">"Permissões"</strong>.</li>
                  <li>Selecione <strong className="text-gray-900 dark:text-white">"Localização"</strong>.</li>
                  <li>Escolha a opção de <strong className="text-green-600 dark:text-green-400">"Permitir"</strong> ou <strong className="text-green-600 dark:text-green-400">"Ativado"</strong>.</li>
                  <li>Volte ao aplicativo e atualize a página.</li>
                </ol>
              </div>

              {/* iOS Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-1.5">
                  <span className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">iPhone / iOS (Safari ou App PWA)</span>
                </div>
                
                <div className="space-y-2">
                  <p className="font-semibold text-xs text-gray-800 dark:text-gray-200">Se você adicionou o aplicativo à Tela de Início (PWA):</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs pl-1">
                    <li>Abra os <strong className="text-gray-900 dark:text-white">Ajustes ⚙️</strong> do seu iPhone.</li>
                    <li>Role a tela até encontrar a lista de aplicativos e clique em <strong className="text-gray-900 dark:text-white">"Rodochagas"</strong>.</li>
                    <li>Toque em <strong className="text-gray-900 dark:text-white">"Localização"</strong>.</li>
                    <li>Selecione <strong className="text-green-600 dark:text-green-400">"Durante o Uso do Aplicativo"</strong> e certifique-se de ativar a <strong className="text-gray-900 dark:text-white">"Localização Precisa"</strong>.</li>
                  </ol>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <p className="font-semibold text-xs text-gray-800 dark:text-gray-200">Se você está acessando pelo navegador Safari:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs pl-1">
                    <li>Toque nas letras <strong className="text-gray-900 dark:text-white">"aA"</strong> na barra de endereços do Safari.</li>
                    <li>Clique em <strong className="text-gray-900 dark:text-white">"Ajustes do Site"</strong>.</li>
                    <li>Toque em <strong className="text-gray-900 dark:text-white">"Localização"</strong> e selecione <strong className="text-green-600 dark:text-green-400">"Permitir"</strong>.</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-slate-800/80 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
              <button 
                onClick={() => setShowInstructions(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-slate-350 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors text-xs font-semibold"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setShowInstructions(false);
                  checkPermissionAndTrack();
                }}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle className="w-4 h-4" />
                Já Autorizei / Tentar Novamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverLocationTracker;
