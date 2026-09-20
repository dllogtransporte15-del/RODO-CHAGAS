import React, { useState, useEffect } from 'react';
import { Download, Smartphone, CheckCircle2, ArrowLeft, ShieldCheck, Zap, Sparkles } from 'lucide-react';

interface DownloadAppPageProps {
  companyLogo: string | null;
}

const DownloadAppPage: React.FC<DownloadAppPageProps> = ({ companyLogo }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

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
      alert("Para instalar neste dispositivo, use a opção 'Adicionar à Tela Inicial' no menu do seu navegador (ícone de compartilhar no Safari ou três pontos no Chrome).");
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#142B6A] to-[#0A1128] px-4 py-12 text-white relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#F16421]/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#1D3B8D]/30 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

      <div className="max-w-lg w-full bg-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden text-center p-8 sm:p-10 relative z-10">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-orange-400 mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-[#F16421]" />
          <span>Aplicativo Oficial Rodochagas</span>
        </div>

        {companyLogo ? (
          <img src={companyLogo} alt="Logo Rodochagas" className="h-28 max-h-36 mx-auto mb-6 object-contain" />
        ) : (
          <div className="h-24 w-24 bg-gradient-to-tr from-[#1D3B8D] to-[#F16421] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/20 border border-white/20">
            <Smartphone className="w-12 h-12 text-white" />
          </div>
        )}
        
        <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
          Baixar APP Rodochagas
        </h1>
        
        <p className="text-sm text-slate-300 mb-8 leading-relaxed">
          Instale o aplicativo no seu celular ou computador para acesso instantâneo às suas cargas, notificações em tempo real e agilidade no embarque.
        </p>
        
        {isInstalled ? (
          <div className="bg-emerald-950/60 text-emerald-300 p-4 rounded-2xl font-bold border border-emerald-500/40 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>O aplicativo já está instalado neste dispositivo!</span>
          </div>
        ) : (
          <div className="space-y-6">
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#1D3B8D] via-[#142B6A] to-[#F16421] hover:brightness-110 active:scale-98 text-white text-base sm:text-lg font-bold py-4 px-8 rounded-2xl shadow-xl shadow-orange-500/20 transition-all cursor-pointer border border-white/20"
            >
              <Download className="w-6 h-6" />
              <span>Instalar Aplicativo Agora</span>
            </button>
            
            <div className="text-xs text-slate-400 bg-slate-800/60 p-5 rounded-2xl border border-white/10 text-left space-y-3">
              <p className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#F16421]" />
                Instruções de Instalação:
              </p>
              <ul className="space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#F16421]">•</span>
                  <span><strong>Android (Chrome):</strong> Toque no botão acima ou no menu de 3 pontos (⋮) e selecione <em>"Adicionar à tela inicial"</em> ou <em>"Instalar aplicativo"</em>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#F16421]">•</span>
                  <span><strong>iPhone/iPad (Safari):</strong> Toque no ícone de Compartilhar (quadrado com seta para cima) e selecione <em>"Adicionar à Tela de Início"</em>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#F16421]">•</span>
                  <span><strong>Computador (Chrome/Edge):</strong> Clique no ícone de instalar na barra de endereços ao lado da estrela de favoritos.</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-white/10">
          <a 
            href="/" 
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para a tela de login</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default DownloadAppPage;
