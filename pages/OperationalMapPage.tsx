import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from '../components/Header';
import NewShipmentModal from '../components/NewShipmentModal';
import type { Cargo, Shipment, Client, Product, User, Driver, Vehicle, VehicleSetType, VehicleBodyType } from '../types';
import { CargoStatus, UserProfile, ShipmentStatus } from '../types';
import { CopyIcon } from '../components/icons/CopyIcon';
import { useNavigate } from 'react-router-dom';
import { Compass, MapPin, Navigation, ArrowRight, Package, Search } from 'lucide-react';

import { BRAZILIAN_CITIES } from '../brazilianCities';
import { geocodeCity, getCoordsSync, reverseGeocode, calculateDistanceKm } from '../utils/geocoding';
import { cleanOrShortenLocationInput } from '../utils/locationUtils';
import { upsertManyCargos } from '../lib/db';

// Declare Leaflet globally since it's loaded via script tag in index.html
declare const L: any;

interface OperationalMapPageProps {
  cargos: Cargo[];
  shipments: Shipment[];
  clients: Client[];
  products: Product[];
  drivers: Driver[];
  vehicles: Vehicle[];
  onCreateShipment: (data: Omit<Shipment, 'id' | 'orderId' | 'status' | 'documents' | 'history' | 'createdAt' | 'createdById' | 'statusHistory'>) => void;
  currentUser: User | null;
  users: User[];
  onModalStateChange: (isOpen: boolean) => void;
  onDeleteAttachment?: (shipmentId: string, url: string) => Promise<void>;
  companyLogo?: string | null;
}

const P180 = Math.PI / 180;

