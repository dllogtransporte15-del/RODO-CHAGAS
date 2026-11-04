-- Migration: Adicionar coluna supervisor_id na tabela cargos
-- Data: 2026-11-04
-- Descrição: Vincula um Supervisor Responsável (app_users.id) a cada carga,
-- ao lado do Comercial Responsável (created_by_id).

ALTER TABLE public.cargos 
ADD COLUMN IF NOT EXISTS supervisor_id TEXT REFERENCES public.app_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cargos_supervisor_id ON public.cargos(supervisor_id);

-- Recarrega o cache do PostgREST / Supabase
NOTIFY pgrst, 'reload schema';

