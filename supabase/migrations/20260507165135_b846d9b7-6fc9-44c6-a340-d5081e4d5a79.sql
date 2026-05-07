
-- Tabela principal de onboarding
CREATE TABLE public.familias_onboarding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email_familia TEXT,
  sede TEXT,
  perfil TEXT,
  fonte TEXT,
  patrimonio_data JSONB,
  confianca TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.familias_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Criador ve familia_onboarding"
  ON public.familias_onboarding FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Criador insere familia_onboarding"
  ON public.familias_onboarding FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Criador atualiza familia_onboarding"
  ON public.familias_onboarding FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Criador deleta familia_onboarding"
  ON public.familias_onboarding FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER trg_familias_onboarding_updated_at
  BEFORE UPDATE ON public.familias_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Documentos
CREATE TABLE public.familia_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  familia_id UUID NOT NULL REFERENCES public.familias_onboarding(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  tipo TEXT,
  storage_path TEXT NOT NULL,
  categoria TEXT,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.familia_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso documentos familia"
  ON public.familia_documentos FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.familias_onboarding f
      WHERE f.id = familia_documentos.familia_id
        AND (f.created_by = auth.uid() OR has_role(auth.uid(), 'gestor'::app_role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.familias_onboarding f
      WHERE f.id = familia_documentos.familia_id
        AND (f.created_by = auth.uid() OR has_role(auth.uid(), 'gestor'::app_role))
    )
  );

-- Itens de diligência
CREATE TABLE public.familia_diligencia_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  familia_id UUID NOT NULL REFERENCES public.familias_onboarding(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  imovel_ref TEXT,
  is_locacao BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.familia_diligencia_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso diligencia familia"
  ON public.familia_diligencia_itens FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.familias_onboarding f
      WHERE f.id = familia_diligencia_itens.familia_id
        AND (f.created_by = auth.uid() OR has_role(auth.uid(), 'gestor'::app_role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.familias_onboarding f
      WHERE f.id = familia_diligencia_itens.familia_id
        AND (f.created_by = auth.uid() OR has_role(auth.uid(), 'gestor'::app_role))
    )
  );

CREATE TRIGGER trg_familia_diligencia_updated_at
  BEFORE UPDATE ON public.familia_diligencia_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('familia-documentos', 'familia-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: pasta = familia_id, acesso para criador da familia ou gestores
CREATE POLICY "Familia docs select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'familia-documentos' AND (
      has_role(auth.uid(), 'gestor'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.familias_onboarding f
        WHERE f.id::text = (storage.foldername(name))[1]
          AND f.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Familia docs insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'familia-documentos' AND (
      has_role(auth.uid(), 'gestor'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.familias_onboarding f
        WHERE f.id::text = (storage.foldername(name))[1]
          AND f.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Familia docs delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'familia-documentos' AND (
      has_role(auth.uid(), 'gestor'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.familias_onboarding f
        WHERE f.id::text = (storage.foldername(name))[1]
          AND f.created_by = auth.uid()
      )
    )
  );
