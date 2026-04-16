import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[RODO-CHAGAS] Variáveis de ambiente do Supabase não encontradas!\n' +
    'Configure as seguintes variáveis no Vercel Dashboard → Settings → Environment Variables:\n' +
    '  • VITE_SUPABASE_URL\n' +
    '  • VITE_SUPABASE_ANON_KEY\n' +
    'Para desenvolvimento local, crie um arquivo .env na raiz do projeto.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
