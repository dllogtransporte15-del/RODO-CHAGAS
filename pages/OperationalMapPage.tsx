
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from '../components/Header';
import NewShipmentModal from '../components/NewShipmentModal';
import type { Cargo, Shipment, Client, Product, User, Driver, Vehicle, VehicleSetType, VehicleBodyType } from '../types';
import { CargoStatus } from '../types';
import { CopyIcon } from '../components/icons/CopyIcon';

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
};

// Simple Haversine formula to calculate distance in KM
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

const OperationalMapPage: React.FC<OperationalMapPageProps> = ({ cargos, shipments, clients, products, drivers, vehicles, onCreateShipment, currentUser, users }) => {
  const [originQuery, setOriginQuery] = useState('Catalão');
  const [originRadius, setOriginRadius] = useState(200);
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationRadius, setDestinationRadius] = useState(200);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const [locationCache, setLocationCache] = useState<Record<string, { lat: number; lng: number } | null>>(() => {
    try {
      const saved = localStorage.getItem('geocode_cache');
      return saved ? { ...LOGISTICS_HUBS, ...JSON.parse(saved) } : { ...LOGISTICS_HUBS };
    } catch {
      return { ...LOGISTICS_HUBS };
    }
  });

  useEffect(() => {
    const locationsToFetch = new Set<string>();
    cargos.filter(c => c.status === CargoStatus.EmAndamento).forEach(c => {
      if (locationCache[c.origin] === undefined) {
          const match = Object.keys(locationCache).find(hub => locationCache[hub] && c.origin.includes(hub.split(',')[0]));
          if (!match) locationsToFetch.add(c.origin);
      }
      if (locationCache[c.destination] === undefined) {
          const match = Object.keys(locationCache).find(hub => locationCache[hub] && c.destination.includes(hub.split(',')[0]));
          if (!match) locationsToFetch.add(c.destination);
      }
    });

    if (locationsToFetch.size === 0) return;

    let isMounted = true;
    
    const fetchLocations = async () => {
      const newCache = { ...locationCache };
      
      for (const loc of Array.from(locationsToFetch)) {
        if (!isMounted) break;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(loc + ', Brasil')}&limit=1`);
          const data = await response.json();
          if (data && data.length > 0) {
            newCache[loc] = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          } else {
            newCache[loc] = null;
          }
          
          setLocationCache({ ...newCache });
          try {
            localStorage.setItem('geocode_cache', JSON.stringify(newCache));
          } catch(e) {}

          await new Promise(r => setTimeout(r, 1100)); // Respect Nominatim 1 request per second
        } catch (err) {
          console.error(`Failed to geocode ${loc}:`, err);
          // Wait a bit before next attempt if error
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    };

    fetchLocations();

    return () => { isMounted = false; };
  }, [cargos]); // Only trigger on cargos change

  const loadsWithCoords = useMemo(() => {
    return cargos
      .filter(c => c.status === CargoStatus.EmAndamento)
      .map(c => {
        const getCoordsFor = (locationName: string) => {
            let coords = locationCache[locationName];
            if (coords !== undefined) return coords;
            
            for (const hub in locationCache) {
                if (locationCache[hub] && locationName.includes(hub.split(',')[0])) {
                    return locationCache[hub];
                }
            }
            return null; // Wait for geocoding instead of using faulty hash
        }
        return { 
            ...c, 
            originCoords: getCoordsFor(c.origin),
            destinationCoords: getCoordsFor(c.destination)
        };
      });
  }, [cargos, locationCache]);
  
  useEffect(() => {
    loadsWithCoordsRef.current = loadsWithCoords;
  }, [loadsWithCoords]);


  const filteredLoads = useMemo(() => {
    if (!originCoords && !destinationCoords) return [];

    const uniqueLoads = new Map<string, Cargo>();

    loadsWithCoords.forEach(load => {
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
  }, [loadsWithCoords, originCoords, originRadius, destinationCoords, destinationRadius]);

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
  };

  const updateMapLayers = () => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !circleLayerRef.current) return;

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

  const handleSearch = async (e: React.FormEvent | null) => {
    if (e) e.preventDefault();
    if (!originQuery.trim() && !destinationQuery.trim()) return;

    setLoading(true);
    setError(null);

    const geocode = async (query: string) => {
        if (!query.trim()) return null;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Brasil')}&limit=1`);
            const data = await response.json();
            if (data && data.length > 0) {
                return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            }
            return { error: `Localização não encontrada: "${query}"` };
        } catch (err) {
            console.error('Geocoding error:', err);
            return { error: 'Erro ao buscar localização.' };
        }
    };
    try {
        const [originResult, destinationResult] = await Promise.all([
            geocode(originQuery),
            geocode(destinationQuery)
        ]);
        const errors = [originResult?.error, destinationResult?.error].filter(Boolean);
        if (errors.length > 0) setError(errors.join(' '));
        setOriginCoords(originResult && !originResult.error ? originResult : null);
        setDestinationCoords(destinationResult && !destinationResult.error ? destinationResult : null);
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
    <div className="flex flex-col h-full space-y-6">
      <Header title="Mapa Operacional Logístico" />
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Localizador de Fretes Disponíveis</h3>
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            {/* Origin */}
            <div className="space-y-2 p-4 border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
                <h4 className="font-semibold text-gray-600 dark:text-gray-300">Busca por Origem</h4>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cidade de Origem</label>
                    <input type="text" value={originQuery} onChange={(e) => setOriginQuery(e.target.value)} placeholder="Ex: Catalão, GO" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Raio: <span className="text-primary font-bold">{originRadius}km</span></label>
                    <input type="range" min="50" max="1000" step="50" value={originRadius} onChange={(e) => setOriginRadius(parseInt(e.target.value))} className="w-full accent-primary" />
                </div>
            </div>
            {/* Destination */}
            <div className="space-y-2 p-4 border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
                <h4 className="font-semibold text-gray-600 dark:text-gray-300">Busca por Destino</h4>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cidade de Destino</label>
                    <input type="text" value={destinationQuery} onChange={(e) => setDestinationQuery(e.target.value)} placeholder="Ex: Santos, SP" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Raio: <span className="text-red-600 font-bold">{destinationRadius}km</span></label>
                    <input type="range" min="50" max="1000" step="50" value={destinationRadius} onChange={(e) => setDestinationRadius(parseInt(e.target.value))} className="w-full accent-red-600" />
                </div>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-semibold flex items-center justify-center disabled:opacity-50">
            {loading ? 'Buscando...' : 'Localizar Fretes'}
          </button>
        </form>
        {error && <p className="text-red-500 text-xs mt-2 font-medium">{error}</p>}
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-[500px]">
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden relative border dark:border-gray-700 min-h-[400px]">
          <div ref={mapContainerRef} className="w-full h-full z-0" />
          <div className="absolute top-4 right-4 z-[400] bg-white dark:bg-gray-800 p-2 rounded shadow-md border dark:border-gray-700">
            <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Legenda</p>
            <div className="flex items-center text-xs mt-1"><div className="w-3 h-3 bg-blue-500 rounded-full mr-2 shadow-sm border border-white"></div><span className="text-gray-700 dark:text-gray-300">Carga Disponível</span></div>
            <div className="flex items-center text-xs mt-1"><div className="w-3 h-3 border-2 border-blue-700 rounded-full mr-2"></div><span className="text-gray-700 dark:text-gray-300">Raio de Origem</span></div>
            <div className="flex items-center text-xs mt-1"><div className="w-3 h-3 border-2 border-red-600 rounded-full mr-2"></div><span className="text-gray-700 dark:text-gray-300">Raio de Destino</span></div>
          </div>
        </div>

        <div className="w-full md:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col border dark:border-gray-700">
          <div className="flex justify-between items-center mb-3 border-b pb-2 dark:border-gray-700">
            <h4 className="font-bold text-gray-700 dark:text-gray-200">Resultados</h4>
            <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full dark:bg-blue-900 dark:text-blue-300">{filteredLoads.length} cargas</span>
                 {filteredLoads.length > 0 && (
                     <button onClick={handleShareFilteredLoads} className="flex items-center gap-1.5 text-xs px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                        <CopyIcon className="w-3 h-3" />
                        {copyButtonText}
                     </button>
                 )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-300">
            {filteredLoads.length > 0 ? (
              filteredLoads.map(load => {
                const client = clients.find(c => c.id === load.clientId);
                const product = products.find(p => p.id === load.productId);
                return (
                  <div 
                    key={load.id} 
                    onClick={() => handleSidebarItemClick(load)}
                    className="p-3 bg-gray-50 dark:bg-gray-700/80 rounded-md border-l-4 border-primary hover:shadow-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between"><p className="text-xs font-bold text-primary dark:text-blue-400 truncate">{client?.nomeFantasia}</p><span className="text-[9px] font-bold bg-gray-200 dark:bg-gray-600 px-1 rounded h-fit">{load.sequenceId}</span></div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 italic">{product?.name}</p>
                    <div className="text-[11px] font-medium text-gray-800 dark:text-gray-200 mt-2">
                      <div className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></div>{load.origin}</div>
                      <div className="flex items-center mt-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></div>{load.destination}</div>
                    </div>
                    <div className="flex justify-between mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div><span className="text-[9px] text-gray-400 uppercase">Valor/Ton</span><span className="block text-xs font-bold text-green-600 dark:text-green-400">R$ {load.driverFreightValuePerTon.toFixed(2)}</span></div>
                      <div className="text-right"><span className="text-[9px] text-gray-400 uppercase">Volume Disp.</span><span className="block text-xs font-bold text-gray-700 dark:text-gray-200">{(load.totalVolume - load.loadedVolume).toFixed(1)} ton</span></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 px-4 flex flex-col items-center">
                <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-gray-500 dark:text-gray-400 text-sm italic">Nenhuma carga encontrada para os critérios de busca.</p>
                <button onClick={() => { setOriginRadius(p => Math.min(p + 200, 1000)); setDestinationRadius(p => Math.min(p + 200, 1000)); }} className="mt-4 text-xs text-primary font-bold hover:underline">Aumentar raios de busca</button>
              </div>
            )}
          </div>
        </div>
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

export default OperationalMapPage;
