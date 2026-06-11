ALTER TABLE public.familias_onboarding
  ADD COLUMN IF NOT EXISTS bitrix_marcador TEXT;

CREATE TABLE IF NOT EXISTS public.bitrix_tarefas_cache (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  familia_id        UUID REFERENCES public.familias_onboarding(id) ON DELETE CASCADE,
  bitrix_task_id    INTEGER NOT NULL,
  titulo            TEXT NOT NULL,
  descricao         TEXT,
  status            TEXT,
  prioridade        TEXT,
  responsavel_nome  TEXT,
  responsavel_foto  TEXT,
  prazo             TIMESTAMPTZ,
  marcadores        TEXT[],
  link_bitrix       TEXT,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (familia_id, bitrix_task_id)
);

ALTER TABLE public.bitrix_tarefas_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem bitrix cache"
  ON public.bitrix_tarefas_cache FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role gerencia bitrix cache"
  ON public.bitrix_tarefas_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_bitrix_cache_familia ON public.bitrix_tarefas_cache(familia_id);
CREATE INDEX IF NOT EXISTS idx_bitrix_cache_synced  ON public.bitrix_tarefas_cache(synced_at);
CREATE INDEX IF NOT EXISTS idx_bitrix_cache_status  ON public.bitrix_tarefas_cache(status);
