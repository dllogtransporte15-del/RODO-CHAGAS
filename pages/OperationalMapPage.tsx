import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Header from '../components/Header';
import NewShipmentModal from '../components/NewShipmentModal';
import CargoDetailsModal from '../components/CargoDetailsModal';
import type { Cargo, Shipment, Client, Product, User, Driver, Vehicle, VehicleSetType, VehicleBodyType } from '../types';
import { CargoStatus, UserProfile, ShipmentStatus } from '../types';
import { CopyIcon } from '../components/icons/CopyIcon';
import { useNavigate } from 'react-router-dom';
import {
  Compass, MapPin, Navigation, ArrowRight, Package, Search,
  Filter, Layers, RotateCcw, Share2, Eye, Truck, Check,
  ChevronDown, ChevronUp, SlidersHorizontal, Sparkles, TrendingUp,
  DollarSign, Scale, ExternalLink, ArrowUpDown, X, Map as MapIcon,
  List, Crosshair, RefreshCw, Calendar, Phone, Info, Maximize2,
  Route as RouteIcon
} from 'lucide-react';

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
  onCreateShipment: (data: Omit<Shipment, 'id' | 'orderId' | 'status' | 'documents' | 'history' | 'createdAt' | 'createdById' | 'statusHistory'>) => Promise<void> | void;
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

// Tile layer configurations
const TILE_LAYERS: Record<string, { name: string; url: string; attribution: string }> = {
  osm: {
    name: 'Padrão (OSM)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  dark: {
    name: 'Dark Tech',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  },
  light: {
    name: 'Claro Clean',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  },
  satellite: {
    name: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri'
  }
};

