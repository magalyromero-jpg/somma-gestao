
ALTER TABLE public.imoveis_cliente
  ADD COLUMN IF NOT EXISTS status_atual TEXT,
  ADD COLUMN IF NOT EXISTS unidade_consumidora TEXT,
  ADD COLUMN IF NOT EXISTS distribuidora TEXT,
  ADD COLUMN IF NOT EXISTS mes_referencia_energia TEXT,
  ADD COLUMN IF NOT EXISTS hidrometro TEXT,
  ADD COLUMN IF NOT EXISTS matricula_agua TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
  ADD COLUMN IF NOT EXISTS extracao_meta JSONB DEFAULT '{}'::jsonb;
