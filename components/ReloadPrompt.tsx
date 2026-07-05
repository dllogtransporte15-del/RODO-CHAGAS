import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: any) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error: any) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-lg shadow-xl border border-gray-100 p-4 max-w-sm flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">
              {offlineReady ? 'App pronto para uso offline' : 'Nova atualização disponível'}
            </h3>
            <p className="text-gray-500 text-xs mt-1">
              {offlineReady
                ? 'O aplicativo foi baixado e agora pode ser acessado sem internet.'
                : 'Uma nova versão do aplicativo está disponível. Atualize para receber as últimas melhorias.'}
            </p>
          </div>
          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-600 transition-colors ml-4"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>
        
        <div className="flex gap-2 justify-end mt-1">
          <button
            onClick={close}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            Fechar
          </button>
          {needRefresh && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              <RefreshCw size={14} />
              Atualizar Agora
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
