
import React, { useState, useEffect } from 'react';
import { Shipment, ShipmentStatus, User, UserProfile } from '../types';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { ExternalLinkIcon } from './icons/ExternalLinkIcon';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { filesToAttach: { [key: string]: File[] }, bankDetails?: string, loadedTonnage?: number, advancePercentage?: number }) => void;
  shipment: Shipment;
  documentName: string;
  currentUser: User;
}

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


const AttachmentModal: React.FC<AttachmentModalProps> = ({ isOpen, onClose, onSave, shipment, documentName, currentUser }) => {
  const [singleFiles, setSingleFiles] = useState<File[]>([]);
  const [multiFiles, setMultiFiles] = useState<{ [key: string]: File[] }>({});
  const [bankDetails, setBankDetails] = useState('');
  const [loadedTonnage, setLoadedTonnage] = useState<number | ''>('');
  const [advancePercentage, setAdvancePercentage] = useState<number | ''>('');
  const [error, setError] = useState<string>('');
  
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSingleFiles([]);
      setMultiFiles({});
      setBankDetails('');
      setLoadedTonnage('');
      setAdvancePercentage('');
    }
  }, [isOpen]);

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
      advancePercentage: shipment.status === ShipmentStatus.AguardandoAdiantamento ? Number(advancePercentage) : undefined
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                            <FileInput label={documentName} files={singleFiles} onFileChange={handleSingleFileChange} />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">% de Adiantamento</label>
                                <div className="flex gap-4 items-center">
                                    <div className="relative rounded-md shadow-sm w-1/3">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={advancePercentage}
                                            onChange={(e) => setAdvancePercentage(e.target.value === '' ? '' : Number(e.target.value))}
                                            placeholder="Ex: 80"
                                            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 pr-8"
                                        />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <span className="text-gray-500 sm:text-sm">%</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 p-2 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-md border border-green-200 dark:border-green-800 flex items-center justify-between">
                                        <span className="text-xs uppercase font-semibold mr-2">Valor Adiant.</span>
                                        <span className="font-bold whitespace-nowrap">
                                            {advancePercentage !== '' && advancePercentage > 0 
                                                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((shipment.driverFreightValue * Number(advancePercentage)) / 100) 
                                                : 'R$ 0,00'}
                                        </span>
                                    </div>
                                </div>
                            </div>
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