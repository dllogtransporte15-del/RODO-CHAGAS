
import React, { useState, useEffect, useRef } from 'react';
import { Shipment, ShipmentStatus, User, UserProfile, Cargo } from '../types';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { ExternalLinkIcon } from './icons/ExternalLinkIcon';
import { MapPinIcon } from './icons/MapPinIcon'; // Assuming it exists or I'll add it if needed
import { fetchRouteGeometry, getRouteSuggestions } from '../services/routing';
import { LoaderIcon } from './icons/LoaderIcon';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { filesToAttach: { [key: string]: File[] }, bankDetails?: string, loadedTonnage?: number, advancePercentage?: number, tollValue?: number }) => void;
  shipment: Shipment;
  documentName: string;
  currentUser: User;
  cargo?: Cargo;
}

declare const L: any;

const fiscalDocTypes = ['Nota Fiscal', 'CT-e', 'MDF-e', 'Carta Frete', 'Demurrage'];
const allowedDocsForClient = [
    'Ticket de Carregamento',
    'Nota Fiscal',
    'CT-e',
    'Comprovante de Descarga'
];

const FileInput: React.FC<{ label: string; onFileChange: (files: FileList | null) => void; files: File[] }> = ({ label, onFileChange, files }) => {
  const id = `file-upload-${label.replace(/\s/g, '-')}`;
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <label
        htmlFor={id}
        className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-md shadow-sm cursor-pointer hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
      >
        <span>
          {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : `Selecionar arquivo(s)...`}
        </span>
        <PaperclipIcon className="w-4 h-4" />
      </label>
      <input id={id} type="file" className="hidden" multiple onChange={(e) => onFileChange(e.target.files)} accept=".pdf,.png,.jpg,.jpeg,.gif" />
      {files.length > 0 && (
         <ul className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
           {files.map(file => <li key={file.name}>{file.name}</li>)}
         </ul>
      )}
    </div>
  );
};


