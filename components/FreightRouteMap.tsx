import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPinIcon, NavigationIcon, RefreshCwIcon, AlertCircleIcon, ClockIcon, RouteIcon, Maximize2Icon, CompassIcon } from 'lucide-react';
import { extractCoordinates, parseLocation } from '../utils/locationUtils';

// Known major Brazilian transport hubs coordinates for instant fallback without network delays
const BRAZIL_HUBS: Record<string, [number, number]> = {
  'sao paulo': [-23.5505, -46.6333],
  'santos': [-23.9608, -46.3339],
  'campinas': [-22.9099, -47.0626],
  'ribeirao preto': [-21.1775, -47.8103],
  'catalao': [-18.1691, -47.9463],
  'catalão': [-18.1691, -47.9463],
  'goiania': [-16.6869, -49.2648],
  'goiânia': [-16.6869, -49.2648],
  'rio verde': [-17.7915, -50.9202],
  'jatai': [-17.8814, -51.7144],
  'jataí': [-17.8814, -51.7144],
  'itumbiara': [-18.4187, -49.2173],
  'anapolis': [-16.3267, -48.9534],
  'anápolis': [-16.3267, -48.9534],
  'brasilia': [-15.7801, -47.9292],
  'brasília': [-15.7801, -47.9292],
  'cuiaba': [-15.6010, -56.0974],
  'cuiabá': [-15.6010, -56.0974],
  'sinop': [-11.8598, -55.5031],
  'sorriso': [-12.5507, -55.7126],
  'rondonopolis': [-16.4674, -54.6347],
  'rondonópolis': [-16.4674, -54.6347],
  'lucas do rio verde': [-13.0566, -55.9103],
  'nova mutum': [-13.8294, -56.0792],
  'campo grande': [-20.4697, -54.6201],
  'dourados': [-22.2236, -54.8124],
  'curitiba': [-25.4284, -49.2733],
  'paranagua': [-25.5204, -48.5093],
  'paranaguá': [-25.5204, -48.5093],
  'londrina': [-23.3045, -51.1696],
  'maringa': [-23.4210, -51.9331],
  'maringá': [-23.4210, -51.9331],
  'cascavel': [-24.9578, -53.4595],
  'uberlandia': [-18.9186, -48.2772],
  'uberlândia': [-18.9186, -48.2772],
  'uberaba': [-19.7472, -47.9392],
  'araguari': [-18.6475, -48.1884],
  'belo horizonte': [-19.9167, -43.9345],
  'porto alegre': [-30.0346, -51.2177],
  'rio grande': [-32.0350, -52.0986],
  'salvador': [-12.9714, -38.5014],
  'luis eduardo magalhaes': [-12.0954, -45.7952],
  'luís eduardo magalhães': [-12.0954, -45.7952],
  'barreiras': [-12.1465, -44.9989],
  'recife': [-8.0476, -34.8770],
  'fortaleza': [-3.7172, -38.5433],
};

const DEFAULT_CENTER: [number, number] = [-15.7801, -47.9292];

interface Waypoint {
  name: string;
  coords: [number, number];
  type: 'origin' | 'destination' | 'stop';
  label: string;
  shortLabel: string;
}

export interface RouteCalculatedData {
  distanceKm: number;
  durationMin: number;
  waypoints: Waypoint[];
}

interface FreightRouteMapProps {
  origin: string;
  originLocation?: string;
  destination: string;
  destinationLocation?: string;
  additionalDestinations?: { city: string; location?: string }[];
  onRouteCalculated?: (data: RouteCalculatedData) => void;
  className?: string;
}

// Modern, compact marker pins with high readability
const createCustomIcon = (type: 'origin' | 'destination' | 'stop', label: string, shortLabel: string) => {
  const bgColors = {
    origin: '#16A34A',      // Emerald Green
    destination: '#DC2626', // Crimson Red
    stop: '#4F46E5',        // Indigo
  };

  const color = bgColors[type] || '#1D3B8D';

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%);
        pointer-events: auto;
      ">
        <div style="
          background-color: ${color};
          color: #ffffff;
          font-weight: 800;
          font-size: 11px;
          height: 26px;
          min-width: 26px;
          padding: 0 6px;
          border-radius: 9999px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
          border: 2px solid #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          letter-spacing: 0.3px;
        ">
          <span>${label}</span>
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 6px solid ${color};
          margin-top: -1px;
        "></div>
        <div style="
          width: 6px;
          height: 6px;
          background-color: rgba(0,0,0,0.3);
          border-radius: 50%;
          margin-top: 1px;
          filter: blur(1px);
        "></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

