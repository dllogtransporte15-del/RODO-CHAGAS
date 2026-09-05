import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { User, UserProfile } from '../types';
import { toUser } from '../lib/db';

export function useAuthSession() {
  const location = useLocation();
  const navigate = useNavigate();

  // Limpa sessões legadas do localStorage para garantir expiração ao fechar a janela
  useEffect(() => {
    try {
      localStorage.removeItem('rodochagas_currentUser');
      localStorage.removeItem('rodo_user_email');
      localStorage.removeItem('dllog_logged_in_user');
    } catch {}
  }, []);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem('rodochagas_currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Persistência de sessão por janela/aba (expira ao fechar)
  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('rodochagas_currentUser', JSON.stringify(currentUser));
      sessionStorage.setItem('rodo_user_email', currentUser.email);
    } else {
      sessionStorage.removeItem('rodochagas_currentUser');
      sessionStorage.removeItem('rodo_user_email');
    }
    try {
      localStorage.removeItem('rodochagas_currentUser');
      localStorage.removeItem('rodo_user_email');
    } catch {}
  }, [currentUser]);

  const verifySession = useCallback(async () => {
    setIsAuthChecking(true);
    console.log('[Auth] Iniciando verificação de sessão...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const savedUserEmail = sessionStorage.getItem('rodo_user_email') || session?.user?.email;

      if (savedUserEmail) {
        console.log('[Auth] Recuperando perfil para:', savedUserEmail);

        // Verifica se o usuário salvo na sessão já é um motorista
        let savedUser: User | null = null;
        try { savedUser = JSON.parse(sessionStorage.getItem('rodochagas_currentUser') || 'null'); } catch { savedUser = null; }
        const isMotoristaSession = savedUser?.profile === UserProfile.Motorista;

        if (isMotoristaSession) {
          // Motorista: valida diretamente na tabela drivers via CPF
          const cleanCpf = savedUserEmail.replace(/\D/g, "");
          const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

          let { data: dbDriver } = await supabase
            .from('drivers')
            .select('*')
            .eq("cpf", formattedCpf)
            .maybeSingle();

          if (!dbDriver) {
            const { data: dbDriverClean } = await supabase
              .from('drivers')
              .select('*')
              .eq("cpf", cleanCpf)
              .maybeSingle();
            dbDriver = dbDriverClean;
          }

          if (dbDriver && dbDriver.active) {
            const driverProfile: User = {
              id: dbDriver.id,
              name: dbDriver.name,
              email: dbDriver.cpf,
              profile: UserProfile.Motorista,
              active: dbDriver.active,
            };
            setCurrentUser(driverProfile);
            console.log('[Auth] Sessão de motorista restaurada:', driverProfile.name);
          } else {
            console.warn('[Auth] Motorista não encontrado ou inativo.');
            setCurrentUser(null);
          }
          return;
        }

        // Usuário interno: busca em app_users
        const { data: dbUser, error: dbError } = await supabase
          .from('app_users')
          .select('*')
          .eq("email", savedUserEmail)
          .maybeSingle();

        if (!dbError && dbUser) {
          const userProfile = toUser(dbUser);

          if (userProfile.active) {
            if (userProfile.passwordUpdatedAt) {
              const lastUpdate = new Date(userProfile.passwordUpdatedAt).getTime();
              const now = new Date().getTime();
              const daysSinceUpdate = (now - lastUpdate) / (1000 * 3600 * 24);
              if (daysSinceUpdate >= 30) {
                userProfile.requirePasswordChange = true;
              }
            }
            setCurrentUser(userProfile);
            console.log('[Auth] Sessão restaurada com sucesso:', userProfile.name);
          } else {
            console.warn('[Auth] Usuário inativo no banco.');
            setCurrentUser(null);
          }
        } else {
          if (dbError) console.error('[Auth] Erro ao recuperar perfil:', dbError.message);
          setCurrentUser(null);
        }
      } else {
        console.log('[Auth] Nenhuma sessão encontrada.');
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('[Auth] Erro crítico na verificação:', err);
    } finally {
      setIsAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  // Guard: Se o usuario atual é motorista e está em uma rota errada, redireciona imediatamente
  useEffect(() => {
    if (!currentUser || isAuthChecking) return;
    const isMotoristaUser = currentUser.profile === UserProfile.Motorista || String(currentUser.profile).toLowerCase() === 'motorista';
    if (isMotoristaUser) {
      const allowedPaths = ['/operational-loads', '/operational-map'];
      if (!allowedPaths.includes(location.pathname)) {
        navigate('/operational-loads', { replace: true });
      }
    }
  }, [currentUser, isAuthChecking, location.pathname, navigate]);

  const handleLogin = (user: User) => {
    sessionStorage.setItem('rodo_user_email', user.email);
    sessionStorage.setItem('rodochagas_currentUser', JSON.stringify(user));
    setCurrentUser(user);
    const isMotoristaUser = user.profile === UserProfile.Motorista || String(user.profile).toLowerCase() === 'motorista';
    if (isMotoristaUser) {
      navigate('/operational-loads', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('rodo_user_email');
    sessionStorage.removeItem('rodochagas_currentUser');
    try {
      localStorage.removeItem('rodo_user_email');
      localStorage.removeItem('rodochagas_currentUser');
      localStorage.removeItem('dllog_logged_in_user');
      supabase.auth.signOut();
    } catch {}
    setCurrentUser(null);
    navigate('/');
  };

  return {
    currentUser,
    setCurrentUser,
    isAuthChecking,
    handleLogin,
    handleLogout,
    verifySession,
  };
}
