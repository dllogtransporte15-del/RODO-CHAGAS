
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from '../components/Header';
import NewShipmentModal from '../components/NewShipmentModal';
import type { Cargo, Shipment, Client, Product, User, Driver, Vehicle, VehicleSetType, VehicleBodyType } from '../types';
import { CargoStatus } from '../types';
import { CopyIcon } from '../components/icons/CopyIcon';

import { BRAZILIAN_CITIES } from '../brazilianCities';

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
}

// Coordinates for some common logistics hubs in Brazil to ensure mock data maps correctly
const LOGISTICS_HUBS: Record<string, { lat: number; lng: number }> = {
  'Catalão, GO': { lat: -18.1691, lng: -47.9463 },
  'Sinop, MT': { lat: -11.8598, lng: -55.5031 },
  'Cuiabá, MT': { lat: -15.6010, lng: -56.0974 },
  'Sorriso, MT': { lat: -12.5507, lng: -55.7126 },
  'Rio Verde, GO': { lat: -17.7915, lng: -50.9202 },
  'Goiânia, GO': { lat: -16.6869, lng: -49.2648 },
  'Campo Grande, MS': { lat: -20.4697, lng: -54.6201 },
  'Rondonópolis, MT': { lat: -16.4674, lng: -54.6347 },
  'São Paulo, SP': { lat: -23.5505, lng: -46.6333 },
  'Santos, SP': { lat: -23.9608, lng: -46.3339 },
  'Paranaguá, PR': { lat: -25.5204, lng: -48.5093 },
  'Uberlândia, MG': { lat: -18.9186, lng: -48.2772 },
  'Patrocínio, MG': { lat: -18.9433, lng: -46.9944 },
  'Guarda-Mor, MG': { lat: -17.7769, lng: -47.1042 },
  'Cristalina, GO': { lat: -16.7686, lng: -47.6133 },
  'Anápolis, GO': { lat: -16.3267, lng: -48.9528 },
  'Rio Verde de Mato Grosso, MS': { lat: -18.9181, lng: -54.8442 },
  'Dourados, MS': { lat: -22.2235, lng: -54.8064 },
  'Luís Eduardo Magalhães, BA': { lat: -12.0968, lng: -45.7872 },
  'Barreiras, BA': { lat: -12.1528, lng: -44.9978 },
  'Primavera do Leste, MT': { lat: -15.5591, lng: -54.2965 },
  'Nova Mutum, MT': { lat: -13.8294, lng: -56.0792 },
  'Lucas do Rio Verde, MT': { lat: -13.0645, lng: -55.9103 },
};

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

const HUBS_MAP = new Map(Object.entries(LOGISTICS_HUBS).map(([k, v]) => [k.toLowerCase(), v]));

