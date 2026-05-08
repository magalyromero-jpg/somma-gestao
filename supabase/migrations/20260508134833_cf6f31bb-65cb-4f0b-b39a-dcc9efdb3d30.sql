
ALTER TABLE public.imoveis_cliente
  ADD COLUMN IF NOT EXISTS taxa_administracao_pct numeric,
  ADD COLUMN IF NOT EXISTS valor_iptu_anual numeric;

CREATE TABLE IF NOT EXISTS public.repasses_aluguel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid NOT NULL,
  familia_id uuid NOT NULL,
  competencia date NOT NULL,
  valor_bruto numeric NOT NULL,
  taxa_adm numeric,
  valor_liquido numeric,
  data_repasse date,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repasses_aluguel_imovel ON public.repasses_aluguel(imovel_id);
CREATE INDEX IF NOT EXISTS idx_repasses_aluguel_familia ON public.repasses_aluguel(familia_id);

ALTER TABLE public.repasses_aluguel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso repasses aluguel"
  ON public.repasses_aluguel
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.familias_onboarding f
    WHERE f.id = repasses_aluguel.familia_id
      AND (f.created_by = auth.uid() OR public.has_role(auth.uid(), 'gestor'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.familias_onboarding f
    WHERE f.id = repasses_aluguel.familia_id
      AND (f.created_by = auth.uid() OR public.has_role(auth.uid(), 'gestor'::app_role))
  ));
