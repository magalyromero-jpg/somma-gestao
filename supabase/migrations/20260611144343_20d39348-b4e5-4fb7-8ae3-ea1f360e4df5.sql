CREATE TABLE IF NOT EXISTS public.bitrix_tarefas_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  familia_id uuid NOT NULL,
  bitrix_task_id bigint NOT NULL,
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'pending',
  prioridade text NOT NULL DEFAULT 'average',
  responsavel_nome text,
  responsavel_foto text,
  prazo timestamptz,
  marcadores text[] NOT NULL DEFAULT '{}',
  link_bitrix text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (familia_id, bitrix_task_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bitrix_tarefas_cache TO authenticated;
GRANT ALL ON public.bitrix_tarefas_cache TO service_role;
ALTER TABLE public.bitrix_tarefas_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios autenticados podem ler cache bitrix"
ON public.bitrix_tarefas_cache FOR SELECT TO authenticated USING (true);