
import React from 'react';
import Header from '../components/Header';
import ImageUploader from '../components/ImageUploader';
import { Moon, Sun, CheckCircle2, Sparkles } from 'lucide-react';

interface AppearancePageProps {
  currentLogo: string | null;
  onSaveLogo: (logoBase64: string) => void;
  currentTheme: string | null;
  onSaveTheme: (themeBase64: string) => void;
  themeMode?: 'dark' | 'light';
  onSaveThemeMode?: (mode: 'dark' | 'light') => void;
}

const AppearancePage: React.FC<AppearancePageProps> = ({ 
  currentLogo, 
  onSaveLogo, 
  currentTheme, 
  onSaveTheme,
  themeMode = 'dark',
  onSaveThemeMode
}) => {
  return (
    <>
      <Header title="Gestão de Aparência" />
      
      <div className="space-y-8 max-w-4xl">
        {/* Escolha do Modo de Fundo (Escuro / Claro) */}
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/10 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1D3B8D] via-[#F16421] to-[#1D3B8D]" />

          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Experiência Visual
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">Estilo de Fundo do Sistema</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Escolha entre a experiência de alto contraste escuro com brilho ambiental (idêntico à tela de login) ou o modo claro.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Opção Fundo Escuro */}
            <button
              type="button"
              onClick={() => onSaveThemeMode && onSaveThemeMode('dark')}
              className={`relative p-5 rounded-2xl border text-left transition-all duration-200 group ${
                themeMode === 'dark'
                  ? 'bg-gradient-to-br from-slate-900 to-[#0A1128] border-blue-500 ring-2 ring-blue-500/30 shadow-xl shadow-blue-900/30'
                  : 'bg-black/30 border-white/10 hover:border-white/20 hover:bg-black/40'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Moon className="w-6 h-6" />
                </div>
                {themeMode === 'dark' && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ativo
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white mb-1">Fundo Escuro (Padrão)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Design moderno com tom profundo `#0A1128`, painéis em glassmorphism e iluminação dinâmica azul e laranja.
              </p>
            </button>

            {/* Opção Fundo Claro */}
            <button
              type="button"
              onClick={() => onSaveThemeMode && onSaveThemeMode('light')}
              className={`relative p-5 rounded-2xl border text-left transition-all duration-200 group ${
                themeMode === 'light'
                  ? 'bg-gradient-to-br from-slate-100 to-white text-slate-900 border-[#F16421] ring-2 ring-orange-500/30 shadow-xl shadow-orange-900/20'
                  : 'bg-black/30 border-white/10 hover:border-white/20 hover:bg-black/40'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-3 rounded-xl border ${themeMode === 'light' ? 'bg-orange-500/20 text-[#F16421] border-orange-500/30' : 'bg-white/10 text-amber-400 border-white/10'}`}>
                  <Sun className="w-6 h-6" />
                </div>
                {themeMode === 'light' && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ativo
                  </span>
                )}
              </div>
              <h3 className={`text-base font-bold mb-1 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Fundo Claro
              </h3>
              <p className={`text-xs leading-relaxed ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                Ambiente clean e luminoso com fundo cinza-claro `#F8FAFC`, cartões brancos e contraste suave.
              </p>
            </button>
          </div>
        </div>

        <ImageUploader
          title="Logo da Empresa"
          description="Faça o upload do logo que será exibido na barra superior e na tela de login (limite de 2MB)."
          currentImage={currentLogo}
          onSave={onSaveLogo}
          onRemove={() => onSaveLogo('')}
        />
        
        <ImageUploader
          title="Tema de Fundo Personalizado"
          description="Imagem de fundo personalizada para o sistema. Será aplicada como plano de fundo (limite de 5MB)."
          currentImage={currentTheme}
          onSave={onSaveTheme}
          onRemove={() => onSaveTheme('')}
          maxSizeMB={5}
        />
      </div>
    </>
  );
};

export default AppearancePage;