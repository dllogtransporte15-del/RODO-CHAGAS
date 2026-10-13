-- Adiciona o vínculo do Agenciador Embarque ao seu Agenciador Líder
-- e as alíquotas personalizadas de comissionamento híbrido
-- Executar no Supabase: Dashboard > SQL Editor

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS leader_id text REFERENCES public.app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS leader_profit_commission_rate numeric DEFAULT 25,
  ADD COLUMN IF NOT EXISTS leader_revenue_commission_rate numeric DEFAULT 1.5;

CREATE INDEX IF NOT EXISTS idx_app_users_leader_id ON public.app_users(leader_id);

-- Recarrega o cache de schema da API (PostgREST)
NOTIFY pgrst, 'reload schema';

-- (Opcional) Verificar se existe CHECK constraint restringindo os valores aceitos na coluna "profile".
-- Se existir restrição, certifique-se de que aceita: 'Agenciador Líder', 'Agenciador Embarque', 'Coordenador'.
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.app_users'::regclass AND contype = 'c';
