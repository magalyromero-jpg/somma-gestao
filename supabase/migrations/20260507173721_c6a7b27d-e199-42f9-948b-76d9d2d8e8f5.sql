
CREATE TABLE public.imoveis_cliente (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id      UUID NOT NULL REFERENCES public.familias_onboarding(id) ON DELETE CASCADE,
  ref_id          TEXT,
  nome            TEXT NOT NULL,
  endereco        TEXT,
  valor_declarado NUMERIC,
  matricula       TEXT,
  titularidade    TEXT,
  holding_cnpj    TEXT,
  locacao         BOOLEAN NOT NULL DEFAULT FALSE,
  alertas         JSONB NOT NULL DEFAULT '[]'::jsonb,
  origem          TEXT NOT NULL DEFAULT 'manual',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(familia_id, ref_id)
);

CREATE TABLE public.checklist_imovel (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id        UUID NOT NULL REFERENCES public.imoveis_cliente(id) ON DELETE CASCADE,
  familia_id       UUID NOT NULL REFERENCES public.familias_onboarding(id) ON DELETE CASCADE,
  item_id          TEXT NOT NULL,
  label            TEXT NOT NULL,
  opcional         BOOLEAN NOT NULL DEFAULT FALSE,
  status           TEXT NOT NULL DEFAULT 'pendente',
  documento_id     UUID REFERENCES public.familia_documentos(id) ON DELETE SET NULL,
  data_recebimento TIMESTAMPTZ,
  notas            TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(imovel_id, item_id)
);

CREATE INDEX idx_imoveis_cliente_familia ON public.imoveis_cliente(familia_id);
CREATE INDEX idx_checklist_imovel_imovel ON public.checklist_imovel(imovel_id);
CREATE INDEX idx_checklist_imovel_familia ON public.checklist_imovel(familia_id);

ALTER TABLE public.imoveis_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_imovel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso imoveis_cliente"
ON public.imoveis_cliente
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.familias_onboarding f
  WHERE f.id = imoveis_cliente.familia_id
    AND (f.created_by = auth.uid() OR has_role(auth.uid(), 'gestor'::app_role))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.familias_onboarding f
  WHERE f.id = imoveis_cliente.familia_id
    AND (f.created_by = auth.uid() OR has_role(auth.uid(), 'gestor'::app_role))
));

CREATE POLICY "Acesso checklist_imovel"
ON public.checklist_imovel
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.familias_onboarding f
  WHERE f.id = checklist_imovel.familia_id
    AND (f.created_by = auth.uid() OR has_role(auth.uid(), 'gestor'::app_role))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.familias_onboarding f
  WHERE f.id = checklist_imovel.familia_id
    AND (f.created_by = auth.uid() OR has_role(auth.uid(), 'gestor'::app_role))
));

CREATE TRIGGER trg_imoveis_cliente_updated_at
BEFORE UPDATE ON public.imoveis_cliente
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_checklist_imovel_updated_at
BEFORE UPDATE ON public.checklist_imovel
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
