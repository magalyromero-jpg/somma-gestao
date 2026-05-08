-- Checklist por Holding
CREATE TABLE public.checklist_holding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id text NOT NULL,
  familia_id uuid NOT NULL,
  item_id text NOT NULL,
  label text NOT NULL,
  opcional boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pendente',
  documento_id uuid REFERENCES public.familia_documentos(id) ON DELETE SET NULL,
  data_recebimento timestamptz,
  notas text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(holding_id, familia_id, item_id)
);

ALTER TABLE public.checklist_holding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso checklist_holding"
ON public.checklist_holding
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.familias_onboarding f
  WHERE f.id = checklist_holding.familia_id
    AND (f.created_by = auth.uid() OR public.has_role(auth.uid(), 'gestor'::app_role))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.familias_onboarding f
  WHERE f.id = checklist_holding.familia_id
    AND (f.created_by = auth.uid() OR public.has_role(auth.uid(), 'gestor'::app_role))
));

-- Checklist Outros Bens
CREATE TABLE public.checklist_outros_bens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL,
  bem_tipo text NOT NULL,
  bem_ref_id text,
  bem_descricao text,
  item_id text NOT NULL,
  label text NOT NULL,
  opcional boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pendente',
  documento_id uuid REFERENCES public.familia_documentos(id) ON DELETE SET NULL,
  data_recebimento timestamptz,
  notas text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(familia_id, bem_ref_id, item_id)
);

ALTER TABLE public.checklist_outros_bens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso checklist_outros_bens"
ON public.checklist_outros_bens
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.familias_onboarding f
  WHERE f.id = checklist_outros_bens.familia_id
    AND (f.created_by = auth.uid() OR public.has_role(auth.uid(), 'gestor'::app_role))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.familias_onboarding f
  WHERE f.id = checklist_outros_bens.familia_id
    AND (f.created_by = auth.uid() OR public.has_role(auth.uid(), 'gestor'::app_role))
));

-- Audit log (mudanças de status de checklists)
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid,
  entidade text NOT NULL,
  entidade_id text,
  acao text NOT NULL,
  antes jsonb,
  depois jsonb,
  autor_id uuid,
  autor_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver audit log da familia"
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  familia_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.familias_onboarding f
    WHERE f.id = audit_log.familia_id
      AND (f.created_by = auth.uid() OR public.has_role(auth.uid(), 'gestor'::app_role))
  )
);

CREATE POLICY "Inserir audit log"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (autor_id = auth.uid());