const AttachmentModal: React.FC<AttachmentModalProps> = ({ isOpen, onClose, onSave, shipment, documentName, currentUser, cargo }) => {
  const [singleFiles, setSingleFiles] = useState<File[]>([]);
  const [multiFiles, setMultiFiles] = useState<{ [key: string]: File[] }>({});
  const [bankDetails, setBankDetails] = useState('');
  const [loadedTonnage, setLoadedTonnage] = useState<number | ''>('');
  const [advancePercentage, setAdvancePercentage] = useState<number | ''>('');
  const [tollValue, setTollValue] = useState<number | ''>('');
  const [route, setRoute] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [error, setError] = useState<string>('');
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routeLayerRef = useRef<any>(null);
  
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSingleFiles([]);
      setMultiFiles({});
      setBankDetails('');
      setLoadedTonnage('');
      setAdvancePercentage('');
      setTollValue('');
      setRoute(shipment.route || '');
      setSuggestions([]);
      setIsLoadingSuggestions(false);
    }
  }, [isOpen, shipment]);

  const earlyStatuses = [
    ShipmentStatus.AguardandoSeguradora,
    ShipmentStatus.PreCadastro,
    ShipmentStatus.AguardandoCarregamento,
    ShipmentStatus.AguardandoNota,
    ShipmentStatus.AguardandoAdiantamento,
    ShipmentStatus.AguardandoAgendamento,
    ShipmentStatus.AguardandoDescarga,
    ShipmentStatus.AguardandoPagamentoSaldo,
    ShipmentStatus.Finalizado
  ];

  const showRouteField = earlyStatuses.includes(shipment.status);

  useEffect(() => {
    if (isOpen && showRouteField && mapContainerRef.current && !mapRef.current) {
        // Initialize map
        const map = L.map(mapContainerRef.current).setView([-15.78, -47.92], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
        mapRef.current = map;

        const drawRoute = async () => {
            if (cargo && cargo.originCoords && cargo.destinationCoords) {
                const origin = [cargo.originCoords.lat, cargo.originCoords.lng];
                const dest = [cargo.destinationCoords.lat, cargo.destinationCoords.lng];

                L.marker(origin, { title: 'Origem' }).addTo(map).bindPopup(`Origem: ${cargo.origin}`);
                L.marker(dest, { title: 'Destino' }).addTo(map).bindPopup(`Destino: ${cargo.destination}`);

                // Try to get actual road geometry
                const roadGeometry = await fetchRouteGeometry(cargo.originCoords, cargo.destinationCoords);
                if (roadGeometry) {
                    if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
                    routeLayerRef.current = L.polyline(roadGeometry.coordinates, { color: '#003399', weight: 5, opacity: 0.8 }).addTo(map);
                    map.fitBounds(routeLayerRef.current.getBounds(), { padding: [30, 30] });
                } else {
                    // Fallback to straight line
                    const line = L.polyline([origin, dest], { color: 'blue', weight: 3, opacity: 0.7, dashArray: '10, 10' }).addTo(map);
                    map.fitBounds(line.getBounds(), { padding: [30, 30] });
                }
            }
        };

        drawRoute();
        
        // Force invalidate size after a delay to ensure it renders correctly in the modal
        setTimeout(() => {
            map.invalidateSize();
        }, 300);
    }

    return () => {
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }
    };
  }, [isOpen, showRouteField, cargo]);

  const handleSuggestRoutes = async () => {
    if (!cargo?.originCoords || !cargo?.destinationCoords) {
        alert("Coordenadas de origem ou destino não disponíveis para gerar sugestões.");
        return;
    }

    setIsLoadingSuggestions(true);
    try {
        const results = await getRouteSuggestions(cargo.originCoords, cargo.destinationCoords);
        if (results && results.length > 0) {
            setSuggestions(results.map(r => r.formatted));
        } else {
            alert("Não foi possível encontrar sugestões de cidades para esta rota.");
        }
    } catch (err) {
        console.error('Error suggesting routes:', err);
    } finally {
        setIsLoadingSuggestions(false);
    }
  };

  const handleSave = () => {
    let filesToAttach: { [key: string]: File[] } = {};
    if (shipment.status === ShipmentStatus.AguardandoNota) {
      // FIX: Property 'length' does not exist on type 'unknown'. Added Array.isArray check.
      const hasFiles = Object.values(multiFiles).some(arr => Array.isArray(arr) && arr.length > 0);
      if (!hasFiles) {
        setError('Anexe pelo menos um documento para avançar.');
        return;
      }
      if (!shipment.bankDetails && !bankDetails) {
        setError('Dados bancários são obrigatórios para avançar.');
        return;
      }
      filesToAttach = multiFiles;
    } else {
      if (singleFiles.length === 0) {
        setError('Por favor, selecione ao menos um arquivo para anexar.');
        return;
      }
      if (shipment.status === ShipmentStatus.AguardandoCarregamento && (!loadedTonnage || loadedTonnage <= 0)) {
        setError('Por favor, informe a tonelagem efetivamente carregada.');
        return;
      }
      if (shipment.status === ShipmentStatus.AguardandoAdiantamento && (!advancePercentage || advancePercentage <= 0)) {
        setError('Por favor, informe a porcentagem do adiantamento recebido pelo motorista.');
        return;
      }
      filesToAttach = { [documentName]: singleFiles };
    }
    
    onSave({ 
      filesToAttach, 
      bankDetails: bankDetails || undefined,
      loadedTonnage: shipment.status === ShipmentStatus.AguardandoCarregamento ? Number(loadedTonnage) : undefined,
      advancePercentage: shipment.status === ShipmentStatus.AguardandoAdiantamento ? Number(advancePercentage) : undefined,
      tollValue: shipment.status === ShipmentStatus.AguardandoAdiantamento ? Number(tollValue || 0) : undefined,
      route: showRouteField ? route : undefined
    });
  };
  
  const handleClose = () => {
      onClose();
  }

  const handleSingleFileChange = (files: FileList | null) => {
    setSingleFiles(files ? Array.from(files) : []);
  }

  const handleMultiFileChange = (docType: string, files: FileList | null) => {
    setMultiFiles(prev => ({
      ...prev,
      [docType]: files ? Array.from(files) : []
    }));
  }

  if (!isOpen) return null;

  const isClientUser = currentUser.profile === UserProfile.Cliente;
  const documentsToShow = isClientUser
    ? Object.entries(shipment.documents || {}).filter(([docType]) => allowedDocsForClient.includes(docType))
    : Object.entries(shipment.documents || {});

  const requiresBankDetails = shipment.status === ShipmentStatus.AguardandoNota && !shipment.bankDetails;

  const creationDocuments = documentsToShow.filter(([docType]) => docType === 'Arquivos Iniciais');
  const statusDocuments = documentsToShow.filter(([docType]) => docType !== 'Arquivos Iniciais');

  const renderDocumentList = (docs: [string, string[]][]) => (
    <ul className="space-y-4">
      {docs.map(([docType, files]) => (
        <li key={docType}>
          <p className="font-medium text-sm text-gray-800 dark:text-gray-200">{docType}:</p>
          <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400">
            {Array.isArray(files) && files.map((file, index) => (
              <li key={index}>
                <a
                  href={file}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline break-words"
                >
                  {file.split('_').pop() || 'Acessar Anexo'}
                </a>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">Gerenciar Anexos</h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Embarque: {shipment.id}</p>
        
        {documentsToShow.length > 0 ? (
          <div className="mb-6 border rounded-md dark:border-gray-600 overflow-hidden">
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 border-b dark:border-gray-600">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Documentos Anexados</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x dark:divide-gray-600">
                <div className="p-4 bg-white dark:bg-gray-800">
                    <h4 className="font-semibold text-gray-600 dark:text-gray-300 mb-4 border-b pb-2">Documentos do Embarque (Troca de Status)</h4>
                    {statusDocuments.length > 0 ? renderDocumentList(statusDocuments as [string, string[]][]) : (
                        <p className="text-sm text-gray-500 italic">Nenhum documento de status.</p>
                    )}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
                    <h4 className="font-semibold text-gray-600 dark:text-gray-300 mb-4 border-b pb-2">Documentos para Cadastro (Na Criação da Ordem)</h4>
                    {creationDocuments.length > 0 ? renderDocumentList(creationDocuments as [string, string[]][]) : (
                         <p className="text-sm text-gray-500 italic">Nenhum documento anexado na criação.</p>
                    )}
                </div>
            </div>
          </div>
        ) : (shipment.documents && Object.keys(shipment.documents).length > 0 && isClientUser) ? (
            <div className="mb-6 p-4 border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum documento disponível para seu perfil de acesso.</p>
            </div>
        ) : null}

        {!isClientUser && (
            <>
                <div className="border-t dark:border-gray-700 pt-4">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Anexar Novos Documentos</h3>
                    {shipment.status === ShipmentStatus.AguardandoNota ? (
                        <div>
                            {fiscalDocTypes.map(docType => (
                            <FileInput
                                key={docType}
                                label={docType}
                                files={multiFiles[docType] || []}
                                onFileChange={(files) => handleMultiFileChange(docType, files)}
                            />
                            ))}
                        </div>
                    ) : shipment.status === ShipmentStatus.AguardandoCarregamento ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                            <FileInput label={documentName} files={singleFiles} onFileChange={handleSingleFileChange} />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Toneladas Carregadas</label>
                                <div className="relative rounded-md shadow-sm">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={loadedTonnage}
                                        onChange={(e) => setLoadedTonnage(e.target.value === '' ? '' : Number(e.target.value))}
                                        placeholder="Ex: 35.5"
                                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 pr-12"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <span className="text-gray-500 sm:text-sm">ton</span>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Recalcula automaticamente o frete do motorista.</p>
                            </div>
                        </div>
                    ) : shipment.status === ShipmentStatus.AguardandoAdiantamento ? (
                        <div className="grid grid-cols-12 gap-4 items-end">
                            {/* Document Upload - Taking up less width (5/12) */}
                            <div className="col-span-12 md:col-span-5">
                                <FileInput label={documentName} files={singleFiles} onFileChange={handleSingleFileChange} />
                            </div>
                            
                            {/* Advance % - (2/12) */}
                            <div className="col-span-6 md:col-span-2 mb-4">
                                <label className="block text-[10px] sm:text-xs font-semibold uppercase text-gray-500 mb-1">Cálculo (%)</label>
                                <div className="relative rounded-md shadow-sm">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={advancePercentage}
                                        onChange={(e) => setAdvancePercentage(e.target.value === '' ? '' : Number(e.target.value))}
                                        placeholder="%"
                                        className="w-full py-2 pl-3 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <span className="text-gray-400 text-sm">%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Toll Value - (2/12) */}
                            <div className="col-span-6 md:col-span-2 mb-4">
                                <label className="block text-[10px] sm:text-xs font-semibold uppercase text-gray-500 mb-1">Pedágio (R$)</label>
                                <div className="relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-gray-400 text-sm">R$</span>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={tollValue}
                                        onChange={(e) => setTollValue(e.target.value === '' ? '' : Number(e.target.value))}
                                        placeholder="0,00"
                                        className="w-full py-2 pl-9 pr-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            
                            {/* Net Advance Result - (3/12) */}
                            <div className="col-span-12 md:col-span-3 mb-4">
                                <div className="p-2 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-md border border-emerald-200 dark:border-emerald-800 flex flex-col items-end">
                                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 mb-1">Adiantamento Líquido</span>
                                    <span className="font-bold text-xl">
                                        {advancePercentage !== '' && Number(advancePercentage) > 0 
                                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(((shipment.driverFreightValue * Number(advancePercentage)) / 100) - Number(tollValue || 0)) 
                                            : 'R$ 0,00'}
                                    </span>
                                </div>
                                {Number(tollValue) > 0 && (
                                    <p className="text-[9px] text-right text-gray-400 mt-1 italic">
                                        (Reflete dedução de R$ {Number(tollValue).toLocaleString('pt-BR')})
                                    </p>
                                )}
                            </div>

                            {/* Row for Route and Map */}
                            {showRouteField && (
                                <div className="col-span-12 mt-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Informar Rota do Motorista</label>
                                                    <button 
                                                        onClick={handleSuggestRoutes}
                                                        disabled={isLoadingSuggestions}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:text-white bg-primary/10 hover:bg-primary rounded-lg transition-all disabled:opacity-50"
                                                    >
                                                        {isLoadingSuggestions ? <LoaderIcon className="w-3 h-3 animate-spin" /> : <MapPinIcon className="w-3 h-3" />}
                                                        Sugerir Rotas
                                                    </button>
                                                </div>
                                                <textarea 
                                                    value={route}
                                                    onChange={(e) => setRoute(e.target.value)}
                                                    placeholder="Ex: Seguir pela BR-050 até Uberlândia, depois BR-365 sentido Patos de Minas..."
                                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all font-mono text-sm"
                                                    rows={4}
                                                />
                                                <p className="text-[11px] text-gray-500 mt-2 italic flex items-center gap-1">
                                                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span> 
                                                    Baseado na rota: <span className="font-bold text-primary">{cargo?.origin} &rarr; {cargo?.destination}</span>
                                                </p>

                                                {suggestions.length > 0 && (
                                                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <h4 className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-2">Sugestões Encontradas (Clique para Usar)</h4>
                                                        <div className="space-y-2">
                                                            {suggestions.map((s, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => setRoute(s)}
                                                                    className="w-full text-left p-2.5 text-xs bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-lg transition-all group"
                                                                >
                                                                    <span className="text-gray-600 dark:text-gray-400 group-hover:text-primary transition-colors">{s}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Visualização do Trajeto</label>
                                                {cargo?.originCoords && (
                                                     <span className="text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full font-bold uppercase">Rodovias Ativas</span>
                                                )}
                                            </div>
                                            <div 
                                                ref={mapContainerRef} 
                                                className="w-full h-[220px] bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-0 shadow-inner"
                                            />
                                            {!cargo?.originCoords && (
                                                <p className="text-[10px] text-yellow-600 dark:text-yellow-500 font-medium">⚠️ Coordenadas indisponíveis para visualizar no mapa.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <FileInput label={documentName} files={singleFiles} onFileChange={handleSingleFileChange} />
                    )}
                </div>
                
                {requiresBankDetails && (
                    <div className="border-t dark:border-gray-700 pt-4 mt-4">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Dados Bancários para Adiantamento</h3>
                        <textarea 
                            value={bankDetails}
                            onChange={(e) => setBankDetails(e.target.value)}
                            placeholder="Banco: 001, Agência: 1234, Conta: 56789-0&#10;Titular: Nome Completo, CPF/CNPJ: 000.000.000-00"
                            className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
                            rows={4}
                        />
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Este campo é obrigatório para avançar para a próxima etapa.</p>
                    </div>
                )}

                {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            </>
        )}

        <div className="mt-8 flex justify-end items-center">
             {isClientUser ? (
                <button type="button" onClick={handleClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
                    Fechar
                </button>
             ) : (
                <div className="flex justify-between items-center w-full">
                    <div>
                        {shipment.status === ShipmentStatus.AguardandoNota && (
                        <button
                            type="button"
                            onClick={() => window.open('https://rodochagas.atua.com.br/adm/sistema.php?_=1505818031#', '_blank', 'noopener,noreferrer')}
                            className="py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                        >
                            <ExternalLinkIcon className="w-4 h-4 mr-2" />
                            Emitir Documentos
                        </button>
                        )}
                    </div>
                    <div className="flex space-x-4">
                        <button type="button" onClick={handleClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
                            Cancelar
                        </button>
                        <button type="button" onClick={handleSave} className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark">
                            Salvar e Avançar
                        </button>
                    </div>
                </div>
             )}
        </div>
      </div>
    </div>
  );
};

export default AttachmentModal;