// Simple Haversine formula to calculate distance in KM
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * P180;
  const dLon = (lon2 - lon1) * P180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * P180) * Math.cos(lat2 * P180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

// Quick filter by bounding box (lighter than full Haversine for pre-selection)
const isInBoundingBox = (lat: number, lon: number, centerLat: number, centerLon: number, radiusKm: number): boolean => {
  const latDegree = radiusKm / 111.32;
  const lonDegree = radiusKm / (111.32 * Math.cos(centerLat * P180));
  return Math.abs(lat - centerLat) <= latDegree && Math.abs(lon - centerLon) <= lonDegree;
};

const OperationalMapPage: React.FC<OperationalMapPageProps> = ({
  cargos,
  shipments,
  clients,
  products,
  drivers,
  vehicles,
  onCreateShipment,
  currentUser,
  users,
  onModalStateChange,
  companyLogo,
}) => {
  const navigate = useNavigate();
  const isMotorista = currentUser?.profile === UserProfile.Motorista || String(currentUser?.profile).toLowerCase() === 'motorista';

  const [originQuery, setOriginQuery] = useState('Catalão');
  const [originRadius, setOriginRadius] = useState(200);
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationRadius, setDestinationRadius] = useState(200);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isGpsLocating, setIsGpsLocating] = useState(false);

  const [filteredLoads, setFilteredLoads] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [copyButtonText, setCopyButtonText] = useState('Divulgar');
  
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [selectedCargoForShipment, setSelectedCargoForShipment] = useState<Cargo | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  useEffect(() => {
    onModalStateChange(isShipmentModalOpen);
  }, [isShipmentModalOpen, onModalStateChange]);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const circleLayerRef = useRef<any>(null);
  const driverLayerRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const loadsWithCoordsRef = useRef<(Cargo & { originCoords?: { lat: number, lng: number }, destinationCoords?: { lat: number, lng: number }})[]>([]);

  const handleOpenNewShipmentModal = (cargo: Cargo) => {
    setSelectedCargoForShipment(cargo);
    setIsShipmentModalOpen(true);
  };

  const handleCloseShipmentModal = () => {
    setIsShipmentModalOpen(false);
    setSelectedCargoForShipment(null);
  };

  const handleSaveShipment = (shipmentData: Omit<Shipment, 'id' | 'orderId' | 'cargoId' | 'status' | 'documents' | 'history' | 'createdAt' | 'createdById' | 'statusHistory'>) => {
    if (selectedCargoForShipment) {
      onCreateShipment({
        cargoId: selectedCargoForShipment.id,
        ...shipmentData,
      });
    }
    handleCloseShipmentModal();
  };

  const loadsWithCoords = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return cargos
      .filter(c => {
        if (c.status !== CargoStatus.EmAndamento) return false;
        return c.dailySchedule?.some(ds => ds.date >= today);
      })
      .map(c => {
        const oCoords = c.originCoords || getCoordsSync(c.origin);
        const dCoords = c.destinationCoords || getCoordsSync(c.destination);

        return { 
            ...c, 
            originCoords: oCoords || undefined,
            destinationCoords: dCoords || undefined
        };
      });
  }, [cargos]);
  
  useEffect(() => {
    loadsWithCoordsRef.current = loadsWithCoords;
  }, [loadsWithCoords]);

  // Handle Geolocation on mount (especially for drivers)
  const handleGetDriverLocation = () => {
    if (!('geolocation' in navigator)) return;

    setIsGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setDriverCoords(coords);
        setIsGpsLocating(false);

        // Reverse geocode to get city name for search input
        const detectedCity = await reverseGeocode(coords.lat, coords.lng);
        if (detectedCity) {
          setOriginQuery(detectedCity);
        }
        setOriginCoords(coords);
      },
      (err) => {
        console.warn('Geolocation unavailable or denied:', err);
        setIsGpsLocating(false);
        // Fallback default search if not already set
        if (!originCoords) {
          handleSearch(null);
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (isMotorista) {
      handleGetDriverLocation();
    } else {
      handleSearch(null);
    }
  }, [isMotorista]);

  const memoizedFilteredLoads = useMemo(() => {
    if (!originCoords && !destinationCoords) return [];

    const allLoads = loadsWithCoords;

    if (!originCoords || !destinationCoords) {
      const uniqueLoads = new Map<string, Cargo>();
      allLoads.forEach(load => {
        let originMatch = false;
        if (originCoords && load.originCoords) {
          const dist = getDistance(originCoords.lat, originCoords.lng, load.originCoords.lat, load.originCoords.lng);
          originMatch = dist <= originRadius;
        }
        
        let destinationMatch = false;
        if (destinationCoords && load.destinationCoords) {
          const dist = getDistance(destinationCoords.lat, destinationCoords.lng, load.destinationCoords.lat, load.destinationCoords.lng);
          destinationMatch = dist <= destinationRadius;
        }

        if (originMatch || destinationMatch) {
          uniqueLoads.set(load.id, load);
        }
      });

      const list = Array.from(uniqueLoads.values());
      // Sort by proximity to driver / origin if available
      const refCoords = driverCoords || originCoords;
      if (refCoords) {
        list.sort((a, b) => {
          const distA = a.originCoords ? getDistance(refCoords.lat, refCoords.lng, a.originCoords.lat, a.originCoords.lng) : 999999;
          const distB = b.originCoords ? getDistance(refCoords.lat, refCoords.lng, b.originCoords.lat, b.originCoords.lng) : 999999;
          return distA - distB;
        });
      }
      return list;
    }

    const oCoords = [originCoords.lat, originCoords.lng];
    const dCoords = [destinationCoords.lat, destinationCoords.lng];

    const loadsInRange = allLoads.filter(load => {
        const lat = load.originCoords?.lat;
        const lon = load.originCoords?.lng;
        const destLat = load.destinationCoords?.lat;
        const destLon = load.destinationCoords?.lng;

        if (lat === undefined || lon === undefined || destLat === undefined || destLon === undefined) return false;

        if (!isInBoundingBox(lat, lon, oCoords[0], oCoords[1], originRadius)) return false;
        if (!isInBoundingBox(destLat, destLon, dCoords[0], dCoords[1], destinationRadius)) return false;

        const distO = getDistance(oCoords[0], oCoords[1], lat, lon);
        const distD = getDistance(dCoords[0], dCoords[1], destLat, destLon);

        return distO <= originRadius && distD <= destinationRadius;
    });

    const refCoords = driverCoords || originCoords;
    if (refCoords) {
      loadsInRange.sort((a, b) => {
        const distA = a.originCoords ? getDistance(refCoords.lat, refCoords.lng, a.originCoords.lat, a.originCoords.lng) : 999999;
        const distB = b.originCoords ? getDistance(refCoords.lat, refCoords.lng, b.originCoords.lat, b.originCoords.lng) : 999999;
        return distA - distB;
      });
    }

    return loadsInRange;
  }, [loadsWithCoords, originCoords, originRadius, destinationCoords, destinationRadius, driverCoords]);

  useEffect(() => {
    setFilteredLoads(memoizedFilteredLoads);
  }, [memoizedFilteredLoads]);

  const handleSyncAllCargos = async () => {
    if (!window.confirm('Deseja atualizar as coordenadas de TODAS as cargas cadastradas? Isso pode levar algum tempo.')) return;
    
    setSyncingAll(true);
    let updatedCount = 0;
    
    try {
        const cargosToUpdate: Cargo[] = [];
        
        for (const cargo of cargos) {
            if (!cargo.originCoords || !cargo.destinationCoords) {
                const [origin, destination] = await Promise.all([
                    geocodeCity(cargo.origin),
                    geocodeCity(cargo.destination)
                ]);
                
                if (origin || destination) {
                    cargosToUpdate.push({
                        ...cargo,
                        originCoords: origin || cargo.originCoords,
                        destinationCoords: destination || cargo.destinationCoords
                    });
                    updatedCount++;
                }
                
                if (updatedCount % 2 === 0) {
                     await new Promise(resolve => setTimeout(resolve, 1100));
                }
            }
        }
        
        if (cargosToUpdate.length > 0) {
            await upsertManyCargos(cargosToUpdate);
            alert(`${updatedCount} cargas atualizadas com sucesso! Recarregando página...`);
            window.location.reload();
        } else {
            alert('Todas as cargas já possuem coordenadas ou não foi possível geocodificar as restantes.');
        }
    } catch (err) {
        console.error('Erro ao sincronizar coordenadas:', err);
        alert('Ocorreu um erro durante a sincronização. Verifique o console.');
    } finally {
        setSyncingAll(false);
    }
  };

  const initMap = () => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = L.map(mapContainerRef.current).setView([-15.78, -47.92], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstanceRef.current);
    markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    circleLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    driverLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    mapInstanceRef.current.on('popupopen', (e: any) => {
        const popupNode = e.popup.getElement();
        const createBtn = popupNode.querySelector('[id^="create-shipment-btn-"]');
        if (createBtn) {
            const loadId = createBtn.id.replace('create-shipment-btn-', '');
            const cargoToShip = loadsWithCoordsRef.current.find(l => l.id === loadId);
            if (cargoToShip) {
                L.DomEvent.disableClickPropagation(createBtn);
                createBtn.onclick = () => {
                    handleOpenNewShipmentModal(cargoToShip);
                };
            }
        }
    });
    
    setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 400);
  };

  const updateMapLayers = () => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !circleLayerRef.current || !driverLayerRef.current) return;
    
    mapInstanceRef.current.invalidateSize();

    markersRef.current.clear();
    markersLayerRef.current.clearLayers();
    circleLayerRef.current.clearLayers();
    driverLayerRef.current.clearLayers();

    const bounds = L.latLngBounds();

    // Driver location marker
    if (driverCoords) {
      const driverIcon = L.divIcon({
        className: 'driver-pulse-marker',
        html: `
          <div style="position:relative; width:24px; height:24px; display:flex; align-items:center; justify-content:center;">
            <div style="position:absolute; width:36px; height:36px; background:#06b6d4; opacity:0.3; border-radius:50%; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="width:18px; height:18px; background:#06b6d4; border:3px solid #ffffff; border-radius:50%; box-shadow:0 0 12px #06b6d4; z-index:2;"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const driverMarker = L.marker([driverCoords.lat, driverCoords.lng], { icon: driverIcon });
      driverMarker.bindPopup('<div class="p-1 text-center font-bold text-xs text-cyan-600">Sua Localização GPS</div>');
      driverMarker.addTo(driverLayerRef.current);
      bounds.extend([driverCoords.lat, driverCoords.lng]);
    }

    if (originCoords) {
      const circle = L.circle([originCoords.lat, originCoords.lng], {
        color: '#06b6d4',
        fillColor: '#06b6d4',
        fillOpacity: 0.1,
        radius: originRadius * 1000
      });
      circle.addTo(circleLayerRef.current);
      bounds.extend(circle.getBounds());
    }

    if (destinationCoords) {
      const circle = L.circle([destinationCoords.lat, destinationCoords.lng], {
        color: '#DC2626',
        fillColor: '#DC2626',
        fillOpacity: 0.1,
        radius: destinationRadius * 1000
      });
      circle.addTo(circleLayerRef.current);
      bounds.extend(circle.getBounds());
    }

    filteredLoads.forEach(load => {
      if (load.originCoords) {
        const client = clients.find(cl => cl.id === load.clientId);
        const product = products.find(p => p.id === load.productId);
        const driverCpfClean = (currentUser?.email || '').replace(/\D/g, '');
        const hasApprovedShipment = shipments.some(s =>
          (s.driverCpf || '').replace(/\D/g, '') === driverCpfClean &&
          s.cargoId === load.id &&
          s.status !== ShipmentStatus.Cancelado
        );
        const canViewId = !isMotorista || hasApprovedShipment;
        const titleText = canViewId ? `Carga ${load.sequenceId}` : 'Oportunidade de Carga';
        const remainingVolume = load.totalVolume - load.loadedVolume;
        const volumeLine = !isMotorista ? `<p class="text-sm"><b>Volume Disp.:</b> ${remainingVolume.toFixed(1)} ton</p>` : '';
        const createBtn = !isMotorista ? `<button id="create-shipment-btn-${load.id}" class="w-full mt-3 py-1.5 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark">Criar Embarque</button>` : '';
        
        const popupContent = `
            <div class="p-1" style="min-width: 220px; font-family:sans-serif;">
                <h4 class="font-bold text-md text-blue-600">${titleText}</h4>
                <p class="text-xs text-gray-500 mb-2">${product?.name || 'Carga'}</p>
                <p class="text-sm"><b>Rota:</b> ${load.origin} &rarr; ${load.destination}</p>
                <p class="text-sm font-bold text-emerald-600"><b>Frete:</b> R$ ${load.driverFreightValuePerTon.toFixed(2)}/ton</p>
                ${volumeLine}
                ${createBtn}
            </div>
        `;
        const marker = L.marker([load.originCoords.lat, load.originCoords.lng]);
        marker.bindPopup(popupContent);
        marker.addTo(markersLayerRef.current);
        markersRef.current.set(load.id, marker);
      }
    });

    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  useEffect(() => {
    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    updateMapLayers();
  }, [filteredLoads, originCoords, destinationCoords, driverCoords]);

  const handleSearch = async (e: React.FormEvent | null) => {
    if (e) e.preventDefault();
    if (!originQuery.trim() && !destinationQuery.trim()) {
      setOriginCoords(null);
      setDestinationCoords(null);
      setFilteredLoads([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
        const [originResult, destinationResult] = await Promise.all([
            geocodeCity(originQuery),
            geocodeCity(destinationQuery)
        ]);
        
        setOriginCoords(originResult || null);
        setDestinationCoords(destinationResult || null);
        
        if (!originResult && originQuery.trim()) {
            setError(prev => (prev ? prev + ` Origem não encontrada.` : `Origem não encontrada.`));
        }
        if (!destinationResult && destinationQuery.trim()) {
            setError(prev => (prev ? prev + ` Destino não encontrado.` : `Destino não encontrado.`));
        }
    } finally {
        setLoading(false);
    }
  };
  
  const formatAllowedVehicleTypes = (allowed?: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[]): string => {
    if (!allowed || allowed.length === 0) return 'N/A';
    const allBodyTypes = allowed.flatMap(type => type.bodyTypes);
    const uniqueBodyTypes = [...new Set(allBodyTypes)];
    return uniqueBodyTypes.join(', ');
  };

  const handleShareFilteredLoads = () => {
    if (filteredLoads.length === 0) {
      alert('Nenhuma carga no resultado para divulgar.');
      return;
    }
    const header = '🌐 *LIBERADOS RODOCHAGAS* 🌐\n';
    const loadsText = filteredLoads.map(load => {
      const product = products.find(p => p.id === load.productId)?.name?.toUpperCase() || 'N/A';
      const origin = load.origin.toUpperCase();
      const destination = load.destination.toUpperCase();
      const price = load.driverFreightValuePerTon.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const bodyTypes = formatAllowedVehicleTypes(load.allowedVehicleTypes);
      let text = `📍 ${origin} x ${destination} \n🌾 ${product} - 💲 R$ ${price}\t\n🚛 ${bodyTypes} 🚛`;
      
      if (load.originLocation) text += `\n🏢 Coleta: ${load.originLocation}`;
      const cleanOriginMap = cleanOrShortenLocationInput(load.originMapLink);
      if (cleanOriginMap) text += `\n📍Mapa Coleta: ${cleanOriginMap}`;
      
      if (load.destinationLocation) text += `\n🏢 Entrega: ${load.destinationLocation}`;
      const cleanDestMap = cleanOrShortenLocationInput(load.destinationMapLink);
      if (cleanDestMap) text += `\n📍Mapa Entrega: ${cleanDestMap}`;
      
      return text;
    }).join('\n\n');
    navigator.clipboard.writeText(header + '\n' + loadsText).then(() => {
      setCopyButtonText('Copiado!');
      setTimeout(() => setCopyButtonText('Divulgar'), 3000);
    }, (err) => {
      console.error('Falha ao copiar: ', err);
      alert('Não foi possível copiar as cargas.');
    });
  };

  const handleSidebarItemClick = (load: Cargo) => {
    const marker = markersRef.current.get(load.id);
    if (marker && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo(marker.getLatLng(), 11, {
            animate: true,
            duration: 1
        });
        marker.openPopup();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DRIVER-OPTIMIZED VIEW (Tech / Dark Mode matching DriverAppView)
  // ─────────────────────────────────────────────────────────────────────────
  if (isMotorista) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans antialiased">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3 shadow-lg shadow-black/20">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {companyLogo ? (
                <img src={companyLogo} alt="Logo" className="h-9 w-auto object-contain max-w-[140px]" />
              ) : (
                <div className="flex items-center gap-1.5 font-black text-lg tracking-wider">
                  <span className="text-white">RODO</span>
                  <span className="text-cyan-400">CHAGAS</span>
                </div>
              )}
              <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Motorista Online</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleGetDriverLocation}
                title={driverCoords ? 'GPS Ativo' : 'Ativar GPS'}
                className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
                  driverCoords
                    ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Compass className={`w-4 h-4 ${isGpsLocating ? 'animate-spin text-cyan-400' : ''}`} />
                <span className="hidden sm:inline">{driverCoords ? 'GPS ON' : 'GPS'}</span>
              </button>

              <button
                onClick={() => navigate('/operational-loads')}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md shadow-cyan-950/30 transition-all cursor-pointer active:scale-95"
              >
                <span>← Oportunidades</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-6xl mx-auto px-4 pt-4 space-y-4">
          {/* Breadcrumb / Title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black text-white flex items-center gap-2">
                <Navigation className="w-5 h-5 text-cyan-400" />
                <span>Mapa Operacional de Cargas</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Explore cargas pelo raio de proximidade no mapa</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Map Frame (Left/Top) */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="relative bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden h-[380px] sm:h-[480px]">
                <div ref={mapContainerRef} className="w-full h-full z-0" />
                
                {/* Minimalist Tech Legend */}
                <div className="absolute top-3 right-3 z-[400] bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-slate-800 text-[10px] space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-[0_0_8px_#06b6d4]"></span><span className="text-slate-300 font-bold">Você</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span><span className="text-slate-300 font-bold">Carga</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-cyan-400 inline-block"></span><span className="text-slate-300 font-bold">Origem</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Locator & Results Panel (Right/Bottom) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* Card: Search Parameters */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Search className="w-4 h-4" />
                    <span>Localizador de Fretes</span>
                  </h3>
                  {driverCoords && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      GPS Ativo
                    </span>
                  )}
                </div>

                <form onSubmit={handleSearch} className="space-y-4">
                  {/* Origin */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Sua Localização / Cidade de Origem</span>
                      </div>
                      <span className="font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 text-[11px]">{originRadius} km</span>
                    </div>
                    <input 
                      type="text" 
                      list="city-suggestions-driver"
                      value={originQuery} 
                      onChange={(e) => setOriginQuery(e.target.value)} 
                      placeholder="Ex: Catalão, GO ou sua cidade" 
                      className="w-full p-3 bg-slate-950 text-white border border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all" 
                    />
                    <input 
                      type="range" 
                      min="50" 
                      max="1000" 
                      step="50" 
                      value={originRadius} 
                      onChange={(e) => setOriginRadius(parseInt(e.target.value))} 
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" 
                    />
                  </div>

                  {/* Destination (Optional) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-red-400" />
                        <span>Cidade de Destino (Opcional)</span>
                      </div>
                      <span className="font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 text-[11px]">{destinationRadius} km</span>
                    </div>
                    <input 
                      type="text" 
                      list="city-suggestions-driver"
                      value={destinationQuery} 
                      onChange={(e) => setDestinationQuery(e.target.value)} 
                      placeholder="Ex: Santos, SP (deixe vazio para todas)" 
                      className="w-full p-3 bg-slate-950 text-white border border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" 
                    />
                    <input 
                      type="range" 
                      min="50" 
                      max="1000" 
                      step="50" 
                      value={destinationRadius} 
                      onChange={(e) => setDestinationRadius(parseInt(e.target.value))} 
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500" 
                    />
                  </div>

                  <datalist id="city-suggestions-driver">
                    {BRAZILIAN_CITIES.map((city, idx) => (
                      <option key={idx} value={city} />
                    ))}
                  </datalist>

                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-cyan-950/40 active:scale-95 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Buscando Fretes...</span>
                      </>
                    ) : (
                      <span>Buscar Oportunidades no Raio</span>
                    )}
                  </button>
                </form>
                {error && <p className="text-red-400 text-xs font-semibold bg-red-950/40 border border-red-500/20 p-2 rounded-xl text-center">{error}</p>}
              </div>

              {/* Card: Results matching DriverAppView Cards */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                    Oportunidades Encontradas <span className="text-cyan-400 ml-1">({filteredLoads.length})</span>
                  </h4>
                </div>

                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredLoads.length > 0 ? (
                    filteredLoads.map(load => {
                      const product = products.find(p => p.id === load.productId);
                      const distToDriver = calculateDistanceKm(driverCoords || originCoords, load.originCoords);
                      const routeDistance = calculateDistanceKm(load.originCoords, load.destinationCoords);

                      return (
                        <div 
                          key={load.id} 
                          onClick={() => handleSidebarItemClick(load)}
                          className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-950 transition-all cursor-pointer space-y-2.5 group"
                        >
                          {/* Top row: Origin x Destination and Product */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></span>
                                <span className="truncate">{load.origin}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 pl-0.5">
                                <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                                <span className="truncate">{load.destination}</span>
                              </div>
                            </div>
                            {product?.name && (
                              <span className="shrink-0 px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                                {product.name}
                              </span>
                            )}
                          </div>

                          {/* Distance & Proximity Row */}
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
                            <div className="text-slate-400">
                              {distToDriver !== null ? (
                                <span>Está a <b className="text-cyan-400">{distToDriver} km</b> de você</span>
                              ) : (
                                routeDistance !== null ? <span>Rota: {routeDistance} km</span> : null
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-emerald-400">
                                R$ {load.driverFreightValuePerTon.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-slate-500"> / ton</span>
                            </div>
                          </div>

                          {/* Action Button */}
                          <button
                            type="button"
                            className="w-full py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[11px] font-bold transition-all flex items-center justify-center gap-1"
                          >
                            <span>Ver no Mapa</span>
                            <span>→</span>
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 px-4 rounded-xl bg-slate-950/40 border border-slate-800/60">
                      <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-400">Nenhuma carga no raio selecionado</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Aumente o raio em km ou altere a cidade de busca.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMINISTRATIVE / STAFF VIEW (Standard Light/Dark Desktop Layout)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full space-y-4 max-w-[1500px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <Header title="Mapa Operacional Logístico" />
      </div>
      
      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">
        {/* Coluna da Esquerda: Mapa */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-blue-50 dark:border-gray-700 overflow-hidden h-[500px] flex-shrink-0">
            <div ref={mapContainerRef} className="w-full h-full z-0" />
            
            {/* Legenda Minimalista */}
            <div className="absolute top-4 right-4 z-[400] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
               <p className="text-[9px] font-bold text-gray-400 mb-2 uppercase tracking-widest border-b pb-1">Legenda</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-4">
                  <div className="flex items-center text-[10px]"><div className="w-2.5 h-2.5 bg-blue-500 rounded-full mr-1.5"></div><span className="text-gray-600 dark:text-gray-300 font-bold">Carga</span></div>
                  <div className="flex items-center text-[10px]"><div className="w-2.5 h-2.5 border-2 border-blue-600 rounded-full mr-1.5"></div><span className="text-gray-600 dark:text-gray-300 font-bold">Origem</span></div>
                  <div className="flex items-center text-[10px]"><div className="w-2.5 h-2.5 border-2 border-red-500 rounded-full mr-1.5"></div><span className="text-gray-600 dark:text-gray-300 font-bold">Destino</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-blue-50/30 dark:bg-blue-900/10 rounded-2xl border-2 border-dashed border-blue-100 dark:border-blue-900/30 flex items-center justify-center p-8 text-center">
            <p className="text-sm text-blue-400 dark:text-blue-500 font-medium italic">Selecione uma carga no mapa ou na lista à direita para visualizar detalhes aqui.</p>
          </div>
        </div>

        {/* Coluna da Direita: Sidebar Consolidada (Filtros + Resultados) */}
        <aside className="w-full lg:w-[400px] flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar pb-6">
          {/* Card 1: Filtros */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Parâmetros de Busca</h3>
            <form onSubmit={handleSearch} className="space-y-6">
              {/* Origem */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Origem</label>
                  </div>
                  <span className="text-xs font-bold text-blue-600">{originRadius} km</span>
                </div>
                <input 
                  type="text" 
                  list="city-suggestions"
                  value={originQuery} 
                  onChange={(e) => setOriginQuery(e.target.value)} 
                  placeholder="Cidade de Origem" 
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                />
                <input type="range" min="50" max="1000" step="50" value={originRadius} onChange={(e) => setOriginRadius(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
              </div>

              {/* Destino */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Destino</label>
                  </div>
                  <span className="text-xs font-bold text-red-600">{destinationRadius} km</span>
                </div>
                <input 
                  type="text" 
                  list="city-suggestions"
                  value={destinationQuery} 
                  onChange={(e) => setDestinationQuery(e.target.value)} 
                  placeholder="Santos, SP" 
                  className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all" 
                />
                <input type="range" min="50" max="1000" step="50" value={destinationRadius} onChange={(e) => setDestinationRadius(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600" />
              </div>

              <datalist id="city-suggestions">
                {BRAZILIAN_CITIES.map((city, idx) => (
                  <option key={idx} value={city} />
                ))}
              </datalist>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-500/20"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Localizando...</span>
                  </>
                ) : (
                  <span>Localizar Fretes</span>
                )}
              </button>
            </form>
            {error && <p className="text-red-500 text-[10px] mt-3 font-bold bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-center">{error}</p>}
            
            {currentUser?.profile !== UserProfile.Cliente && (
              <button 
                  onClick={handleSyncAllCargos}
                  disabled={syncingAll}
                  className="w-full mt-4 py-2 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-[10px] items-center justify-center font-bold text-gray-400 hover:text-blue-500 hover:border-blue-500 transition-all flex gap-2"
              >
                  {syncingAll ? (
                      <>
                          <div className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                          <span>Sincronizando Coordenadas...</span>
                      </>
                  ) : (
                      <span>Sincronizar Todas as Cargas (Old)</span>
                  )}
              </button>
            )}
          </div>

          {/* Card 2: Resultados */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col min-h-[500px]">
            <div className="mb-4 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-xl flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
              <span className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400">
                {originCoords ? `Fretes próximos a ${originQuery}` : 'Aguardando parâmetros'}
              </span>
            </div>

            <div className="flex justify-between items-center mb-4 border-b pb-2 dark:border-gray-700">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 italic">Resultados <span className="text-blue-600 ml-1">{filteredLoads.length}</span></h4>
              {filteredLoads.length > 0 && currentUser?.profile !== UserProfile.Cliente && (
                <button onClick={handleShareFilteredLoads} className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all font-bold shadow-sm">
                  <CopyIcon className="w-3 h-3" /> {copyButtonText}
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              {filteredLoads.length > 0 ? (
                filteredLoads.map(load => {
                  const client = clients.find(c => c.id === load.clientId);
                  const product = products.find(p => p.id === load.productId);
                  return (
                    <div 
                      key={load.id} 
                      onClick={() => handleSidebarItemClick(load)}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate max-w-[150px] uppercase">{client?.nomeFantasia || 'Cliente'}</p>
                        <span className="text-[9px] font-black text-gray-400">#{load.sequenceId}</span>
                      </div>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 mb-3">{product?.name}</p>
                      
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center text-[10px] font-bold text-gray-700 dark:text-gray-200">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></div>
                          <span>{load.origin}</span>
                        </div>
                        <div className="flex items-center text-[10px] font-bold text-gray-700 dark:text-gray-200">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></div>
                          <span>{load.destination}</span>
                        </div>
                      </div>

                      <div className="flex justify-between mt-4 pt-3 border-t border-dashed border-gray-200 dark:border-gray-600">
                        <span className="text-[11px] font-black text-green-600 dark:text-green-400">R$ {load.driverFreightValuePerTon.toFixed(2)}</span>
                        <span className="text-[11px] font-black text-gray-700 dark:text-gray-200">{(load.totalVolume - load.loadedVolume).toFixed(1)} <span className="text-[9px] text-gray-400 font-normal">ton</span></span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 px-4 flex flex-col items-center justify-center">
                  <p className="text-gray-400 dark:text-gray-500 text-[10px] leading-relaxed">Nenhuma carga encontrada para os filtros atuais.</p>
                </div>
              )}
            </div>
            {error && <p className="text-red-500 text-[10px] mt-3 font-bold bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-center">{error}</p>}
          </div>
        </aside>
      </div>

      <NewShipmentModal
        isOpen={isShipmentModalOpen}
        onClose={handleCloseShipmentModal}
        onSave={handleSaveShipment}
        cargo={selectedCargoForShipment}
        drivers={drivers}
        clients={clients}
        vehicles={vehicles}
        currentUser={currentUser}
        shipments={shipments}
        users={users}
      />
    </div>
  );
};

// Custom styles for scrollbar and pulse animation
const style = document.createElement('style');
style.innerHTML = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #1e293b;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #334155;
  }
  @keyframes ping {
    75%, 100% {
      transform: scale(2);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

export default OperationalMapPage;