const RADIUS_PRESETS = [50, 100, 200, 350, 500];

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

  // Search parameters
  const [originQuery, setOriginQuery] = useState('Catalão, GO');
  const [originRadius, setOriginRadius] = useState(200);
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationRadius, setDestinationRadius] = useState(200);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Driver GPS
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isGpsLocating, setIsGpsLocating] = useState(false);

  // Secondary filters & sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('');
  const [sortBy, setSortBy] = useState<'nearest' | 'price_desc' | 'volume_desc' | 'id_desc'>('nearest');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Map theme & active selection
  const [mapTheme, setMapTheme] = useState<'osm' | 'dark' | 'light' | 'satellite'>('osm');
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);
  const [mobileTab, setMobileTab] = useState<'map' | 'list' | 'details'>('map');

  // Loading & sync states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyButtonText, setCopyButtonText] = useState('Divulgar');
  const [syncingAll, setSyncingAll] = useState(false);

  // Modals
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [selectedCargoForShipment, setSelectedCargoForShipment] = useState<Cargo | null>(null);
  const [isCargoDetailsModalOpen, setIsCargoDetailsModalOpen] = useState(false);
  const [selectedCargoForDetails, setSelectedCargoForDetails] = useState<Cargo | null>(null);

  useEffect(() => {
    onModalStateChange(isShipmentModalOpen || isCargoDetailsModalOpen);
  }, [isShipmentModalOpen, isCargoDetailsModalOpen, onModalStateChange]);

  // Leaflet map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const circleLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const driverLayerRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const loadsWithCoordsRef = useRef<(Cargo & { originCoords?: { lat: number, lng: number }, destinationCoords?: { lat: number, lng: number }})[]>([]);

  // Inject custom CSS styling for modern leaflet markers and popups once
  useEffect(() => {
    if (document.getElementById('rodochagas-map-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'rodochagas-map-styles';
    styleEl.innerHTML = `
      .leaflet-popup-content-wrapper {
        padding: 0 !important;
        border-radius: 18px !important;
        overflow: hidden !important;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2) !important;
        border: 1px solid rgba(226, 232, 240, 0.9) !important;
      }
      .dark .leaflet-popup-content-wrapper {
        background: #0f172a !important;
        color: #f8fafc !important;
        border: 1px solid rgba(51, 65, 85, 0.9) !important;
      }
      .leaflet-popup-content {
        margin: 12px 14px !important;
        line-height: 1.4 !important;
      }
      .leaflet-popup-tip {
        background: #ffffff !important;
      }
      .dark .leaflet-popup-tip {
        background: #0f172a !important;
      }
      .leaflet-container {
        font-family: inherit !important;
      }
      @keyframes map-pin-pulse {
        0% { transform: scale(0.95); opacity: 0.8; }
        50% { transform: scale(1.4); opacity: 0.2; }
        100% { transform: scale(1.8); opacity: 0; }
      }
      .custom-scrollbar::-webkit-scrollbar {
        width: 5px;
        height: 5px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 9999px;
      }
      .dark .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #334155;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
      .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #475569;
      }
    `;
    document.head.appendChild(styleEl);
  }, []);

  const handleOpenNewShipmentModal = (cargo: Cargo) => {
    setSelectedCargoForShipment(cargo);
    setIsShipmentModalOpen(true);
  };

  const handleCloseShipmentModal = () => {
    setIsShipmentModalOpen(false);
    setSelectedCargoForShipment(null);
  };

  const handleSaveShipment = async (shipmentData: any) => {
    if (selectedCargoForShipment) {
      await onCreateShipment({
        cargoId: selectedCargoForShipment.id,
        ...shipmentData,
      });
      handleCloseShipmentModal();
    }
  };

  // Pre-filter loads in progress and hydrate with coordinates
  const loadsWithCoords = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return cargos
      .filter(c => {
        if (c.status !== CargoStatus.EmAndamento) return false;
        // If dailySchedule is set, show if any date >= today; if not set, show anyway
        if (c.dailySchedule && c.dailySchedule.length > 0) {
          return c.dailySchedule.some(ds => ds.date >= today);
        }
        return true;
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

  // Handle Geolocation (Driver GPS or User GPS)
  const handleGetDriverLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocalização não é suportada pelo seu navegador.');
      return;
    }

    setIsGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setDriverCoords(coords);
        setIsGpsLocating(false);

        const detectedCity = await reverseGeocode(coords.lat, coords.lng);
        if (detectedCity) {
          setOriginQuery(detectedCity);
        }
        setOriginCoords(coords);
      },
      (err) => {
        console.warn('Geolocation unavailable or denied:', err);
        setIsGpsLocating(false);
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

  // Main geographic filter logic
  const geographicFilteredLoads = useMemo(() => {
    if (!originCoords && !destinationCoords) {
      // If no center coords are defined, return all loads with origin coords
      return loadsWithCoords.filter(l => !!l.originCoords);
    }

    const allLoads = loadsWithCoords;

    // Single point search (Origin OR Destination only)
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

      return Array.from(uniqueLoads.values());
    }

    // Corridor search (Origin AND Destination both defined)
    const oCoords = [originCoords.lat, originCoords.lng];
    const dCoords = [destinationCoords.lat, destinationCoords.lng];

    return allLoads.filter(load => {
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
  }, [loadsWithCoords, originCoords, originRadius, destinationCoords, destinationRadius]);

  // Apply secondary filters (Search term, vehicle type, sorting)
  const displayLoads = useMemo(() => {
    let list = [...geographicFilteredLoads];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(load => {
        const client = clients.find(c => c.id === load.clientId);
        const product = products.find(p => p.id === load.productId);
        return (
          load.sequenceId.toString().includes(term) ||
          (client?.nomeFantasia && client.nomeFantasia.toLowerCase().includes(term)) ||
          (client?.razaoSocial && client.razaoSocial.toLowerCase().includes(term)) ||
          (product?.name && product.name.toLowerCase().includes(term)) ||
          load.origin.toLowerCase().includes(term) ||
          load.destination.toLowerCase().includes(term)
        );
      });
    }

    if (selectedVehicleType) {
      list = list.filter(load => {
        if (!load.allowedVehicleTypes || load.allowedVehicleTypes.length === 0) return true;
        return load.allowedVehicleTypes.some(vt => 
          vt.setType === selectedVehicleType || 
          vt.bodyTypes.includes(selectedVehicleType as any)
        );
      });
    }

    const refCoords = driverCoords || originCoords;
    if (sortBy === 'nearest' && refCoords) {
      list.sort((a, b) => {
        const distA = a.originCoords ? getDistance(refCoords.lat, refCoords.lng, a.originCoords.lat, a.originCoords.lng) : 999999;
        const distB = b.originCoords ? getDistance(refCoords.lat, refCoords.lng, b.originCoords.lat, b.originCoords.lng) : 999999;
        return distA - distB;
      });
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => (b.driverFreightValuePerTon || 0) - (a.driverFreightValuePerTon || 0));
    } else if (sortBy === 'volume_desc') {
      list.sort((a, b) => {
        const dispA = (a.totalVolume || 0) - (a.loadedVolume || 0);
        const dispB = (b.totalVolume || 0) - (b.loadedVolume || 0);
        return dispB - dispA;
      });
    } else if (sortBy === 'id_desc') {
      list.sort((a, b) => b.sequenceId - a.sequenceId);
    }

    return list;
  }, [geographicFilteredLoads, searchTerm, selectedVehicleType, sortBy, clients, products, driverCoords, originCoords]);

  // Operational KPI stats
  const kpiStats = useMemo(() => {
    const count = displayLoads.length;
    let totalAvailableTons = 0;
    let totalFreightSum = 0;
    const origins = new Set<string>();
    const destinations = new Set<string>();

    displayLoads.forEach(load => {
      const disp = Math.max(0, (load.totalVolume || 0) - (load.loadedVolume || 0));
      totalAvailableTons += disp;
      totalFreightSum += load.driverFreightValuePerTon || 0;
      if (load.origin) origins.add(load.origin.split(',')[0].trim());
      if (load.destination) destinations.add(load.destination.split(',')[0].trim());
    });

    const avgFreight = count > 0 ? totalFreightSum / count : 0;

    return {
      count,
      totalAvailableTons,
      avgFreight,
      uniqueOriginsCount: origins.size,
      uniqueDestinationsCount: destinations.size
    };
  }, [displayLoads]);

  // Sincronizar coordenadas antigas
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

  // Initialize Leaflet map
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = L.map(mapContainerRef.current, {
      zoomControl: false
    }).setView([-15.78, -47.92], 5);

    // Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(mapInstanceRef.current);

    const layerCfg = TILE_LAYERS[mapTheme] || TILE_LAYERS.osm;
    tileLayerRef.current = L.tileLayer(layerCfg.url, {
      attribution: layerCfg.attribution,
      maxZoom: 19
    }).addTo(mapInstanceRef.current);

    markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    circleLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    routeLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    driverLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    // Handle popup button clicks
    mapInstanceRef.current.on('popupopen', (e: any) => {
      const popupNode = e.popup.getElement();
      if (!popupNode) return;

      const createBtn = popupNode.querySelector('[id^="create-shipment-btn-"]');
      if (createBtn) {
        const loadId = createBtn.id.replace('create-shipment-btn-', '');
        const cargoToShip = loadsWithCoordsRef.current.find(l => l.id === loadId);
        if (cargoToShip) {
          L.DomEvent.disableClickPropagation(createBtn);
          createBtn.onclick = (ev: any) => {
            ev.stopPropagation();
            handleOpenNewShipmentModal(cargoToShip);
          };
        }
      }

      const detailsBtn = popupNode.querySelector('[id^="view-details-btn-"]');
      if (detailsBtn) {
        const loadId = detailsBtn.id.replace('view-details-btn-', '');
        const cargoToView = loadsWithCoordsRef.current.find(l => l.id === loadId);
        if (cargoToView) {
          L.DomEvent.disableClickPropagation(detailsBtn);
          detailsBtn.onclick = (ev: any) => {
            ev.stopPropagation();
            setSelectedCargoForDetails(cargoToView);
            setIsCargoDetailsModalOpen(true);
          };
        }
      }
    });
    
    setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 400);
  }, [mapTheme]);

  // Switch map theme tile layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const layerCfg = TILE_LAYERS[mapTheme] || TILE_LAYERS.osm;
    tileLayerRef.current = L.tileLayer(layerCfg.url, {
      attribution: layerCfg.attribution,
      maxZoom: 19
    }).addTo(mapInstanceRef.current);
  }, [mapTheme]);

  // Create custom marker icon
  const createCargoMarkerIcon = (load: Cargo, isSelected: boolean) => {
    const priceFormatted = Math.round(load.driverFreightValuePerTon || 0);
    const bgColor = isSelected ? '#F16421' : '#1D3B8D';
    const scale = isSelected ? 'scale(1.2)' : 'scale(1)';

    return L.divIcon({
      className: 'custom-cargo-pin-wrapper',
      html: `
        <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center; transform:${scale}; transition:all 0.25s ease; cursor:pointer;">
          ${isSelected ? `<div style="position:absolute; width:52px; height:52px; background:#F16421; opacity:0.35; border-radius:50%; animation:map-pin-pulse 1.6s infinite;"></div>` : ''}
          <div style="
            width: 38px;
            height: 38px;
            background: ${bgColor};
            border: 2.5px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 4px 14px rgba(0,0,0,0.35);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
          ">
            <span style="font-size: 8px; font-weight: 800; line-height: 1; opacity: 0.9;">#${load.sequenceId}</span>
            <span style="font-size: 9px; font-weight: 900; line-height: 1.1;">R$${priceFormatted}</span>
          </div>
          <div style="
            position: absolute;
            bottom: -2px;
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 6px solid ${bgColor};
          "></div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 42],
      popupAnchor: [0, -42]
    });
  };

  // Draw Route Polyline on map when a cargo is selected
  const drawCargoRoute = useCallback((load: Cargo) => {
    if (!mapInstanceRef.current || !routeLayerRef.current) return;
    routeLayerRef.current.clearLayers();

    const oCoords = load.originCoords || getCoordsSync(load.origin);
    const dCoords = load.destinationCoords || getCoordsSync(load.destination);

    if (oCoords && dCoords) {
      const latlngs = [
        [oCoords.lat, oCoords.lng],
        [dCoords.lat, dCoords.lng]
      ];

      // Glow polyline
      L.polyline(latlngs, {
        color: '#06b6d4',
        weight: 8,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(routeLayerRef.current);

      // Main dashed route line
      L.polyline(latlngs, {
        color: '#1D3B8D',
        weight: 3.5,
        dashArray: '8, 8',
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(routeLayerRef.current);

      // Distance pill midpoint
      const distKm = Math.round(calculateDistanceKm(oCoords, dCoords) || getDistance(oCoords.lat, oCoords.lng, dCoords.lat, dCoords.lng));
      const midLat = (oCoords.lat + dCoords.lat) / 2;
      const midLng = (oCoords.lng + dCoords.lng) / 2;

      const distIcon = L.divIcon({
        className: 'route-dist-pill',
        html: `
          <div style="background: rgba(15, 23, 42, 0.9); color: #38bdf8; padding: 4px 10px; border-radius: 9999px; font-weight: 800; font-size: 11px; border: 1px solid rgba(56, 189, 248, 0.4); box-shadow: 0 4px 12px rgba(0,0,0,0.4); white-space: nowrap; display: flex; align-items: center; gap: 4px;">
            <span>🚛</span>
            <span>${distKm.toLocaleString('pt-BR')} km</span>
          </div>
        `,
        iconSize: [100, 26],
        iconAnchor: [50, 13]
      });
      L.marker([midLat, midLng], { icon: distIcon, interactive: false }).addTo(routeLayerRef.current);

      // Origin Pin
      const originIcon = L.divIcon({
        className: 'route-pin-origin',
        html: `
          <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
            <div style="background:#10b981; color:white; font-size:10px; font-weight:800; padding:2px 8px; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.3); border:1px solid #ffffff; white-space:nowrap; margin-bottom:2px;">
              Coleta: ${load.origin.split(',')[0]}
            </div>
            <div style="width:14px; height:14px; background:#10b981; border:3px solid #ffffff; border-radius:50%; box-shadow:0 0 10px #10b981;"></div>
          </div>
        `,
        iconSize: [120, 40],
        iconAnchor: [60, 36]
      });
      L.marker([oCoords.lat, oCoords.lng], { icon: originIcon }).addTo(routeLayerRef.current);

      // Destination Pin
      const destIcon = L.divIcon({
        className: 'route-pin-dest',
        html: `
          <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
            <div style="background:#ef4444; color:white; font-size:10px; font-weight:800; padding:2px 8px; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.3); border:1px solid #ffffff; white-space:nowrap; margin-bottom:2px;">
              Entrega: ${load.destination.split(',')[0]}
            </div>
            <div style="width:14px; height:14px; background:#ef4444; border:3px solid #ffffff; border-radius:50%; box-shadow:0 0 10px #ef4444;"></div>
          </div>
        `,
        iconSize: [120, 40],
        iconAnchor: [60, 36]
      });
      L.marker([dCoords.lat, dCoords.lng], { icon: destIcon }).addTo(routeLayerRef.current);
    }
  }, []);

  // Update Map Layers (Markers, Circles, GPS)
  const updateMapLayers = useCallback(() => {
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
          <div style="position:relative; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
            <div style="position:absolute; width:42px; height:42px; background:#06b6d4; opacity:0.35; border-radius:50%; animation:map-pin-pulse 1.6s infinite;"></div>
            <div style="width:20px; height:20px; background:#06b6d4; border:3px solid #ffffff; border-radius:50%; box-shadow:0 0 14px #06b6d4; z-index:2; display:flex; align-items:center; justify-content:center; color:white; font-size:10px;">
              🚚
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const driverMarker = L.marker([driverCoords.lat, driverCoords.lng], { icon: driverIcon });
      driverMarker.bindPopup('<div class="p-1 text-center font-bold text-xs text-cyan-600">Sua Localização GPS Atual</div>');
      driverMarker.addTo(driverLayerRef.current);
      bounds.extend([driverCoords.lat, driverCoords.lng]);
    }

    // Origin Radius Circle
    if (originCoords) {
      const circle = L.circle([originCoords.lat, originCoords.lng], {
        color: '#1D3B8D',
        fillColor: '#3B82F6',
        fillOpacity: 0.12,
        weight: 2,
        radius: originRadius * 1000
      });
      circle.addTo(circleLayerRef.current);
      bounds.extend(circle.getBounds());
    }

    // Destination Radius Circle
    if (destinationCoords) {
      const circle = L.circle([destinationCoords.lat, destinationCoords.lng], {
        color: '#DC2626',
        fillColor: '#EF4444',
        fillOpacity: 0.12,
        weight: 2,
        radius: destinationRadius * 1000
      });
      circle.addTo(circleLayerRef.current);
      bounds.extend(circle.getBounds());
    }

    // Load markers
    displayLoads.forEach(load => {
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
        const remainingVolume = Math.max(0, (load.totalVolume || 0) - (load.loadedVolume || 0));
        const isSelected = selectedCargo?.id === load.id;

        const createBtnHtml = !isMotorista ? `
          <button id="create-shipment-btn-${load.id}" style="width:100%; padding:7px 10px; background:#1D3B8D; color:#ffffff; font-size:11px; font-weight:800; border-radius:8px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px; box-shadow:0 2px 6px rgba(29,59,141,0.3);">
            <span>🚀 Criar Embarque</span>
          </button>
        ` : '';

        const popupContent = `
          <div style="min-width: 260px; font-family: inherit; padding: 4px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #f1f5f9; padding-bottom:8px; margin-bottom:8px;">
              <div>
                <span style="font-size:10px; font-weight:800; text-transform:uppercase; background:#dbeafe; color:#1e40af; padding:2px 6px; border-radius:4px;">#CRG-${load.sequenceId}</span>
                <h4 style="font-size:13px; font-weight:800; color:#0f172a; margin:4px 0 0 0;">${client?.nomeFantasia || 'Carga Disponível'}</h4>
              </div>
              <span style="font-size:11px; font-weight:700; background:#f8fafc; color:#475569; padding:2px 8px; border-radius:6px; border:1px solid #e2e8f0;">${product?.name || 'Carga'}</span>
            </div>

            <div style="background:#f8fafc; border-radius:10px; padding:8px 10px; margin-bottom:8px; border:1px solid #edf2f7; font-size:11px;">
              <div style="display:flex; align-items:center; margin-bottom:4px; color:#334155;">
                <span style="width:8px; height:8px; background:#10b981; border-radius:50%; display:inline-block; margin-right:6px; shrink:0;"></span>
                <span><b>Origem:</b> ${load.origin}</span>
              </div>
              <div style="display:flex; align-items:center; color:#334155;">
                <span style="width:8px; height:8px; background:#ef4444; border-radius:50%; display:inline-block; margin-right:6px; shrink:0;"></span>
                <span><b>Destino:</b> ${load.destination}</span>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:0 2px;">
              <div>
                <span style="font-size:10px; color:#64748b; text-transform:uppercase; display:block; font-weight:700;">Frete Motorista</span>
                <span style="font-size:14px; font-weight:900; color:#059669;">R$ ${load.driverFreightValuePerTon.toFixed(2)}<span style="font-size:10px; color:#64748b; font-weight:500;">/ton</span></span>
              </div>
              <div style="text-align:right;">
                <span style="font-size:10px; color:#64748b; text-transform:uppercase; display:block; font-weight:700;">Disponível</span>
                <span style="font-size:13px; font-weight:800; color:#0f172a;">${remainingVolume.toFixed(1)} <span style="font-size:10px; color:#64748b; font-weight:500;">ton</span></span>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; margin-top:8px;">
              <button id="view-details-btn-${load.id}" style="padding:7px 8px; background:#f1f5f9; color:#1e293b; font-size:11px; font-weight:700; border-radius:8px; border:1px solid #cbd5e1; cursor:pointer;">
                Ver Ficha
              </button>
              ${createBtnHtml}
            </div>
          </div>
        `;

        const marker = L.marker([load.originCoords.lat, load.originCoords.lng], {
          icon: createCargoMarkerIcon(load, isSelected)
        });

        marker.bindPopup(popupContent);
        marker.on('click', () => {
          setSelectedCargo(load);
          drawCargoRoute(load);
        });

        marker.addTo(markersLayerRef.current);
        markersRef.current.set(load.id, marker);
        bounds.extend([load.originCoords.lat, load.originCoords.lng]);
      }
    });

    if (bounds.isValid() && !selectedCargo) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [displayLoads, originCoords, destinationCoords, driverCoords, originRadius, destinationRadius, selectedCargo, clients, products, shipments, isMotorista, currentUser, drawCargoRoute]);

  useEffect(() => {
    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [initMap]);

  useEffect(() => {
    updateMapLayers();
  }, [updateMapLayers]);

  // Recenter / fit bounds
  const handleRecenterMap = () => {
    if (!mapInstanceRef.current) return;
    const bounds = L.latLngBounds();
    if (driverCoords) bounds.extend([driverCoords.lat, driverCoords.lng]);
    if (originCoords) bounds.extend([originCoords.lat, originCoords.lng]);
    displayLoads.forEach(l => {
      if (l.originCoords) bounds.extend([l.originCoords.lat, l.originCoords.lng]);
    });
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 9 });
    } else {
      mapInstanceRef.current.setView([-15.78, -47.92], 4);
    }
  };

  // Select cargo from sidebar or popup
  const handleSelectCargo = (cargo: Cargo) => {
    setSelectedCargo(cargo);
    drawCargoRoute(cargo);
    const marker = markersRef.current.get(cargo.id);
    if (marker && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(marker.getLatLng(), Math.max(mapInstanceRef.current.getZoom(), 8), {
        animate: true,
        duration: 0.8
      });
      marker.openPopup();
    }
    setMobileTab('details');
  };

  // Clear selected cargo
  const handleClearSelection = () => {
    setSelectedCargo(null);
    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers();
    }
    handleRecenterMap();
  };

  // Perform search (Geocode origin and destination)
  const handleSearch = async (e: React.FormEvent | null) => {
    if (e) e.preventDefault();
    if (!originQuery.trim() && !destinationQuery.trim()) {
      setOriginCoords(null);
      setDestinationCoords(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [originResult, destinationResult] = await Promise.all([
        originQuery.trim() ? geocodeCity(originQuery) : Promise.resolve(null),
        destinationQuery.trim() ? geocodeCity(destinationQuery) : Promise.resolve(null)
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

  // Inverter Origem ⇄ Destino
  const handleSwapOriginDestination = () => {
    const tempQuery = originQuery;
    const tempRadius = originRadius;
    const tempCoords = originCoords;

    setOriginQuery(destinationQuery);
    setOriginRadius(destinationRadius);
    setOriginCoords(destinationCoords);

    setDestinationQuery(tempQuery);
    setDestinationRadius(tempRadius);
    setDestinationCoords(tempCoords);
  };

  // Formatter for allowed vehicle body types
  const formatAllowedVehicleTypes = (allowed?: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[]): string => {
    if (!allowed || allowed.length === 0) return 'Qualquer Carroceria';
    const allBodyTypes = allowed.flatMap(type => type.bodyTypes);
    const uniqueBodyTypes = [...new Set(allBodyTypes)];
    return uniqueBodyTypes.join(', ');
  };

  // Formatter for allowed vehicle set types
  const formatAllowedSetTypes = (allowed?: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[]): string => {
    if (!allowed || allowed.length === 0) return 'Todos os Conjuntos';
    const allSetTypes = allowed.map(type => type.setType);
    const uniqueSetTypes = [...new Set(allSetTypes)];
    return uniqueSetTypes.join(', ');
  };

  // Share all filtered loads
  const handleShareFilteredLoads = () => {
    if (displayLoads.length === 0) {
      alert('Nenhuma carga no resultado para divulgar.');
      return;
    }
    const header = '🌐 *LIBERADOS RODOCHAGAS* 🌐\n';
    const loadsText = displayLoads.map(load => {
      const product = products.find(p => p.id === load.productId)?.name?.toUpperCase() || 'N/A';
      const origin = load.origin.toUpperCase();
      const destination = load.destination.toUpperCase();
      const price = load.driverFreightValuePerTon.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const bodyTypes = formatAllowedVehicleTypes(load.allowedVehicleTypes);
      const availableTons = Math.max(0, (load.totalVolume || 0) - (load.loadedVolume || 0));
      const dispText = availableTons > 0 ? ` | ⚖️ Disp: ${availableTons.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ton` : '';
      let text = `📍 ${origin} x ${destination} \n🌾 ${product} - 💲 R$ ${price}${dispText}\t\n🚛 ${bodyTypes} 🚛`;
      
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

  // Share a single cargo
  const handleShareSingleLoad = (load: Cargo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const product = products.find(p => p.id === load.productId)?.name?.toUpperCase() || 'N/A';
    const origin = load.origin.toUpperCase();
    const destination = load.destination.toUpperCase();
    const price = load.driverFreightValuePerTon.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const bodyTypes = formatAllowedVehicleTypes(load.allowedVehicleTypes);
    const availableTons = Math.max(0, (load.totalVolume || 0) - (load.loadedVolume || 0));
    const dispText = availableTons > 0 ? ` | ⚖️ Disp: ${availableTons.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ton` : '';
    let text = `🌐 *RODOCHAGAS - OPORTUNIDADE DE CARGA* 🌐\n\n📍 ${origin} x ${destination}\n🌾 ${product} - 💲 R$ ${price}${dispText}\n🚛 ${bodyTypes} 🚛`;

    if (load.originLocation) text += `\n🏢 Coleta: ${load.originLocation}`;
    const cleanOriginMap = cleanOrShortenLocationInput(load.originMapLink);
    if (cleanOriginMap) text += `\n📍Mapa Coleta: ${cleanOriginMap}`;

    if (load.destinationLocation) text += `\n🏢 Entrega: ${load.destinationLocation}`;
    const cleanDestMap = cleanOrShortenLocationInput(load.destinationMapLink);
    if (cleanDestMap) text += `\n📍Mapa Entrega: ${cleanDestMap}`;

    navigator.clipboard.writeText(text).then(() => {
      alert('Informações da carga copiadas para o WhatsApp!');
    }).catch(() => {
      alert('Não foi possível copiar.');
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DRIVER-OPTIMIZED VIEW (Clean Modern Dark Mode with Route Visualizer)
  // ─────────────────────────────────────────────────────────────────────────
  if (isMotorista) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans antialiased">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3 shadow-lg shadow-black/20">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {companyLogo ? (
                <img src={companyLogo} alt="Logo" className="h-10 md:h-12 w-auto object-contain max-w-[180px]" />
              ) : (
                <div className="flex items-center gap-2 font-black text-xl tracking-wider">
                  <span className="text-white">RODO</span>
                  <span className="text-cyan-400">CHAGAS</span>
                </div>
              )}
              <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>GPS Motorista</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleGetDriverLocation}
                title={driverCoords ? 'GPS Ativo' : 'Ativar GPS'}
                className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer ${
                  driverCoords
                    ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <Compass className={`w-4 h-4 ${isGpsLocating ? 'animate-spin text-cyan-400' : ''}`} />
                <span>{driverCoords ? 'GPS Ativo' : 'Ligar GPS'}</span>
              </button>

              <button
                onClick={() => navigate('/operational-loads')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md shadow-cyan-950/30 transition-all cursor-pointer active:scale-95"
              >
                <span>← Oportunidades</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-6xl mx-auto px-4 pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                <Navigation className="w-5 h-5 text-cyan-400" />
                <span>Radar Operacional de Cargas</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Visualize oportunidades de frete no mapa pelo raio de proximidade</p>
            </div>
            
            <div className="flex items-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold">
                {displayLoads.length} cargas no radar
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Map Frame */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="relative bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden h-[420px] sm:h-[500px]">
                <div ref={mapContainerRef} className="w-full h-full z-0" />
                
                {/* Floating Map Theme & Controls */}
                <div className="absolute top-3 left-3 z-[400] flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setMapTheme('dark')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${mapTheme === 'dark' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => setMapTheme('satellite')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${mapTheme === 'satellite' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
                  >
                    Satélite
                  </button>
                  <button
                    onClick={() => setMapTheme('osm')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${mapTheme === 'osm' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
                  >
                    Ruas
                  </button>
                </div>

                <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
                  <button
                    onClick={handleRecenterMap}
                    title="Centralizar Cargas"
                    className="p-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-slate-300 hover:text-white shadow-lg transition-all"
                  >
                    <Crosshair className="w-4 h-4 text-cyan-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Panel: Radar Filters & List */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Search className="w-4 h-4" />
                    <span>Ajustar Raio de Proximidade</span>
                  </h3>
                  {driverCoords && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      GPS Ativo
                    </span>
                  )}
                </div>

                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Sua Localização / Cidade Base</span>
                      </div>
                      <span className="font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 text-[11px]">{originRadius} km</span>
                    </div>
                    <input 
                      type="text" 
                      list="city-suggestions-driver"
                      value={originQuery} 
                      onChange={(e) => setOriginQuery(e.target.value)} 
                      placeholder="Ex: Catalão, GO ou sua cidade" 
                      className="w-full p-2.5 bg-slate-950 text-white border border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all" 
                    />
                    
                    {/* Radius presets */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {RADIUS_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setOriginRadius(preset)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${originRadius === preset ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'}`}
                        >
                          {preset} km
                        </button>
                      ))}
                    </div>

                    <input 
                      type="range" 
                      min="50" 
                      max="1000" 
                      step="50" 
                      value={originRadius} 
                      onChange={(e) => setOriginRadius(parseInt(e.target.value))} 
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 mt-1" 
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
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-cyan-950/40 active:scale-95 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Calculando Raio...</span>
                      </>
                    ) : (
                      <span>Atualizar Radar no Mapa</span>
                    )}
                  </button>
                </form>
                {error && <p className="text-red-400 text-xs font-semibold bg-red-950/40 border border-red-500/20 p-2 rounded-xl text-center">{error}</p>}
              </div>

              {/* Freight Opportunities Feed */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                    Oportunidades Próximas <span className="text-cyan-400 ml-1">({displayLoads.length})</span>
                  </h4>
                </div>

                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                  {displayLoads.length > 0 ? (
                    displayLoads.map(load => {
                      const product = products.find(p => p.id === load.productId);
                      const distToDriver = calculateDistanceKm(driverCoords || originCoords, load.originCoords);
                      const isSelected = selectedCargo?.id === load.id;

                      return (
                        <div 
                          key={load.id} 
                          onClick={() => handleSelectCargo(load)}
                          className={`p-3.5 rounded-2xl transition-all cursor-pointer space-y-2.5 group border ${
                            isSelected 
                              ? 'bg-cyan-950/30 border-cyan-500/60 shadow-lg shadow-cyan-950/50' 
                              : 'bg-slate-950/70 border-slate-800 hover:border-cyan-500/40 hover:bg-slate-950'
                          }`}
                        >
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

                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
                            <div className="text-slate-400">
                              {distToDriver !== null ? (
                                <span>Distância: <b className="text-cyan-400">{distToDriver} km</b></span>
                              ) : (
                                <span>Disponível</span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-emerald-400">
                                R$ {load.driverFreightValuePerTon.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-slate-500"> / ton</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSelectCargo(load); }}
                              className="flex-1 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[11px] font-bold transition-all flex items-center justify-center gap-1"
                            >
                              <span>Traçar Rota no Mapa</span>
                              <span>→</span>
                            </button>
                          </div>
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
  // ADMINISTRATIVE / DISPATCH COMMAND CENTER VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const selectedProduct = selectedCargo ? products.find(p => p.id === selectedCargo.productId) : null;
  const selectedClient = selectedCargo ? clients.find(c => c.id === selectedCargo.clientId) : null;
  const selectedCommercialUser = selectedCargo ? users.find(u => u.id === selectedCargo.createdById) : null;
  const selectedRouteDistance = selectedCargo ? Math.round(calculateDistanceKm(selectedCargo.originCoords, selectedCargo.destinationCoords) || 0) : null;
  const selectedRemainingVolume = selectedCargo ? Math.max(0, (selectedCargo.totalVolume || 0) - (selectedCargo.loadedVolume || 0)) : 0;
  const selectedLoadedPercentage = selectedCargo && selectedCargo.totalVolume > 0 
    ? Math.min(100, Math.round(((selectedCargo.loadedVolume || 0) / selectedCargo.totalVolume) * 100)) 
    : 0;

  return (
    <div className="flex flex-col h-full space-y-4 w-full">
      {/* Top Header & Executive Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <Header title="Mapa Operacional Logístico">
          <div className="flex items-center gap-2 flex-wrap">
            {displayLoads.length > 0 && currentUser?.profile !== UserProfile.Cliente && (
              <button 
                onClick={handleShareFilteredLoads}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
              >
                <CopyIcon className="w-3.5 h-3.5" />
                <span>{copyButtonText} ({displayLoads.length})</span>
              </button>
            )}

            {currentUser?.profile !== UserProfile.Cliente && (
              <button 
                onClick={handleSyncAllCargos}
                disabled={syncingAll}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-all font-bold text-xs border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50"
              >
                {syncingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden sm:inline">Sincronizar Coordenadas</span>
                  </>
                )}
              </button>
            )}
          </div>
        </Header>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Cargas no Raio</p>
            <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">{kpiStats.count}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Volume Disponível</p>
            <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              {kpiStats.totalAvailableTons.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} <span className="text-xs font-normal text-slate-500">ton</span>
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Média Frete Motorista</p>
            <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              R$ {kpiStats.avgFreight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 flex items-center justify-center shrink-0">
            <RouteIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Corredores Mapeados</p>
            <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
              {kpiStats.uniqueOriginsCount} <span className="text-xs font-normal text-slate-500">origens</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Command Center Split Screen */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">
        
        {/* Left Column: Map + Interactive Cargo Inspector */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          
          {/* Map Container */}
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden h-[420px] lg:h-[480px] flex-shrink-0">
            <div ref={mapContainerRef} className="w-full h-full z-0" />

            {/* Map Style Selector Overlay (Top Left) */}
            <div className="absolute top-3 left-3 z-[400] flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 text-xs">
              {(['osm', 'satellite', 'dark', 'light'] as const).map(theme => (
                <button
                  key={theme}
                  onClick={() => setMapTheme(theme)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all text-[11px] cursor-pointer ${
                    mapTheme === theme
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {TILE_LAYERS[theme].name.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Floating Map Actions (Top Right) */}
            <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
              <button
                onClick={handleRecenterMap}
                title="Centralizar Cargas no Raio"
                className="p-2 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-blue-600 shadow-md transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              >
                <Crosshair className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">Centralizar</span>
              </button>

              <button
                onClick={handleGetDriverLocation}
                title="Meu Local GPS"
                className="p-2 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-cyan-600 shadow-md transition-all cursor-pointer"
              >
                <Compass className={`w-4 h-4 ${isGpsLocating ? 'animate-spin text-cyan-600' : 'text-slate-500'}`} />
              </button>
            </div>

            {/* Legend Tag (Bottom Left) */}
            <div className="absolute bottom-3 left-3 z-[400] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 text-[10px] flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block shadow-sm"></span>
                <span className="font-bold text-slate-700 dark:text-slate-300">Carga</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-600 inline-block"></span>
                <span className="font-bold text-slate-700 dark:text-slate-300">Raio Origem</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-red-500 inline-block"></span>
                <span className="font-bold text-slate-700 dark:text-slate-300">Raio Destino</span>
              </div>
            </div>
          </div>

          {/* Dynamic Cargo Inspector / Operational Dossier (Solves the empty dashed box!) */}
          <div className="bg-white dark:bg-slate-800/95 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition-all">
            {selectedCargo ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/80 pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-black text-xs border border-blue-200 dark:border-blue-800">
                      Carga #{selectedCargo.sequenceId}
                    </span>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {selectedClient?.nomeFantasia || selectedClient?.razaoSocial || 'Cliente'}
                    </h3>
                    {selectedProduct && (
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold text-xs border border-amber-200 dark:border-amber-800">
                        🌾 {selectedProduct.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClearSelection}
                      title="Fechar seleção"
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 4 Core Inspection Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Route & Distance */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Itinerário Rodoviário</span>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                        <span className="truncate">{selectedCargo.origin}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                        <span className="truncate">{selectedCargo.destination}</span>
                      </div>
                    </div>
                    {selectedRouteDistance && selectedRouteDistance > 0 && (
                      <p className="text-[11px] font-black text-cyan-600 dark:text-cyan-400 pt-1 border-t border-slate-200/50 dark:border-slate-800">
                        Distância rota: ~{selectedRouteDistance.toLocaleString('pt-BR')} km
                      </p>
                    )}
                  </div>

                  {/* Pricing & Total Value */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Condições Comerciais</span>
                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                      R$ {selectedCargo.driverFreightValuePerTon.toFixed(2)} <span className="text-xs font-medium text-slate-500">/ ton</span>
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Total disp: <b>R$ {(selectedRemainingVolume * selectedCargo.driverFreightValuePerTon).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                    </p>
                  </div>

                  {/* Volume Tracker */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span>Progresso de Carga</span>
                      <span className="text-blue-600 dark:text-blue-400">{selectedLoadedPercentage}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500" 
                        style={{ width: `${selectedLoadedPercentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                      <span>Disp: <b className="text-slate-900 dark:text-white">{selectedRemainingVolume.toFixed(1)}t</b></span>
                      <span>Total: {selectedCargo.totalVolume.toFixed(1)}t</span>
                    </div>
                  </div>

                  {/* Vehicle Types Accepted */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipos de Conjunto</span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2">
                      {formatAllowedSetTypes(selectedCargo.allowedVehicleTypes)}
                    </p>
                    <p className="text-[10px] text-slate-500 italic">
                      {formatAllowedVehicleTypes(selectedCargo.allowedVehicleTypes)}
                    </p>
                  </div>
                </div>

                {/* Action Buttons Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedCargo.originMapLink && (
                      <a 
                        href={selectedCargo.originMapLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 text-blue-500" /> Mapa Coleta
                      </a>
                    )}
                    {selectedCargo.destinationMapLink && (
                      <a 
                        href={selectedCargo.destinationMapLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 text-red-500" /> Mapa Entrega
                      </a>
                    )}
                    <button
                      onClick={() => handleShareSingleLoad(selectedCargo)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCargoForDetails(selectedCargo);
                        setIsCargoDetailsModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" /> Ficha Completa
                    </button>
                  </div>

                  {currentUser?.profile !== UserProfile.Cliente && (
                    <button
                      onClick={() => handleOpenNewShipmentModal(selectedCargo)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                    >
                      <span>🚀 Emitir Novo Embarque Nesta Carga</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Painel de Inspeção Operacional</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Selecione qualquer marcador no mapa ou carga na lista ao lado para traçar rota rodoviária e emitir embarque imediato.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setOriginRadius(1000);
                      setDestinationRadius(1000);
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    Ampliar para Todo o Brasil
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Search Parameters & Live Freight Feed */}
        <aside className="w-full lg:w-[410px] flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar pb-6">
          
          {/* Search Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                <span>Parâmetros de Busca</span>
              </h3>
              <button
                type="button"
                onClick={handleSwapOriginDestination}
                title="Inverter Origem e Destino"
                className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>Inverter</span>
              </button>
            </div>

            <form onSubmit={handleSearch} className="space-y-4">
              {/* Origem */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span>Origem (Coleta)</span>
                  </div>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                    {originRadius} km
                  </span>
                </div>
                <input 
                  type="text" 
                  list="city-suggestions-admin"
                  value={originQuery} 
                  onChange={(e) => setOriginQuery(e.target.value)} 
                  placeholder="Ex: Catalão, GO ou Uberlândia" 
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white" 
                />
                
                {/* Quick Presets */}
                <div className="flex items-center gap-1.5">
                  {RADIUS_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOriginRadius(preset)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                        originRadius === preset 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {preset}km
                    </button>
                  ))}
                </div>

                <input 
                  type="range" 
                  min="50" 
                  max="1000" 
                  step="50" 
                  value={originRadius} 
                  onChange={(e) => setOriginRadius(parseInt(e.target.value))} 
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                />
              </div>

              {/* Destino */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span>Destino (Opcional)</span>
                  </div>
                  <span className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800">
                    {destinationRadius} km
                  </span>
                </div>
                <input 
                  type="text" 
                  list="city-suggestions-admin"
                  value={destinationQuery} 
                  onChange={(e) => setDestinationQuery(e.target.value)} 
                  placeholder="Ex: Santos, SP ou Paranaguá" 
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all dark:text-white" 
                />

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5">
                  {RADIUS_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDestinationRadius(preset)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                        destinationRadius === preset 
                          ? 'bg-red-600 text-white border-red-600' 
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-red-400'
                      }`}
                    >
                      {preset}km
                    </button>
                  ))}
                </div>

                <input 
                  type="range" 
                  min="50" 
                  max="1000" 
                  step="50" 
                  value={destinationRadius} 
                  onChange={(e) => setDestinationRadius(parseInt(e.target.value))} 
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-600" 
                />
              </div>

              <datalist id="city-suggestions-admin">
                {BRAZILIAN_CITIES.map((city, idx) => (
                  <option key={idx} value={city} />
                ))}
              </datalist>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-blue-600/25 active:scale-95 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Localizando no Mapa...</span>
                  </>
                ) : (
                  <span>Filtrar Cargas no Mapa</span>
                )}
              </button>
            </form>
            {error && <p className="text-red-500 text-xs font-bold bg-red-50 dark:bg-red-900/20 p-2 rounded-xl text-center border border-red-100 dark:border-red-900/30">{error}</p>}

            {/* Collapsible Secondary Filter Bar */}
            <div className="border-t border-slate-100 dark:border-slate-700/80 pt-3 space-y-2">
              <button
                type="button"
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span>Filtros Adicionais & Ordenação</span>
                </span>
                {isFiltersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {isFiltersOpen && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Buscar por Produto ou Cliente</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Ex: Soja, Bunge, Fertilizante..."
                      className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Tipo de Veículo</label>
                      <select
                        value={selectedVehicleType}
                        onChange={(e) => setSelectedVehicleType(e.target.value)}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white"
                      >
                        <option value="">Todos</option>
                        <option value="Rodotrem">Rodotrem</option>
                        <option value="Bitrem 7e">Bitrem 7e</option>
                        <option value="Bitrem 8e">Bitrem 8e</option>
                        <option value="LS Trucada">LS Trucada</option>
                        <option value="LS Simples">LS Simples</option>
                        <option value="Vanderleia">Vanderleia</option>
                        <option value="Caminhão Truck">Truck</option>
                        <option value="Graneleiro">Graneleiro</option>
                        <option value="Basculante">Basculante</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Ordenar por</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:text-white"
                      >
                        <option value="nearest">Mais Próximos</option>
                        <option value="price_desc">Maior Frete</option>
                        <option value="volume_desc">Maior Volume</option>
                        <option value="id_desc">Mais Recentes</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Results List Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col flex-1 min-h-[460px]">
            <div className="flex justify-between items-center mb-3 border-b border-slate-100 dark:border-slate-700 pb-2.5">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span>Resultados</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-black">
                  {displayLoads.length}
                </span>
              </h4>

              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-[10px] text-blue-600 hover:underline font-bold"
                >
                  Limpar busca
                </button>
              )}
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
              {displayLoads.length > 0 ? (
                displayLoads.map(load => {
                  const client = clients.find(c => c.id === load.clientId);
                  const product = products.find(p => p.id === load.productId);
                  const isSelected = selectedCargo?.id === load.id;
                  const remainingVolume = Math.max(0, (load.totalVolume || 0) - (load.loadedVolume || 0));

                  return (
                    <div 
                      key={load.id} 
                      onClick={() => handleSelectCargo(load)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
                        isSelected 
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/10' 
                          : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm'
                      }`}
                    >
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${isSelected ? 'bg-orange-500' : 'bg-blue-600'}`}></div>
                      
                      <div className="flex justify-between items-start mb-1.5 pl-1">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-blue-600 dark:text-blue-400 truncate uppercase">
                            {client?.nomeFantasia || client?.razaoSocial || 'Cliente'}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {product?.name || 'Grãos'}
                          </p>
                        </div>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                          #{load.sequenceId}
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-1 my-2 pl-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-1.5 truncate">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                          <span className="truncate">{load.origin}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></div>
                          <span className="truncate">{load.destination}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/80 pl-1">
                        <div>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                            R$ {load.driverFreightValuePerTon.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400"> / ton</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                            {remainingVolume.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">ton disp.</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-16 px-4 flex flex-col items-center justify-center space-y-2">
                  <Package className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  <p className="text-slate-600 dark:text-slate-300 text-xs font-bold">Nenhuma carga encontrada no raio atual</p>
                  <p className="text-slate-400 dark:text-slate-500 text-[11px] max-w-[240px]">
                    Tente aumentar o raio de busca ou remover os filtros de produto/veículo.
                  </p>
                  <button
                    onClick={() => {
                      setOriginRadius(500);
                      setDestinationRadius(500);
                      setSearchTerm('');
                      setSelectedVehicleType('');
                    }}
                    className="mt-2 px-3 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer"
                  >
                    Aumentar raio para 500km
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* New Shipment Modal */}
      <NewShipmentModal
        isOpen={isShipmentModalOpen}
        onClose={handleCloseShipmentModal}
        onSave={handleSaveShipment}
        cargo={selectedCargoForShipment}
        cargos={cargos}
        drivers={drivers}
        clients={clients}
        vehicles={vehicles}
        currentUser={currentUser}
        shipments={shipments}
        users={users}
      />

      {/* Cargo Details Modal */}
      <CargoDetailsModal
        isOpen={isCargoDetailsModalOpen}
        onClose={() => {
          setIsCargoDetailsModalOpen(false);
          setSelectedCargoForDetails(null);
        }}
        cargo={selectedCargoForDetails}
        client={clients.find(c => c.id === selectedCargoForDetails?.clientId)}
        product={products.find(p => p.id === selectedCargoForDetails?.productId)}
        commercialUser={users.find(u => u.id === selectedCargoForDetails?.createdById)}
        shipments={shipments}
        currentUser={currentUser || undefined}
      />
    </div>
  );
};

export default OperationalMapPage;
