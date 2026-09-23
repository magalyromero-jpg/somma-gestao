CREATE TABLE public.operacional_snapshot_diario (
  data date NOT NULL,
  familia_titulo text NOT NULL,
  responsavel_nome text NOT NULL,
  tipo text NOT NULL,
  em_andamento integer NOT NULL DEFAULT 0,
  atrasadas integer NOT NULL DEFAULT 0,
  prioridade integer NOT NULL DEFAULT 0,
  vencem_hoje integer NOT NULL DEFAULT 0,
  vencem_semana integer NOT NULL DEFAULT 0,
  criadas_dia integer NOT NULL DEFAULT 0,
  encerradas_dia integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operacional_snapshot_diario_pk PRIMARY KEY (data, familia_titulo, responsavel_nome, tipo)
);

GRANT SELECT ON public.operacional_snapshot_diario TO authenticated;
GRANT ALL ON public.operacional_snapshot_diario TO service_role;

ALTER TABLE public.operacional_snapshot_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe pode ler snapshot operacional"
ON public.operacional_snapshot_diario
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gestor')
  OR public.has_role(auth.uid(), 'analista')
);

CREATE INDEX idx_snapshot_operacional_data ON public.operacional_snapshot_diario (data);

CREATE OR REPLACE FUNCTION public.registrar_snapshot_operacional(
  p_data date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date)
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fim_semana date := p_data + (7 - EXTRACT(ISODOW FROM p_data))::int;
  v_linhas integer;
BEGIN
  WITH base AS (
    SELECT
      COALESCE(NULLIF(btrim(t.familia_titulo), ''), 'Sem família') AS familia_titulo,
      COALESCE(NULLIF(btrim(t.responsavel_nome), ''), 'Sem responsável') AS responsavel_nome,
      COALESCE((
        SELECT tp FROM unnest(ARRAY['Operacional','Analítico','Acompanhamento','Gestão Patrimonial','Planejamento Patrimonial','Gestão de Contas']) AS tp
        WHERE tp = ANY(COALESCE(t.marcadores, ARRAY[]::text[]))
        LIMIT 1
      ), 'Sem tipo') AS tipo,
      t.status,
      t.prioridade,
      (t.prazo AT TIME ZONE 'America/Sao_Paulo')::date AS prazo_d,
      (t.criado_em AT TIME ZONE 'America/Sao_Paulo')::date AS criado_d,
      (t.concluido_em AT TIME ZONE 'America/Sao_Paulo')::date AS concluido_d
    FROM public.bitrix_tarefas t
    WHERE t.prazo IS NOT NULL
  ), agregado AS (
    SELECT
      familia_titulo, responsavel_nome, tipo,
      COUNT(*) FILTER (WHERE status IN ('pending','in_progress')) AS em_andamento,
      COUNT(*) FILTER (WHERE status IN ('pending','in_progress') AND prazo_d < p_data) AS atrasadas,
      COUNT(*) FILTER (WHERE status IN ('pending','in_progress') AND prioridade = 'high') AS prioridade,
      COUNT(*) FILTER (WHERE status IN ('pending','in_progress') AND prazo_d = p_data) AS vencem_hoje,
      COUNT(*) FILTER (WHERE status IN ('pending','in_progress') AND prazo_d >= p_data AND prazo_d <= v_fim_semana) AS vencem_semana,
      COUNT(*) FILTER (WHERE criado_d = p_data) AS criadas_dia,
      COUNT(*) FILTER (WHERE status = 'completed' AND concluido_d = p_data) AS encerradas_dia
    FROM base
    GROUP BY familia_titulo, responsavel_nome, tipo
  )
  INSERT INTO public.operacional_snapshot_diario AS s (
    data, familia_titulo, responsavel_nome, tipo,
    em_andamento, atrasadas, prioridade, vencem_hoje, vencem_semana, criadas_dia, encerradas_dia
  )
  SELECT p_data, familia_titulo, responsavel_nome, tipo,
    em_andamento, atrasadas, prioridade, vencem_hoje, vencem_semana, criadas_dia, encerradas_dia
  FROM agregado
  WHERE em_andamento > 0 OR criadas_dia > 0 OR encerradas_dia > 0
  ON CONFLICT (data, familia_titulo, responsavel_nome, tipo) DO UPDATE SET
    em_andamento = EXCLUDED.em_andamento,
    atrasadas = EXCLUDED.atrasadas,
    prioridade = EXCLUDED.prioridade,
    vencem_hoje = EXCLUDED.vencem_hoje,
    vencem_semana = EXCLUDED.vencem_semana,
    criadas_dia = EXCLUDED.criadas_dia,
    encerradas_dia = EXCLUDED.encerradas_dia,
    criado_em = now();

  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  RETURN v_linhas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_snapshot_operacional(date) TO service_role;