const OperationalMapPage: React.FC<OperationalMapPageProps> = ({ cargos, shipments, clients, products, drivers, vehicles, onCreateShipment, currentUser, users }) => {
  const [originQuery, setOriginQuery] = useState('Catalão');
  const [originRadius, setOriginRadius] = useState(200);
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationRadius, setDestinationRadius] = useState(200);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Local cache for geocoding to improve performance and avoid repeated API calls
  const [geoCache, setGeoCache] = useState<Record<string, [number, number]>>({});
  const [filteredLoads, setFilteredLoads] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Cache persistente para a sessão
  const geocodeResultsRef = useRef<Record<string, [number, number]>>({});
  const [copyButtonText, setCopyButtonText] = useState('Divulgar');
  
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [selectedCargoForShipment, setSelectedCargoForShipment] = useState<Cargo | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const circleLayerRef = useRef<any>(null);
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
    return cargos
      .filter(c => c.status === CargoStatus.EmAndamento)
      .map(c => {
        const getCoordsFor = (locationName: string) => {
            let coords = LOGISTICS_HUBS[locationName];
            if (!coords) {
              for (const hub in LOGISTICS_HUBS) {
                  if (locationName.includes(hub.split(',')[0])) {
                      return LOGISTICS_HUBS[hub];
                  }
              }
              let hash = 0;
              for (let i = 0; i < locationName.length; i++) {
                hash = locationName.charCodeAt(i) + ((hash << 5) - hash);
              }
              coords = { 
                lat: -10 - (Math.abs(hash % 1500) / 100), 
                lng: -45 - (Math.abs((hash >> 2) % 1500) / 100) 
              };
            }
            return coords;
        }
        return { 
            ...c, 
            originCoords: getCoordsFor(c.origin),
            destinationCoords: getCoordsFor(c.destination)
        };
      });
  }, [cargos]);
  
  useEffect(() => {
    loadsWithCoordsRef.current = loadsWithCoords;
  }, [loadsWithCoords]);


  const memoizedFilteredLoads = useMemo(() => {
    if (!originCoords && !destinationCoords) return [];

    const allLoads = loadsWithCoords; // Use the pre-processed loads

    if (!originCoords || !destinationCoords) {
      // If only one is set, fall back to previous logic or handle specifically
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
      return Array.from(uniqueLoads.values());
    }

    const oCoords = [originCoords.lat, originCoords.lng];
    const dCoords = [destinationCoords.lat, destinationCoords.lng];

    // Filtragem Otimizada: Bounding Box primeiro (rápido), Haversine depois (preciso)
    const loadsInRange = allLoads.filter(load => {
        const lat = load.originCoords?.lat;
        const lon = load.originCoords?.lng;
        const destLat = load.destinationCoords?.lat;
        const destLon = load.destinationCoords?.lng;

        if (lat === undefined || lon === undefined || destLat === undefined || destLon === undefined) return false;

        // Passo 1: Bounding Box na Origem
        if (!isInBoundingBox(lat, lon, oCoords[0], oCoords[1], originRadius)) return false;

        // Passo 2: Bounding Box no Destino
        if (!isInBoundingBox(destLat, destLon, dCoords[0], dCoords[1], destinationRadius)) return false;

        // Passo 3: Cálculo Haversine preciso apenas para o que passou nas "caixas"
        const distO = calculateDistance(oCoords[0], oCoords[1], lat, lon);
        const distD = calculateDistance(dCoords[0], dCoords[1], destLat, destLon);

        return distO <= originRadius && distD <= destinationRadius;
    });
    return loadsInRange;
  }, [loadsWithCoords, originCoords, originRadius, destinationCoords, destinationRadius]);

  useEffect(() => {
    setFilteredLoads(memoizedFilteredLoads);
  }, [memoizedFilteredLoads]);

  const initMap = () => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = L.map(mapContainerRef.current).setView([-15.78, -47.92], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstanceRef.current);
    markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    circleLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

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
    
    // Forçar re-cálculo do tamanho após o mount para evitar partes cinzas em layouts dinâmicos
    setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 400);
  };

  const updateMapLayers = () => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !circleLayerRef.current) return;
    
    // Garantir que o mapa reconheça o tamanho atual do container de 500px
    mapInstanceRef.current.invalidateSize();

    markersRef.current.clear();
    markersLayerRef.current.clearLayers();
    circleLayerRef.current.clearLayers();

    const bounds = L.latLngBounds();

    if (originCoords) {
      const circle = L.circle([originCoords.lat, originCoords.lng], {
        color: '#1E40AF',
        fillColor: '#1E40AF',
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
        const remainingVolume = load.totalVolume - load.loadedVolume;
        const popupContent = `
            <div class="p-1" style="min-width: 220px;">
                <h4 class="font-bold text-md text-primary">Carga ${load.sequenceId}</h4>
                <p class="text-xs text-gray-500 mb-2">${client?.nomeFantasia || 'N/A'} - ${product?.name || 'N/A'}</p>
                <p class="text-sm"><b>Rota:</b> ${load.origin} &rarr; ${load.destination}</p>
                <p class="text-sm"><b>Valor:</b> R$ ${load.driverFreightValuePerTon.toFixed(2)}/ton</p>
                <p class="text-sm"><b>Volume Disp.:</b> ${remainingVolume.toFixed(1)} ton</p>
                <button id="create-shipment-btn-${load.id}" class="w-full mt-3 py-1.5 bg-primary text-white text-sm font-semibold rounded hover:bg-primary-dark">Criar Embarque</button>
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
    handleSearch(null);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    updateMapLayers();
  }, [filteredLoads, originCoords, destinationCoords]); // Dependencies ensure map updates correctly

  // Haversine formula to calculate distance in KM
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
  };

  // Quick filter by bounding box (lighter than full Haversine for pre-selection)
  const isInBoundingBox = (lat: number, lon: number, centerLat: number, centerLon: number, radiusKm: number): boolean => {
      const latDegree = radiusKm / 111.32;
      const lonDegree = radiusKm / (111.32 * Math.cos(centerLat * Math.PI / 180));
      return Math.abs(lat - centerLat) <= latDegree && Math.abs(lon - centerLon) <= lonDegree;
  };

  const handleSearch = async (e: React.FormEvent | null) => {
    if (e) e.preventDefault();
    if (!originQuery.trim() && !destinationQuery.trim()) {
      setOriginCoords(null);
      setDestinationCoords(null);
      setFilteredLoads([]);
      return;
    }

    // 1. Cancel previous pending search requests
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const geocode = async (query: string): Promise<[number, number] | null> => {
        if (!query.trim()) return null;
        const normalizedQuery = query.trim().toLowerCase();
        
        // 1. Check local Hubs first (Map lookup is O(1))
        const hubCoords = HUBS_MAP.get(normalizedQuery);
        if (hubCoords) {
            return [hubCoords.lat, hubCoords.lng];
        }

        // 2. Check persistent ref cache (avoids re-geocoding same input in one session)
        if (geocodeResultsRef.current[normalizedQuery]) {
            return geocodeResultsRef.current[normalizedQuery];
        }

        // 3. Check state cache
        if (geoCache[normalizedQuery]) {
            return geoCache[normalizedQuery];
        }

        try {
            // 4. Fallback to API with stricter parameters for precision
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Brasil')}&countrycodes=br&addressdetails=1&limit=1`,
              { signal: abortControllerRef.current?.signal }
            );
            const data = await response.json();
            if (data && data.length > 0) {
                const result: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                setGeoCache(prev => ({ ...prev, [normalizedQuery]: result }));
                geocodeResultsRef.current[normalizedQuery] = result;
                return result;
            }
            setError(prev => (prev ? prev + ` Localização não encontrada: "${query}".` : `Localização não encontrada: "${query}".`));
            return null;
        } catch (err: any) {
            if (err.name === 'AbortError') return null;
            setError(prev => (prev ? prev + ` Erro ao buscar localização para "${query}".` : `Erro ao buscar localização para "${query}".`));
            return null;
        }
    };
    try {
        const [originResult, destinationResult] = await Promise.all([
            geocode(originQuery),
            geocode(destinationQuery)
        ]);
        
        setOriginCoords(originResult ? { lat: originResult[0], lng: originResult[1] } : null);
        setDestinationCoords(destinationResult ? { lat: destinationResult[0], lng: destinationResult[1] } : null);
    } finally {
        setLoading(false);
    }
  };
  
  const formatAllowedVehicleTypes = (allowed?: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[]): string => {
    if (!allowed || allowed.length === 0) return 'N/A';
    const allBodyTypes = allowed.flatMap(type => type.bodyTypes);
    const uniqueBodyTypes = [...new Set(allBodyTypes)];
    return uniqueBodyTypes.join(';');
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
      if (load.originMapLink) text += `\n📍Coleta - ${load.originMapLink}`;
      if (load.destinationMapLink) text += `\n📍Entrega - ${load.destinationMapLink}`;
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
        mapInstanceRef.current.flyTo(marker.getLatLng(), 12, {
            animate: true,
            duration: 1
        });
        marker.openPopup();
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 max-w-[1500px] mx-auto w-full">
      <Header title="Mapa Operacional Logístico" />
      
      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">
        {/* Coluna da Esquerda: Mapa com Destaque Máximo */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Mapa Ampliado - Altura de 500px (+50% em relação aos 330px anteriores) */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-blue-50 dark:border-gray-700 overflow-hidden h-[500px] flex-shrink-0">
            <div ref={mapContainerRef} className="w-full h-full z-0" />
            
            {/* Legenda Minimalista */}
            <div className="absolute top-4 right-4 z-[400] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
               <p className="text-[9px] font-bold text-gray-400 mb-2 uppercase tracking-widest border-b pb-1">Legenda</p>
              <div className="flex gap-4">
                <div className="flex items-center text-[10px]"><div className="w-2.5 h-2.5 bg-blue-500 rounded-full mr-1.5"></div><span className="text-gray-600 dark:text-gray-300 font-bold">Carga</span></div>
                <div className="flex items-center text-[10px]"><div className="w-2.5 h-2.5 border-2 border-blue-600 rounded-full mr-1.5"></div><span className="text-gray-600 dark:text-gray-300 font-bold">Origem</span></div>
                <div className="flex items-center text-[10px]"><div className="w-2.5 h-2.5 border-2 border-red-500 rounded-full mr-1.5"></div><span className="text-gray-600 dark:text-gray-300 font-bold">Destino</span></div>
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
          </div>

          {/* Card 2: Resultados - Centralizado agora na direita */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col min-h-[500px]">
            <div className="mb-4 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-xl flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
              <span className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400">
                {originCoords ? `Fretistas próximos a ${originQuery}` : 'Aguardando parâmetros'}
              </span>
            </div>

            <div className="flex justify-between items-center mb-4 border-b pb-2 dark:border-gray-700">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 italic">Resultados <span className="text-blue-600 ml-1">{filteredLoads.length}</span></h4>
              {filteredLoads.length > 0 && (
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

// Custom styles for the scrollbar to keep the UI clean
const style = document.createElement('style');
style.innerHTML = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 10px;
  }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #374151;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #d1d5db;
  }
`;
document.head.appendChild(style);

export default OperationalMapPage;
