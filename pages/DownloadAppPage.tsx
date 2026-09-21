import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Download, Smartphone, CheckCircle2, ArrowLeft, ShieldCheck, Zap, Sparkles, Monitor, Apple, Globe } from 'lucide-react';

interface DownloadAppPageProps {
  companyLogo: string | null;
}

const DownloadAppPage: React.FC<DownloadAppPageProps> = ({ companyLogo }) => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>('android');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("Para instalar neste dispositivo, siga as instruções abaixo conforme o seu sistema (Android, iPhone ou Computador).");
      return;
    }
    
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#142B6A] to-[#0A1128] px-4 py-8 sm:py-12 text-white relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#F16421]/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#1D3B8D]/30 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

      <div className="max-w-xl w-full bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden text-center p-6 sm:p-8 relative z-10">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-orange-400 mb-5 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-[#F16421]" />
          <span>Aplicativo Oficial Rodochagas</span>
        </div>

        {companyLogo ? (
          <img src={companyLogo} alt="Logo Rodochagas" className="h-24 sm:h-28 max-h-32 mx-auto mb-4 object-contain" />
        ) : (
          <div className="h-20 w-20 bg-gradient-to-tr from-[#1D3B8D] to-[#F16421] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20 border border-white/20">
            <Smartphone className="w-10 h-10 text-white" />
          </div>
        )}
        
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
          Instalar APP Rodochagas
        </h1>
        
        <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
          Instale o aplicativo no seu smartphone ou computador para acesso rápido às suas cargas, notificações e comprovantes sem precisar de loja de apps.
        </p>
        
        {isInstalled ? (
          <div className="bg-emerald-950/60 text-emerald-300 p-4 rounded-2xl font-bold border border-emerald-500/40 flex items-center justify-center gap-2 mb-6">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>O aplicativo já está instalado neste dispositivo!</span>
          </div>
        ) : (
          <div className="space-y-5">
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#1D3B8D] via-[#142B6A] to-[#F16421] hover:brightness-110 active:scale-98 text-white text-base sm:text-lg font-bold py-3.5 px-6 rounded-2xl shadow-xl shadow-orange-500/20 transition-all cursor-pointer border border-white/20"
            >
              <Download className="w-5 h-5" />
              <span>Instalar Aplicativo Agora</span>
            </button>
            
            {/* Platform Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-white/5 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'android' ? 'bg-[#F16421] text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ios')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'ios' ? 'bg-[#1D3B8D] text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Apple className="w-3.5 h-3.5" />
                <span>iPhone / iPad</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('desktop')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'desktop' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Computador</span>
              </button>
            </div>

            {/* Tab Instruction Content */}
            <div className="text-xs text-slate-300 bg-slate-800/70 p-4 sm:p-5 rounded-2xl border border-white/10 text-left space-y-2.5">
              {activeTab === 'android' && (
                <div>
                  <p className="font-bold text-white text-sm flex items-center gap-2 mb-2">
                    <Smartphone className="w-4 h-4 text-[#F16421]" />
                    Como instalar no Android (Google Chrome):
                  </p>
                  <ol className="list-decimal pl-5 space-y-1.5 text-slate-300 leading-relaxed">
                    <li>Toque no botão <strong>"Instalar Aplicativo Agora"</strong> acima.</li>
                    <li>Se não abrir automaticamente, toque nos <strong>3 pontinhos (⋮)</strong> no canto superior direito do navegador.</li>
                    <li>Selecione <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar aplicativo"</strong>.</li>
                    <li>Confirme a instalação e o ícone aparecerá na sua tela inicial!</li>
                  </ol>
                </div>
              )}

              {activeTab === 'ios' && (
                <div>
                  <p className="font-bold text-white text-sm flex items-center gap-2 mb-2">
                    <Apple className="w-4 h-4 text-blue-400" />
                    Como instalar no iPhone / iPad (Safari):
                  </p>
                  <ol className="list-decimal pl-5 space-y-1.5 text-slate-300 leading-relaxed">
                    <li>Abra este site pelo navegador oficial <strong>Safari</strong> da Apple.</li>
                    <li>Toque no ícone de <strong>Compartilhar</strong> (quadrado com uma seta apontando para cima) no rodapé da tela.</li>
                    <li>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.</li>
                    <li>Toque em <strong>"Adicionar"</strong> no canto superior direito.</li>
                  </ol>
                </div>
              )}

              {activeTab === 'desktop' && (
                <div>
                  <p className="font-bold text-white text-sm flex items-center gap-2 mb-2">
                    <Monitor className="w-4 h-4 text-emerald-400" />
                    Como instalar no Computador (Chrome / Edge):
                  </p>
                  <ol className="list-decimal pl-5 space-y-1.5 text-slate-300 leading-relaxed">
                    <li>Clique no botão <strong>"Instalar Aplicativo Agora"</strong> acima.</li>
                    <li>Ou clique no ícone de <strong>instalação de aplicativo</strong> (computador com seta para baixo) na barra de endereços do navegador (ao lado da estrela de favoritos).</li>
                    <li>Clique em <strong>"Instalar"</strong>. Um atalho será criado no seu desktop!</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-400 hover:text-white transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para o Login</span>
          </Link>

          <span className="text-[11px] text-slate-500">
            Rodochagas PWA v2.5
          </span>
        </div>
      </div>
    </div>
  );
};

export default DownloadAppPage;
