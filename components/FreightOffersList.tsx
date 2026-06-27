import React, { useState } from 'react';
import type { FreightOffer, Client, Product, Cargo, User } from '../types';
import { FreightOfferStatus, CargoStatus, UserProfile } from '../types';
import { PackageIcon, CheckIcon, XIcon, MessageCircleIcon, HistoryIcon, TrashIcon } from 'lucide-react';
import VolumeBar from './VolumeBar';

interface FreightOffersListProps {
  offers: FreightOffer[];
  clients: Client[];
  products: Product[];
  cargos?: Cargo[];
  isClientProfile: boolean;
  currentUser?: User;
  onAccept: (offer: FreightOffer) => void;
  onRefuse: (offer: FreightOffer) => void;
  onCounterOffer: (offer: FreightOffer, newValue: number) => void;
  onDelete?: (offer: FreightOffer) => void;
}

const FreightOffersList: React.FC<FreightOffersListProps> = ({
  offers, clients, products, cargos, isClientProfile, currentUser, onAccept, onRefuse, onCounterOffer, onDelete
}) => {
  const [counterOfferModal, setCounterOfferModal] = useState<FreightOffer | null>(null);
  const [counterValue, setCounterValue] = useState<string>('');
  const [historyModal, setHistoryModal] = useState<FreightOffer | null>(null);

  if (offers.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">Nenhuma oferta de frete no momento.</p>
      </div>
    );
  }

  const getClientName = (id: string) => clients.find(c => c.id === id)?.nomeFantasia || 'Cliente Desconhecido';
  const getProductName = (id: string) => products.find(p => p.id === id)?.name || 'Produto Desconhecido';

  const getStatusColor = (status: FreightOfferStatus) => {
    switch (status) {
      case FreightOfferStatus.Pendente: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case FreightOfferStatus.Aceita: return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case FreightOfferStatus.Recusada: return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case FreightOfferStatus.Contraproposta: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case FreightOfferStatus.ContrapropostaAceita: return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const handleCounterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (counterOfferModal && counterValue) {
      onCounterOffer(counterOfferModal, Number(counterValue));
      setCounterOfferModal(null);
      setCounterValue('');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center gap-2">
        <PackageIcon className="w-5 h-5 text-indigo-500" />
        <h3 className="font-semibold text-gray-800 dark:text-white">
          {isClientProfile ? 'Minhas Ofertas de Frete' : 'Ofertas de Frete Pendentes'}
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
            <tr>
              {!isClientProfile && <th className="px-4 py-3 font-medium">Cliente</th>}
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 font-medium">Destino</th>
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium">Total (Ton)</th>
              <th className="px-4 py-3 font-medium">Valor (R$/Ton)</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {offers.map(offer => {
              const matchedCargo = offer.status === FreightOfferStatus.Aceita && cargos
                ? cargos.find(c => 
                    c.clientId === offer.clientId && 
                    c.productId === offer.productId && 
                    c.origin === offer.origin && 
                    c.destination === offer.destination && 
                    c.status === CargoStatus.EmAndamento
                  )
                : null;
              const scheduledButNotLoaded = matchedCargo ? Math.max(0, matchedCargo.scheduledVolume - matchedCargo.loadedVolume) : 0;

              return (
              <tr key={offer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                {!isClientProfile && (
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {getClientName(offer.clientId)}
                  </td>
                )}
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {offer.origin}
                  {offer.originLocation && <div className="text-xs text-gray-400">{offer.originLocation}</div>}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {offer.destination}
                  {offer.destinationLocation && <div className="text-xs text-gray-400">{offer.destinationLocation}</div>}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{getProductName(offer.productId)}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {matchedCargo ? (
                    <div className="w-32 space-y-1">
                      <div className="flex justify-between items-start text-[10px] font-bold text-gray-500 uppercase">
                        <span>Progresso</span>
                        <div className="text-right">
                          <div className="text-gray-700 dark:text-gray-300">{matchedCargo.loadedVolume} / {matchedCargo.totalVolume}</div>
                        </div>
                      </div>
                      <VolumeBar
                        loaded={matchedCargo.loadedVolume}
                        scheduled={scheduledButNotLoaded}
                        total={matchedCargo.totalVolume}
                      />
                    </div>
                  ) : (
                    offer.totalTonnage
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {matchedCargo ? (
                    <div>R$ {(offer.counterOfferValue || offer.freightValuePerTon).toFixed(2)}</div>
                  ) : (
                    <>
                      <div>R$ {offer.freightValuePerTon.toFixed(2)}</div>
                      {offer.counterOfferValue && (
                        <div className="text-xs text-blue-500 font-medium mt-0.5">
                          Contraproposta: R$ {offer.counterOfferValue.toFixed(2)}
                        </div>
                      )}
                    </>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-center ${getStatusColor(offer.status)}`}>
                    {isClientProfile && matchedCargo
                      ? 'Carga em andamento'
                      : isClientProfile && offer.status === FreightOfferStatus.ContrapropostaAceita
                        ? 'Aceita'
                        : offer.status === FreightOfferStatus.Pendente && isClientProfile
                          ? 'Oferta enviada, aguardando resposta'
                          : offer.status === FreightOfferStatus.Contraproposta && !isClientProfile
                            ? 'Contraproposta enviada, aguardando aprovação'
                            : offer.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Ações da Transportadora */}
                    {!isClientProfile && (offer.status === FreightOfferStatus.Pendente || offer.status === FreightOfferStatus.ContrapropostaAceita) && (
                      <>
                        <button onClick={() => onAccept(offer)} title="Aceitar Oferta" className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        {offer.status === FreightOfferStatus.Pendente && (
                          <button onClick={() => setCounterOfferModal(offer)} title="Fazer Contraproposta" className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                            <MessageCircleIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => onRefuse(offer)} title="Recusar Oferta" className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                          <XIcon className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {/* Ações do Cliente na Contraproposta */}
                    {isClientProfile && offer.status === FreightOfferStatus.Contraproposta && (
                      <>
                        <button onClick={() => onAccept(offer)} title="Aceitar Contraproposta" className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => onRefuse(offer)} title="Recusar Contraproposta" className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                          <XIcon className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {/* Botão de Histórico */}
                    <button onClick={() => setHistoryModal(offer)} title="Ver Histórico" className="p-1.5 text-gray-600 bg-gray-50 hover:bg-gray-200 rounded-lg transition-colors">
                      <HistoryIcon className="w-4 h-4" />
                    </button>
                    {/* Botão de Excluir (Apenas Admin) */}
                    {onDelete && currentUser?.profile === UserProfile.Admin && (
                      <button onClick={() => onDelete(offer)} title="Excluir Oferta" className="p-1.5 text-red-600 bg-red-50 hover:bg-red-200 rounded-lg transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {counterOfferModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-5">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Fazer Contraproposta</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Informe o novo valor por tonelada que deseja propor ao cliente {getClientName(counterOfferModal.clientId)}.
              </p>
              <form onSubmit={handleCounterSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Novo Valor (R$/Ton)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={counterValue}
                    onChange={(e) => setCounterValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder={`Atual: R$ ${counterOfferModal.freightValuePerTon.toFixed(2)}`}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setCounterOfferModal(null)} className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
                    Enviar Contraproposta
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {historyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <HistoryIcon className="w-5 h-5 text-indigo-500" />
                Histórico da Negociação
              </h3>
              <button onClick={() => setHistoryModal(null)} className="p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {historyModal.history && historyModal.history.length > 0 ? (
                <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 dark:before:via-gray-600 before:to-transparent">
                  {historyModal.history.map((log, i) => (
                    <div key={log.id || i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-4 last:mb-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white dark:border-gray-800 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                        <HistoryIcon className="w-4 h-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                        <div className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-1">{log.description}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                           {new Date(log.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Nenhum histórico disponível para esta oferta.</p>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
              <button onClick={() => setHistoryModal(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreightOffersList;