function MapViewUpdater({
  bounds,
  recenterTrigger,
}: {
  bounds: L.LatLngBounds | null;
  recenterTrigger: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!bounds || !bounds.isValid()) return;

    const fit = (animated = true) => {
      map.invalidateSize();
      map.fitBounds(bounds, {
        paddingTopLeft: [45, 45],
        paddingBottomRight: [45, 45],
        maxZoom: 13,
        animate: animated,
        duration: 0.8,
      });
    };

    // Immediate fit
    fit(false);

    // Delayed fits to account for modal render/transitions
    const t1 = setTimeout(() => fit(true), 150);
    const t2 = setTimeout(() => fit(true), 400);
    const t3 = setTimeout(() => fit(true), 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [map, bounds, recenterTrigger]);

  return null;
}

const geocodeCache = new Map<string, [number, number]>();

export const FreightRouteMap: React.FC<FreightRouteMapProps> = ({
  origin,
  originLocation,
  destination,
  destinationLocation,
  additionalDestinations = [],
  onRouteCalculated,
  className = '',
}) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const normalizeCityQuery = (city: string) => {
    return city
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s*-\s*[a-z]{2}$/i, '')
      .replace(/,\s*[a-z]{2}$/i, '')
      .trim();
  };

  const geocodeAddress = async (cityText: string, specificLocation?: string): Promise<[number, number] | null> => {
    // 1. Check if specificLocation has direct coordinates (Google Maps URL or raw coords)
    if (specificLocation) {
      const extracted = extractCoordinates(specificLocation);
      if (extracted) {
        return [extracted.lat, extracted.lng];
      }
    }

    if (!cityText || !cityText.trim()) return null;

    // Check if city text itself contains coords
    const directCoords = extractCoordinates(cityText);
    if (directCoords) {
      return [directCoords.lat, directCoords.lng];
    }

    const cleanCity = cityText.trim();
    const normalized = normalizeCityQuery(cleanCity);

    // 2. Check local hub cache
    if (BRAZIL_HUBS[normalized]) {
      return BRAZIL_HUBS[normalized];
    }

    // 3. Check memory cache
    const cacheKey = `${cleanCity.toLowerCase()}_brasil`;
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey)!;
    }

    // 4. Query Nominatim OpenStreetMap
    try {
      const searchQuery = cleanCity.includes('Brasil') ? cleanCity : `${cleanCity}, Brasil`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&accept-language=pt-br&countrycodes=br`;
      
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();

      if (data && data.length > 0) {
        const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        geocodeCache.set(cacheKey, coords);
        return coords;
      }
    } catch (e) {
      console.warn('Nominatim geocoding error for:', cityText, e);
    }

    return null;
  };

  const calculateRoute = async () => {
    if (!origin.trim() && !destination.trim()) {
      setRouteCoordinates([]);
      setWaypoints([]);
      setDistanceKm(null);
      setDurationMin(null);
      setErrorMessage(null);
      setBounds(null);
      return;
    }

    if (!origin.trim() || !destination.trim()) {
      setErrorMessage('Informe a Origem e o Destino para traçar a rota.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsCalculating(true);
    setErrorMessage(null);

    try {
      // 1. Geocode Origin
      const originCoords = await geocodeAddress(origin, originLocation);
      if (!originCoords) {
        throw new Error(`Não foi possível localizar as coordenadas da origem "${origin}". Verifique o nome da cidade.`);
      }

      // 2. Geocode Additional Destinations (if any)
      const stopWaypoints: Waypoint[] = [];
      const intermediateCoordsList: [number, number][] = [];

      for (let i = 0; i < additionalDestinations.length; i++) {
        const stop = additionalDestinations[i];
        if (stop.city.trim()) {
          const stopCoords = await geocodeAddress(stop.city, stop.location);
          if (stopCoords) {
            intermediateCoordsList.push(stopCoords);
            stopWaypoints.push({
              name: stop.city,
              coords: stopCoords,
              type: 'stop',
              label: `Parada ${i + 1}`,
              shortLabel: `${i + 1}`,
            });
          }
        }
      }

      // 3. Geocode Main Destination
      const destCoords = await geocodeAddress(destination, destinationLocation);
      if (!destCoords) {
        throw new Error(`Não foi possível localizar as coordenadas do destino "${destination}". Verifique o nome da cidade.`);
      }

      const allWaypoints: Waypoint[] = [
        { name: origin, coords: originCoords, type: 'origin', label: 'Origem', shortLabel: 'A' },
        ...stopWaypoints,
        { name: destination, coords: destCoords, type: 'destination', label: 'Destino', shortLabel: 'B' },
      ];

      setWaypoints(allWaypoints);

      // Build OSRM route points: lon,lat;lon,lat;...
      const routePointsString = [
        `${originCoords[1]},${originCoords[0]}`,
        ...intermediateCoordsList.map(c => `${c[1]},${c[0]}`),
        `${destCoords[1]},${destCoords[0]}`,
      ].join(';');

      let routePolyline: [number, number][] = [];
      let totalDistKm = 0;
      let totalDurMin = 0;

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${routePointsString}?overview=full&geometries=geojson`;
        const osrmRes = await fetch(osrmUrl, { signal: abortControllerRef.current.signal });
        const osrmData = await osrmRes.json();

        if (osrmData && osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
          const mainRoute = osrmData.routes[0];
          totalDistKm = mainRoute.distance / 1000;
          totalDurMin = Math.round(mainRoute.duration / 60);
          routePolyline = mainRoute.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
        }
      } catch (osrmErr: any) {
        if (osrmErr.name === 'AbortError') return;
        console.warn('OSRM routing failed, using direct line fallback:', osrmErr);
      }

      // Fallback: If OSRM failed or returned no coords, use straight lines between waypoints
      if (routePolyline.length === 0) {
        routePolyline = allWaypoints.map(w => w.coords);
        let dist = 0;
        for (let i = 0; i < allWaypoints.length - 1; i++) {
          const [lat1, lon1] = allWaypoints[i].coords;
          const [lat2, lon2] = allWaypoints[i + 1].coords;
          const R = 6371;
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLon = ((lon2 - lon1) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          dist += R * c;
        }
        totalDistKm = dist * 1.25;
        totalDurMin = Math.round((totalDistKm / 75) * 60);
      }

      setRouteCoordinates(routePolyline);
      setDistanceKm(totalDistKm);
      setDurationMin(totalDurMin);

      const allCoordsForBounds = routePolyline.length > 0 ? routePolyline : allWaypoints.map(w => w.coords);
      const newBounds = L.latLngBounds(allCoordsForBounds);
      setBounds(newBounds);
      setRecenterTrigger(prev => prev + 1);

      if (onRouteCalculated) {
        onRouteCalculated({
          distanceKm: totalDistKm,
          durationMin: totalDurMin,
          waypoints: allWaypoints,
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Error calculating route:', err);
      setErrorMessage(err.message || 'Erro ao calcular a rota.');
    } finally {
      setIsCalculating(false);
    }
  };

  // Auto-calculate route with debounce when inputs change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (origin.trim().length >= 3 && destination.trim().length >= 3) {
        calculateRoute();
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [origin, originLocation, destination, destinationLocation, JSON.stringify(additionalDestinations)]);

  const formatDuration = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours === 0) return `${remainingMins} min`;
    if (remainingMins === 0) return `${hours}h`;
    return `${hours}h ${remainingMins}m`;
  };

  const handleManualRecenter = () => {
    if (bounds) {
      setRecenterTrigger(prev => prev + 1);
    } else {
      calculateRoute();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-slate-50 dark:bg-gray-900 overflow-hidden relative ${className}`}>
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shadow-2xs z-10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
            <RouteIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider truncate">
              Enquadramento da Rota
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              Trajeto rodoviário ponto a ponto
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {bounds && (
            <button
              type="button"
              onClick={handleManualRecenter}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors cursor-pointer"
              title="Ajustar e enquadrar rota no mapa"
            >
              <Maximize2Icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">Enquadrar</span>
            </button>
          )}

          <button
            type="button"
            onClick={calculateRoute}
            disabled={isCalculating || !origin || !destination}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-900/60 transition-colors disabled:opacity-50 cursor-pointer"
            title="Recalcular Rota"
          >
            <RefreshCwIcon className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden sm:inline">{isCalculating ? 'Calculando...' : 'Atualizar'}</span>
          </button>
        </div>
      </div>

      {/* Route Metrics Bar */}
      {distanceKm !== null && !isCalculating && (
        <div className="px-4 py-2 bg-indigo-50/90 dark:bg-indigo-950/50 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs z-10 shrink-0 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-indigo-900 dark:text-indigo-200 font-bold">
              <NavigationIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{distanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km</span>
            </div>
            {durationMin !== null && (
              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                <span>{formatDuration(durationMin)}</span>
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0">
            Rota Traçada
          </span>
        </div>
      )}

      {/* Map Container Area */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={4}
          zoomControl={false}
          scrollWheelZoom={true}
          className="w-full h-full z-0"
          attributionControl={false}
        >
          <ZoomControl position="topleft" />

          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          <MapViewUpdater bounds={bounds} recenterTrigger={recenterTrigger} />

          {/* Polyline Route */}
          {routeCoordinates.length > 0 && (
            <>
              {/* Outer Border / Glow */}
              <Polyline
                positions={routeCoordinates}
                pathOptions={{
                  color: '#1E3A8A',
                  weight: 7,
                  opacity: 0.5,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              {/* Main Glowing Line */}
              <Polyline
                positions={routeCoordinates}
                pathOptions={{
                  color: '#2563EB',
                  weight: 4,
                  opacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </>
          )}

          {/* Waypoint Markers */}
          {waypoints.map((wp, idx) => (
            <Marker
              key={idx}
              position={wp.coords}
              icon={createCustomIcon(wp.type, wp.label, wp.shortLabel)}
            >
              <Popup>
                <div className="p-1.5 text-xs min-w-[140px]">
                  <strong className="block text-gray-900 font-bold text-sm mb-0.5">{wp.label}</strong>
                  <span className="text-gray-700 font-medium">{wp.name}</span>
                  <div className="text-[10px] text-gray-400 mt-1 font-mono">
                    {wp.coords[0].toFixed(4)}, {wp.coords[1].toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating Recenter Action on Map */}
        {bounds && (
          <button
            type="button"
            onClick={handleManualRecenter}
            className="absolute bottom-4 right-4 z-[400] px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="Reenquadrar mapa na rota completa"
          >
            <CompassIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Focar Rota</span>
          </button>
        )}

        {/* Loading Overlay */}
        {isCalculating && (
          <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xs flex flex-col items-center justify-center z-[400] transition-all">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 flex items-center gap-3">
              <RefreshCwIcon className="w-5 h-5 text-indigo-600 animate-spin" />
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                Calculando e enquadrando rota...
              </span>
            </div>
          </div>
        )}

        {/* Error Message Overlay */}
        {errorMessage && !isCalculating && (
          <div className="absolute top-3 left-3 right-3 z-[400]">
            <div className="p-2.5 bg-red-50 dark:bg-red-900/60 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-200 flex items-start gap-2 shadow-sm">
              <AlertCircleIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
              </div>
            </div>
          </div>
        )}

        {/* Empty State Overlay */}
        {!origin.trim() && !destination.trim() && !isCalculating && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 text-center z-[300] bg-slate-50/50 dark:bg-gray-900/50 backdrop-blur-[1px]">
            <div className="p-3.5 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-xs">
              <MapPinIcon className="w-8 h-8 text-indigo-500 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                Aguardando Origem e Destino
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Preencha os campos ao lado para traçar a rota rodoviária e enquadrar o mapa automaticamente.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Itinerary summary */}
      {waypoints.length > 0 && (
        <div className="px-4 py-2.5 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-10 shrink-0">
          <div className="flex items-center gap-2 text-xs overflow-x-auto pb-0.5 scrollbar-thin">
            <div className="flex items-center gap-1.5 shrink-0 font-medium text-gray-700 dark:text-gray-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-2xs"></span>
              <span className="truncate max-w-[120px]" title={origin}>{origin}</span>
            </div>
            {additionalDestinations.filter(d => d.city.trim()).map((d, i) => (
              <React.Fragment key={i}>
                <span className="text-gray-400">➔</span>
                <div className="flex items-center gap-1.5 shrink-0 font-medium text-indigo-600 dark:text-indigo-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block shadow-2xs"></span>
                  <span className="truncate max-w-[100px]" title={d.city}>{d.city}</span>
                </div>
              </React.Fragment>
            ))}
            <span className="text-gray-400">➔</span>
            <div className="flex items-center gap-1.5 shrink-0 font-medium text-rose-600 dark:text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-2xs"></span>
              <span className="truncate max-w-[120px]" title={destination}>{destination}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreightRouteMap;
