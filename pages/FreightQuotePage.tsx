
import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Route, MapPin, Navigation, Truck, DollarSign, 
  Percent, Scale, Fuel, Info, Save, Download, 
  FileText, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, Settings2, Building2, Calculator,
  FileCode, Clock
} from 'lucide-react';
import Header from '../components/Header';
import { saveToolQuote, getToolClients, saveToolClient, Client } from '../utils/toolStorage';
import type { User as AppUser } from '../types';

// Fix Leaflet icon issue
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Location {
  lat: number;
  lng: number;
  label: string;
}

interface QuoteData {
  clientName: string;
  origin: string;
  destination: string;
  weight: string;
  cargoType: string;
  axes: string;
  inputMode: 'PER_KM' | 'TOTAL' | 'PER_TON';
  valuePerKm: string;
  driverTotalValue: string;
  tollValue: string;
  anttValue: string;
  margin: string;
  icms: string;
  dieselPrice: string;
  averageConsumption: string;
  driverCommissionPercent: string;
}

interface RouteInfo {
  distance: number;
  duration: number;
  coordinates: [number, number][];
}

interface FreightQuotePageProps {
  currentUser: AppUser | null;
}

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function FreightQuotePage({ currentUser }: FreightQuotePageProps) {
  const companyId = currentUser?.id || 'default';
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [originCoords, setOriginCoords] = useState<Location | null>(null);
  const [destCoords, setDestCoords] = useState<Location | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialData: QuoteData = {
    clientName: '',
    origin: '',
    destination: '',
    weight: '27',
    cargoType: 'Geral',
    axes: '6',
    inputMode: 'PER_KM',
    valuePerKm: '5.50',
    driverTotalValue: '',
    tollValue: '0',
    anttValue: '0',
    margin: '15',
    icms: '12',
    dieselPrice: '5.89',
    averageConsumption: '2.2',
    driverCommissionPercent: '10'
  };

  const [formData, setFormData] = useState<QuoteData>(initialData);

  useEffect(() => {
    setClients(getToolClients(companyId));
  }, [companyId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSaveSuccess(false);
  };

  const fetchCoordinates = async (address: string) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          label: data[0].display_name
        };
      }
      return null;
    } catch (err) {
      console.error('Geocoding error:', err);
      return null;
    }
  };

  const calculateRoute = async () => {
    if (!formData.origin || !formData.destination) {
      setError('Informe a origem e o destino para calcular a rota.');
      return;
    }

    setLoading(true);
    setError(null);
    setRouteInfo(null);

    try {
      const origin = await fetchCoordinates(formData.origin);
      const dest = await fetchCoordinates(formData.destination);

      if (!origin || !dest) {
        setError('Não foi possível localizar um dos endereços.');
        setLoading(false);
        return;
      }

      setOriginCoords(origin);
      setDestCoords(dest);

      const routeResponse = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`);
      const routeData = await routeResponse.json();

      if (routeData.code === 'Ok' && routeData.routes.length > 0) {
        const route = routeData.routes[0];
        setRouteInfo({
          distance: route.distance / 1000,
          duration: route.duration / 60,
          coordinates: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]])
        });
      } else {
        setError('Não foi possível calcular a rota.');
      }
    } catch (err) {
      setError('Erro ao conectar com o serviço de mapas.');
    } finally {
      setLoading(false);
    }
  };

  const results = useMemo(() => {
    if (!routeInfo) return null;

    const distance = routeInfo.distance;
    const weight = parseFloat(formData.weight) || 0;
    const margin = parseFloat(formData.margin) || 0;
    const icms = parseFloat(formData.icms) || 0;
    const toll = parseFloat(formData.tollValue) || 0;
    const antt = parseFloat(formData.anttValue) || 0;
    const dieselPrice = parseFloat(formData.dieselPrice) || 0;
    const consumption = parseFloat(formData.averageConsumption) || 0;
    const commissionPercent = parseFloat(formData.driverCommissionPercent) || 0;

    let driverTotalValue = 0;
    if (formData.inputMode === 'PER_KM') {
      driverTotalValue = distance * (parseFloat(formData.valuePerKm) || 0);
    } else if (formData.inputMode === 'TOTAL') {
      driverTotalValue = parseFloat(formData.driverTotalValue) || 0;
    } else if (formData.inputMode === 'PER_TON') {
      driverTotalValue = weight * (parseFloat(formData.driverTotalValue) || 0);
    }

    const driverFreightPerTon = weight > 0 ? driverTotalValue / weight : 0;
    const dieselCost = consumption > 0 ? (distance / consumption) * dieselPrice : 0;
    const commissionValue = (driverTotalValue * commissionPercent) / 100;

    const divisor = 1 - (margin / 100) - (icms / 100);
    const companyTotalFreight = divisor > 0 ? (driverTotalValue + toll) / divisor : (driverTotalValue + toll);
    const companyFreightPerTon = weight > 0 ? companyTotalFreight / weight : 0;

    const carrierNetProfit = companyTotalFreight - driverTotalValue - toll;
    const carrierProfitMargin = companyTotalFreight > 0 ? (carrierNetProfit / companyTotalFreight) * 100 : 0;

    return {
      distance,
      driverTotalValue,
      driverFreightPerTon,
      dieselCost,
      commissionValue,
      companyTotalFreight,
      companyFreightPerTon,
      carrierNetProfit,
      carrierProfitMargin
    };
  }, [formData, routeInfo]);

  const handleSave = () => {
    if (!results || !routeInfo) return;

    if (formData.clientName) {
      saveToolClient(companyId, formData.clientName);
    }

    saveToolQuote({
      companyId,
      clientName: formData.clientName || 'Não Informado',
      origin: formData.origin,
      destination: formData.destination,
      distance: routeInfo.distance,
      axes: parseInt(formData.axes),
      cargoType: formData.cargoType,
      inputMode: formData.inputMode,
      valuePerKm: parseFloat(formData.valuePerKm) || 0,
      driverTotalValue: results.driverTotalValue,
      tollValue: parseFloat(formData.tollValue) || 0,
      anttValue: parseFloat(formData.anttValue) || 0,
      weight: parseFloat(formData.weight) || 0,
      margin: parseFloat(formData.margin) || 0,
      icms: parseFloat(formData.icms) || 0,
      driverFreightPerTon: results.driverFreightPerTon,
      companyFreightPerTon: results.companyFreightPerTon,
      companyTotalFreight: results.companyTotalFreight,
      dieselPrice: parseFloat(formData.dieselPrice) || 0,
      averageConsumption: parseFloat(formData.averageConsumption) || 0,
      driverCommissionPercent: parseFloat(formData.driverCommissionPercent) || 0,
      dieselCost: results.dieselCost,
      commissionValue: results.commissionValue,
      carrierNetProfit: results.carrierNetProfit,
      carrierProfitMargin: results.carrierProfitMargin
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <>
      <Header title="Cotação de Frete" />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 font-sans">
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-medium flex items-center text-slate-800 dark:text-white mb-6">
              <Settings2 className="w-5 h-5 mr-2 text-indigo-500" /> Rota
            </h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                  <Building2 className="w-4 h-4 mr-1.5 text-slate-400" /> Cliente
                </label>
                <input type="text" name="clientName" value={formData.clientName} onChange={handleInputChange} list="clients-list-q" className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" placeholder="Nome do cliente" />
                <datalist id="clients-list-q">
                  {clients.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                    <MapPin className="w-4 h-4 mr-1.5 text-emerald-500" /> Origem
                  </label>
                  <input type="text" name="origin" value={formData.origin} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                    <MapPin className="w-4 h-4 mr-1.5 text-red-500" /> Destino
                  </label>
                  <input type="text" name="destination" value={formData.destination} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" />
                </div>
              </div>

              <button onClick={calculateRoute} disabled={loading} className="w-full flex items-center justify-center px-4 py-2.5 bg-slate-900 dark:bg-gray-700 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium text-sm disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Navigation className="w-4 h-4 mr-2" />} Calcular Rota
              </button>

              {error && <div className="p-3 bg-red-50 text-xs text-red-600 rounded-lg">{error}</div>}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-gray-700 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Peso (Ton)</label>
                  <input type="number" name="weight" value={formData.weight} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500">Diesel (R$/L)</label>
                  <input type="number" step="0.01" name="dieselPrice" value={formData.dieselPrice} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden h-[400px] relative z-0">
            <MapContainer center={[-15.78, -47.92]} zoom={4} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <ZoomControl position="bottomright" />
              {originCoords && <Marker position={[originCoords.lat, originCoords.lng]} />}
              {destCoords && <Marker position={[destCoords.lat, destCoords.lng]} />}
              {routeInfo && <Polyline positions={routeInfo.coordinates} color="#4f46e5" weight={4} opacity={0.7} />}
              {originCoords && destCoords && <ChangeView center={[(originCoords.lat + destCoords.lat) / 2, (originCoords.lng + destCoords.lng) / 2]} zoom={6} />}
            </MapContainer>
            {routeInfo && (
              <div className="absolute top-4 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur shadow-md rounded-xl p-3 border border-slate-200 dark:border-gray-700 z-[1000] flex items-center space-x-4">
                <div className="flex items-center text-sm font-semibold text-slate-800 dark:text-white">
                  <Route className="w-4 h-4 mr-2 text-indigo-500" /> {routeInfo.distance.toFixed(0)} km
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-medium flex items-center text-slate-800 dark:text-white mb-6">
              <DollarSign className="w-5 h-5 mr-2 text-emerald-500" /> Frete do Motorista
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Valor (R$)</label>
                <input type="number" step="0.01" name={formData.inputMode === 'PER_KM' ? 'valuePerKm' : 'driverTotalValue'} value={formData.inputMode === 'PER_KM' ? formData.valuePerKm : formData.driverTotalValue} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Pedágio (R$)</label>
                <input type="number" name="tollValue" value={formData.tollValue} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm" />
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/50">
              <h2 className="text-lg font-medium flex items-center text-slate-800 dark:text-white">Resultado Final</h2>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              {results ? (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div>
                    <div className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase tracking-wider">Total do Frete</div>
                    <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 tracking-tight">{formatCurrency(results.companyTotalFreight)}</div>
                  </div>
                  <div className="space-y-3 py-4 border-y border-slate-100 dark:border-gray-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Lucro Líquido:</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(results.carrierNetProfit)}</span>
                    </div>
                  </div>
                  <div className="space-y-3 mt-auto">
                    {saveSuccess && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-xs">Cotação salva!</div>}
                    <button onClick={handleSave} className="w-full py-3 bg-primary text-white rounded-xl font-medium">Salvar Cotação</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Calcule a rota para ver o resultado.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
