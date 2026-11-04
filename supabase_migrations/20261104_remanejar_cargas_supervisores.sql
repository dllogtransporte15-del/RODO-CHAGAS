-- ==============================================================================
-- Migration: Remanejamento de Cargas Existentes para Supervisores e Comerciais
-- Data: 2026-11-04
-- Descrição:
-- 1. Garante a coluna supervisor_id na tabela cargos (referenciando app_users.id).
-- 2. Remaneja as cargas cadastradas e em andamento:
--    - O Comercial Responsável (created_by_id) permanece com o usuário comercial cadastrado.
--    - O Supervisor Responsável (supervisor_id) só pode ser atribuído a usuários com perfil 'Supervisor'.
--    - Usuários do perfil 'Gestor GO' (Agenciador Líder) NUNCA recebem comissão de Supervisor e não são supervisor_id.
-- 3. Cria índice para agilizar buscas e relatórios de supervisão.
-- ==============================================================================

-- 1. Assegurar coluna supervisor_id
ALTER TABLE public.cargos 
ADD COLUMN IF NOT EXISTS supervisor_id TEXT REFERENCES public.app_users(id) ON DELETE SET NULL;

-- 2. Remanejar cargas: apenas usuários do perfil 'Supervisor' são elegíveis a supervisor_id.
-- Se um Gestor GO foi associado a supervisor_id anteriormente, ele é removido.
UPDATE public.cargos c
SET supervisor_id = (
    SELECT u.id 
    FROM public.app_users u 
    WHERE u.id = COALESCE(c.supervisor_id, (c.history->0->>'userId'), c.created_by_id)
      AND u.profile = 'Supervisor'
    LIMIT 1
);

-- 3. Índice para performance em consultas com filtro por supervisor
CREATE INDEX IF NOT EXISTS idx_cargos_supervisor_id ON public.cargos(supervisor_id);

-- 4. Recarregar cache de esquema do Supabase / PostgREST
NOTIFY pgrst, 'reload schema';
