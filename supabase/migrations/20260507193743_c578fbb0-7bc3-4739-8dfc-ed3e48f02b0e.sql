
-- Vincular documentos a um imóvel específico e armazenar análise
ALTER TABLE public.familia_documentos
  ADD COLUMN IF NOT EXISTS imovel_ref text,
  ADD COLUMN IF NOT EXISTS analise jsonb;

-- Comentários por imóvel (histórico)
CREATE TABLE IF NOT EXISTS public.imovel_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL,
  imovel_ref text NOT NULL,
  autor_id uuid,
  autor_nome text,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.imovel_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso comentarios imovel"
ON public.imovel_comentarios
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.familias_onboarding f
  WHERE f.id = imovel_comentarios.familia_id
    AND (f.created_by = auth.uid() OR has_role(auth.uid(), 'gestor'::app_role))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.familias_onboarding f
  WHERE f.id = imovel_comentarios.familia_id
    AND (f.created_by = auth.uid() OR has_role(auth.uid(), 'gestor'::app_role))
));

CREATE INDEX IF NOT EXISTS idx_imovel_comentarios_familia ON public.imovel_comentarios(familia_id, imovel_ref);
CREATE INDEX IF NOT EXISTS idx_familia_documentos_imovel ON public.familia_documentos(familia_id, imovel_ref);
