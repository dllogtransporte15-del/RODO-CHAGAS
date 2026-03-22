
import React, { useState, useEffect } from 'react';
import { Shipment, ShipmentStatus, User, UserProfile } from '../types';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { ExternalLinkIcon } from './icons/ExternalLinkIcon';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { filesToAttach: { [key: string]: File[] }, bankDetails?: string }) => void;
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
  const [error, setError] = useState<string>('');
  
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSingleFiles([]);
      setMultiFiles({});
      setBankDetails('');
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
      filesToAttach = { [documentName]: singleFiles };
    }
    
    onSave({ filesToAttach, bankDetails: bankDetails || undefined });
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">Gerenciar Anexos</h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Embarque: {shipment.id}</p>
        
        {documentsToShow.length > 0 ? (
          <div className="mb-6 p-4 border rounded-md dark:border-gray-600">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Documentos Anexados</h3>
            <ul className="space-y-2">
              {documentsToShow.map(([docType, files]) => (
                <li key={docType}>
                  <p className="font-medium text-sm text-gray-800 dark:text-gray-200">{docType}:</p>
                  <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-400">
                    {Array.isArray(files) && files.map((file, index) => (
                      <li key={index}>
                        <a
                          href={file}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                        >
                          {file.split('_').pop() || 'Acessar Anexo'}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
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