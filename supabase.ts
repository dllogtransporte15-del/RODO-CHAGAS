import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[RODO-CHAGAS] Variáveis de ambiente do Supabase não encontradas!\n' +
    'Configure as seguintes variáveis no Vercel Dashboard → Settings → Environment Variables:\n' +
    '  • VITE_SUPABASE_URL\n' +
    '  • VITE_SUPABASE_ANON_KEY\n' +
    'Para segurança máxima, use a chave moderna (sb_publishable_...).'
  );
}

// Inicializa o cliente com persistência de sessão ativada por padrão
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
