CREATE TABLE public.bitrix_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bitrix_id bigint NOT NULL UNIQUE,
  bitrix_parent_id bigint,
  familia_bitrix_id bigint,
  familia_titulo text,
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'pending',
  prioridade text NOT NULL DEFAULT 'average',
  responsavel_id text,
  responsavel_nome text,
  criado_em timestamptz,
  prazo timestamptz,
  concluido_em timestamptz,
  alterado_em timestamptz,
  marcadores text[] DEFAULT '{}',
  link_bitrix text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bitrix_tarefas TO authenticated;
GRANT ALL ON public.bitrix_tarefas TO service_role;

ALTER TABLE public.bitrix_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar todas as tarefas"
  ON public.bitrix_tarefas
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários autenticados podem visualizar tarefas"
  ON public.bitrix_tarefas
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_bitrix_tarefas_parent ON public.bitrix_tarefas(bitrix_parent_id);
CREATE INDEX idx_bitrix_tarefas_status ON public.bitrix_tarefas(status);
CREATE INDEX idx_bitrix_tarefas_synced ON public.bitrix_tarefas(synced_at);