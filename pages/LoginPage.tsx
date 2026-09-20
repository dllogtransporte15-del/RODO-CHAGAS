import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { User, UserProfile } from '../types';
import type { ProfilePermissions } from '../types';
import {
  Truck,
  Building2,
  ShieldCheck,
  Lock,
  Mail,
  UserCheck,
  Eye,
  EyeOff,
  Smartphone,
  Download,
  CheckCircle2,
  ArrowRight,
  Clock,
  Activity,
  Sparkles,
  HelpCircle,
  X
} from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: User) => void;
  users: User[];
  companyLogo: string | null;
  profilePermissions?: ProfilePermissions;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, companyLogo, profilePermissions }) => {
  const [loginType, setLoginType] = useState<'interno' | 'motorista'>('interno');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cpf, setCpf] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    if (profilePermissions?.system_settings?.driver_portal_enabled === false) {
      setLoginType('interno');
    }
  }, [profilePermissions]);

  useEffect(() => {
    const isPwaEnabled = profilePermissions?.system_settings?.pwa_enabled !== false;
    if (!isPwaEnabled) return;

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [profilePermissions]);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 9) {
      value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (value.length > 6) {
      value = value.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
    } else if (value.length > 3) {
      value = value.replace(/(\d{3})(\d{3})/, '$1.$2');
    }
    setCpf(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (loginType === 'motorista') {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(() => {}, () => {});
      }

      if (deferredPrompt) {
        try {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult: any) => {
            if (choiceResult.outcome === 'accepted') {
              setDeferredPrompt(null);
            }
          });
        } catch (err) {
          console.error('Erro ao chamar prompt PWA:', err);
        }
      }
    }

    setError('');
    setIsLoading(true);

    try {
      await supabase.auth.signOut();

      if (loginType === 'motorista') {
        const cleanCpf = cpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
          setError('CPF inválido. Digite os 11 números do documento.');
          setIsLoading(false);
          return;
        }

        const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

        // Busca o motorista na tabela drivers
        let { data: driverData } = await supabase
          .from('drivers')
          .select('*')
          .eq('cpf', formattedCpf)
          .maybeSingle();

        if (!driverData) {
          const { data: dbDriverClean } = await supabase
            .from('drivers')
            .select('*')
            .eq('cpf', cleanCpf)
            .maybeSingle();
          driverData = dbDriverClean;
        }

        if (!driverData) {
          setError('Motorista não cadastrado no sistema. Verifique o CPF informado.');
          setIsLoading(false);
          return;
        }

        if (!driverData.active) {
          setError('Cadastro de motorista inativo. Contate o suporte operacional.');
          setIsLoading(false);
          return;
        }

        // Verifica senha em app_users
        const { data: appUser } = await supabase
          .from('app_users')
          .select('password, require_password_change')
          .eq('id', driverData.id)
          .maybeSingle();

        let isFirstSetup = false;
        let requirePasswordChange = false;

        if (appUser) {
          if (!password) {
            setError('Senha obrigatória para acessar.');
            setIsLoading(false);
            return;
          }
          if (appUser.password !== password) {
            setError('Senha incorreta. Tente novamente.');
            setIsLoading(false);
            return;
          }
          requirePasswordChange = appUser.require_password_change;
        } else {
          isFirstSetup = true;
          requirePasswordChange = true;
        }

        const userProfile: User = {
          id: driverData.id,
          name: driverData.name,
          email: driverData.cpf,
          profile: UserProfile.Motorista,
          active: driverData.active,
          requirePasswordChange,
          isFirstSetup
        };

        onLogin(userProfile);
      } else {
        const cleanEmail = email.trim().toLowerCase();
        const cleanPassword = password.trim();

        const { data: dbUser, error: dbError } = await supabase
          .from('app_users')
          .select('*')
          .eq('email', cleanEmail)
          .eq('password', cleanPassword)
          .single();

        if (dbError || !dbUser) {
          setError('Email ou senha incorretos.');
          setIsLoading(false);
          return;
        }

        const userProfile: User = {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          profile: dbUser.profile,
          active: dbUser.active,
          password: dbUser.password,
          clientId: dbUser.client_id,
          requirePasswordChange: dbUser.require_password_change,
          authId: dbUser.auth_id
        };

        if (!userProfile.active) {
          setError('Este usuário está inativo no momento.');
          setIsLoading(false);
          return;
        }

        onLogin(userProfile);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Ocorreu um erro de conexão ao tentar entrar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex bg-[#0A1128] text-white overflow-x-hidden font-sans selection:bg-[#F16421] selection:text-white">
      {/* Dynamic Background Glows & Grid Pattern */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[25%] -left-[10%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-[#1D3B8D]/40 to-[#0A1128] blur-3xl animate-pulse-glow" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#F16421]/20 to-transparent blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[140px] rounded-full" />
        <div className="absolute inset-0 hero-grid-pattern opacity-60" />
      </div>

      {/* Main Container - Split View on Desktop */}
      <div className="relative z-10 w-full min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto">
        
        {/* Content Body - Split View (Left: Centered Logo + Auth Card, Right: Top Status + Hero Info) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 items-start justify-items-center gap-8 lg:gap-12 xl:gap-16 pt-1 sm:pt-2 w-full">
          
          {/* LEFT COLUMN: Logo Centered with Auth Portal Card */}
          <div className="w-full max-w-[460px] flex flex-col items-center justify-center mx-auto">
            
            {/* Logo Centralizado Diretamente com o Card */}
            <div className="w-full mb-3 flex justify-center items-center text-center">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt="Logo RODO-CHAGAS"
                  className="h-24 sm:h-28 md:h-32 w-auto object-contain filter drop-shadow-[0_8px_24px_rgba(241,100,33,0.4)] transition-all duration-300 mx-auto"
                />
              ) : (
                <div className="flex items-center justify-center gap-3 mx-auto">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#1D3B8D] to-[#F16421] flex items-center justify-center shadow-xl shadow-orange-500/25 border border-white/20">
                    <Truck className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <span className="text-3xl font-black tracking-tight text-white">RODO</span>
                    <span className="text-3xl font-black tracking-tight text-[#F16421]">CHAGAS</span>
                  </div>
                </div>
              )}
            </div>

            {/* Card Portal de Acesso */}
            <div className="w-full bg-slate-900/90 backdrop-blur-2xl rounded-3xl p-5 sm:p-6 border border-white/15 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] relative overflow-hidden">
              
              {/* Top Accent Gradient Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1D3B8D] via-[#F16421] to-[#1D3B8D]" />

              {/* Card Header */}
              <div className="text-center mb-3.5">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Portal de Acesso
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {loginType === 'interno'
                    ? 'Entre com suas credenciais corporativas'
                    : 'Acesse suas cargas e viagens com seu CPF'}
                </p>
              </div>

              {/* Segmented Tab Controls */}
              {profilePermissions?.system_settings?.driver_portal_enabled !== false && (
                <div className="grid grid-cols-2 p-1 bg-black/40 rounded-xl border border-white/10 mb-3.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginType('interno');
                      setError('');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                      loginType === 'interno'
                        ? 'bg-gradient-to-r from-[#1D3B8D] to-[#162D6B] text-white shadow-md shadow-blue-900/40 border border-blue-400/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Acesso Interno</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginType('motorista');
                      setError('');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                      loginType === 'motorista'
                        ? 'bg-gradient-to-r from-[#F16421] to-[#D1541C] text-white shadow-md shadow-orange-900/40 border border-orange-400/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Sou Motorista</span>
                  </button>
                </div>
              )}

              {/* Login Form com espaçamento 50% reduzido */}
              <form onSubmit={handleSubmit} className="space-y-2">
                {loginType === 'interno' ? (
                  <>
                    {/* Email Field */}
                    <div className="space-y-0.5">
                      <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                        E-mail Corporativo
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-400 transition-colors">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="email-address"
                          name="email"
                          type="email"
                          required
                          disabled={isLoading}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="seu.email@rodochagas.com.br"
                          className="w-full pl-9 pr-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* Password Field */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                          Senha
                        </label>
                      </div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-400 transition-colors">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          disabled={isLoading}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Digite sua senha de acesso"
                          className="w-full pl-9 pr-10 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Motorista CPF Field */}
                    <div className="space-y-0.5">
                      <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                        CPF do Motorista
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-400 transition-colors">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <input
                          id="cpf-motorista"
                          name="cpf"
                          type="text"
                          required
                          disabled={isLoading}
                          value={cpf}
                          onChange={handleCpfChange}
                          placeholder="000.000.000-00"
                          maxLength={14}
                          className="w-full pl-9 pr-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-center sm:text-left text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* Motorista Password Field */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                          Senha
                        </label>
                        <span className="text-[10px] text-orange-400/90 font-medium">
                          (Opcional no 1º acesso)
                        </span>
                      </div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-orange-400 transition-colors">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="password-motorista"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          disabled={isLoading}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Deixe em branco no 1º acesso"
                          className="w-full pl-9 pr-10 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Helper Callout for Driver */}
                    <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl flex items-start gap-2 text-[11px] text-slate-300">
                      <HelpCircle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <span>No primeiro acesso, digite apenas seu <strong>CPF</strong> e clique em <strong>Acessar</strong> para cadastrar sua senha.</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Error Alert */}
                {error && (
                  <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-2 animate-fadeIn">
                    <X className="w-3.5 h-3.5 shrink-0 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit CTA Button */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full group relative flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-xl transition-all duration-200 transform active:scale-[0.98] ${
                      isLoading
                        ? 'bg-slate-700 cursor-not-allowed opacity-75'
                        : loginType === 'interno'
                        ? 'bg-gradient-to-r from-[#1D3B8D] via-[#244cb3] to-[#1D3B8D] hover:shadow-blue-500/25 hover:-translate-y-0.5 border border-blue-400/30'
                        : 'bg-gradient-to-r from-[#F16421] via-[#fa793b] to-[#F16421] hover:shadow-orange-500/25 hover:-translate-y-0.5 border border-orange-400/30'
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        VALIDANDO ACESSO...
                      </span>
                    ) : (
                      <>
                        <span>{loginType === 'interno' ? 'ENTRAR NO SISTEMA' : 'ACESSAR MINHAS CARGAS'}</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Quick Actions & PWA Driver Button */}
              {loginType === 'motorista' && (
                <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2">
                  <button
                    type="button"
                    onClick={handleInstallApp}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#F16421]/20 to-[#1D3B8D]/30 hover:from-[#F16421]/30 hover:to-[#1D3B8D]/45 border border-orange-500/40 text-xs font-bold text-white transition-all shadow-md shadow-orange-500/10"
                  >
                    <Smartphone className="w-4 h-4 text-[#F16421]" />
                    <span>Baixar APP Rodochagas no Celular</span>
                  </button>
                </div>
              )}

              {/* Baixar APP Highlight & Support */}
              <div className="mt-3.5 pt-3 border-t border-white/10 flex flex-col gap-2">
                <a
                  href="/baixar-app"
                  className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-500/15 via-[#1D3B8D]/20 to-orange-500/15 hover:from-orange-500/25 hover:to-[#F16421]/25 border border-orange-500/35 hover:border-orange-400 text-white font-bold text-xs shadow-md shadow-orange-500/10 transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-[#F16421]/20 border border-orange-400/40 flex items-center justify-center text-[#F16421] group-hover:scale-110 transition-transform shrink-0">
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left">
                      <span className="block text-xs font-bold text-white group-hover:text-[#F16421] transition-colors">
                        Baixar APP
                      </span>
                      <span className="block text-[10px] font-normal text-slate-400">
                        Celular & Computador
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-md bg-[#F16421] text-white tracking-wider shadow-xs">
                    Instalar
                  </span>
                </a>

                <div className="text-center mt-1">
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="hover:text-slate-300 text-slate-400 transition-colors text-[11px] underline"
                  >
                    Precisa de ajuda?
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Brand Hero & Value Proposition */}
          <div className="w-full max-w-2xl flex flex-col justify-between">
            
            {/* System Status Pill at Top Right */}
            <div className="hidden sm:flex items-center justify-end w-full mb-6 lg:mb-8">
              <div className="flex items-center px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md" title="Sistema Online">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
            </div>

            {/* Hero Content */}
            <div className="py-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-orange-500/20 to-blue-500/20 border border-orange-500/30 text-[#F16421] text-xs font-bold uppercase tracking-wider mb-5 backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5" />
                Logística Inteligente & Gestão de Cargas
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-white tracking-tight leading-[1.15] mb-5">
                Eficiência, controle e <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-[#F16421]">
                  pontualidade na estrada.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
                A plataforma definitiva para transportadores, embarcadores e motoristas. Acompanhe fretes, pedidos, emissões e rotas com transparência em tempo real.
              </p>

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <div className="glass-card-hero p-3.5 rounded-2xl border border-white/10 flex items-start gap-3 transition-all hover:bg-white/10 hover:border-white/20">
                  <div className="p-2 rounded-xl bg-[#1D3B8D]/40 text-blue-400 border border-blue-400/20">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white mb-0.5">Operações ao Vivo</h2>
                    <p className="text-xs text-slate-400">Controle completo de status e carregamento em tempo real.</p>
                  </div>
                </div>

                <div className="glass-card-hero p-3.5 rounded-2xl border border-white/10 flex items-start gap-3 transition-all hover:bg-white/10 hover:border-white/20">
                  <div className="p-2 rounded-xl bg-[#F16421]/30 text-orange-400 border border-orange-400/20">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white mb-0.5">Segurança & ANTT</h2>
                    <p className="text-xs text-slate-400">Validação rigorosa de documentos e conformidade fiscal.</p>
                  </div>
                </div>

                <div className="glass-card-hero p-3.5 rounded-2xl border border-white/10 flex items-start gap-3 transition-all hover:bg-white/10 hover:border-white/20">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/20">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white mb-0.5">Cálculo de Estadias</h2>
                    <p className="text-xs text-slate-400">Cálculos precisos da Lei 11.442 e relatórios transparentes.</p>
                  </div>
                </div>

                <div className="glass-card-hero p-3.5 rounded-2xl border border-white/10 flex items-start gap-3 transition-all hover:bg-white/10 hover:border-white/20">
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-400/20">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white mb-0.5">App para Motoristas</h2>
                    <p className="text-xs text-slate-400">Acesso via PWA sem complicação diretamente do celular.</p>
                  </div>
                </div>
              </div>

              {/* Brand Values */}
              <div className="flex flex-wrap items-center gap-5 pt-3 border-t border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-widest">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#F16421]" /> Transparência
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#F16421]" /> Cuidado
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#F16421]" /> Prazo
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Footer */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} RODO-CHAGAS Logística. Todos os direitos reservados.</p>
          <span className="text-slate-600">v2.5 • Alta Performance</span>
        </div>
      </div>

      {/* MODAL: Help / Support */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-white/15 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Central de Acesso</h3>
            </div>

            <div className="space-y-3 text-sm text-slate-300">
              <div className="p-3 bg-white/5 rounded-xl">
                <h4 className="font-bold text-white mb-1">Para Colaboradores Internos:</h4>
                <p className="text-xs text-slate-400">Utilize seu e-mail corporativo cadastrado pelo administrador do sistema.</p>
              </div>

              <div className="p-3 bg-white/5 rounded-xl">
                <h4 className="font-bold text-white mb-1">Para Motoristas:</h4>
                <p className="text-xs text-slate-400">Informe seu CPF. Se for o primeiro acesso, o campo de senha pode ficar vazio para cadastro de uma nova senha.</p>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full mt-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-xl transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Install PWA Guide */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-white/15 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowInstallModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Instalar no Smartphone</h3>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-300">
              <div className="p-3 bg-white/5 rounded-xl">
                <h4 className="font-bold text-white mb-1">No Android (Google Chrome):</h4>
                <p className="text-xs text-slate-400">Toque nos <strong>3 pontinhos (⋮)</strong> no topo do navegador e selecione <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar aplicativo"</strong>.</p>
              </div>

              <div className="p-3 bg-white/5 rounded-xl">
                <h4 className="font-bold text-white mb-1">No iPhone (Apple Safari):</h4>
                <p className="text-xs text-slate-400">Toque no ícone de <strong>Compartilhar (quadrado com seta para cima)</strong> e escolha <strong>"Adicionar à Tela de Início"</strong>.</p>
              </div>
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              className="w-full mt-5 py-2.5 bg-[#F16421] hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-all shadow-lg"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
