CREATE TABLE public.onboarding_fases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  familia_id UUID NOT NULL,
  fase TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  progresso INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (familia_id, fase)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_fases TO authenticated;
GRANT ALL ON public.onboarding_fases TO service_role;
ALTER TABLE public.onboarding_fases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage onboarding_fases" ON public.onboarding_fases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.onboarding_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  familia_id UUID NOT NULL,
  fase TEXT NOT NULL,
  item_key TEXT NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT false,
  concluido_em TIMESTAMPTZ,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (familia_id, item_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_checklist TO authenticated;
GRANT ALL ON public.onboarding_checklist TO service_role;
ALTER TABLE public.onboarding_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage onboarding_checklist" ON public.onboarding_checklist FOR ALL TO authenticated USING (true) WITH CHECK (true);