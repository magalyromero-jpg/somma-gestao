-- ============== market_searches ==============
CREATE TABLE public.market_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  uf TEXT NOT NULL,
  cidade TEXT NOT NULL,
  bairro TEXT,
  endereco_alvo TEXT,
  tipologias TEXT[] NOT NULL DEFAULT '{}',
  m2_min NUMERIC,
  m2_max NUMERIC,
  margem NUMERIC NOT NULL DEFAULT 0,
  portais TEXT[] NOT NULL DEFAULT '{}',
  finalidade TEXT NOT NULL DEFAULT 'venda',
  raio INTEGER NOT NULL DEFAULT 500,
  params JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.market_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve suas pesquisas"
  ON public.market_searches FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Usuario cria suas pesquisas"
  ON public.market_searches FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuario atualiza suas pesquisas"
  ON public.market_searches FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Usuario remove suas pesquisas"
  ON public.market_searches FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Gestores gerenciam pesquisas mercado"
  ON public.market_searches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_market_searches_updated_at
  BEFORE UPDATE ON public.market_searches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_market_searches_user ON public.market_searches(user_id, created_at DESC);

-- ============== market_listings ==============
CREATE TABLE public.market_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_id UUID NOT NULL REFERENCES public.market_searches(id) ON DELETE CASCADE,
  titulo TEXT,
  endereco TEXT,
  m2 NUMERIC,
  dorms INTEGER,
  vagas INTEGER,
  preco NUMERIC,
  preco_m2 NUMERIC,
  portal TEXT,
  tipologia TEXT,
  url TEXT,
  lat NUMERIC,
  lng NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver listings das suas pesquisas"
  ON public.market_listings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.market_searches s
    WHERE s.id = search_id
      AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'::app_role))
  ));

CREATE POLICY "Gestores gerenciam listings"
  ON public.market_listings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'::app_role));

CREATE INDEX idx_market_listings_search ON public.market_listings(search_id);

-- ============== market_metrics ==============
CREATE TABLE public.market_metrics (
  search_id UUID NOT NULL PRIMARY KEY REFERENCES public.market_searches(id) ON DELETE CASCADE,
  media NUMERIC,
  mediana NUMERIC,
  minimo_valor NUMERIC,
  minimo_m2 NUMERIC,
  minimo_tipologia TEXT,
  maximo_valor NUMERIC,
  maximo_m2 NUMERIC,
  maximo_tipologia TEXT,
  total INTEGER,
  desvio_padrao NUMERIC,
  tipologias JSONB,
  portais JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.market_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver metricas das suas pesquisas"
  ON public.market_metrics FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.market_searches s
    WHERE s.id = search_id
      AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'::app_role))
  ));

CREATE POLICY "Gestores gerenciam metricas"
  ON public.market_metrics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'::app_role));

-- ============== market_conclusions ==============
CREATE TABLE public.market_conclusions (
  search_id UUID NOT NULL PRIMARY KEY REFERENCES public.market_searches(id) ON DELETE CASCADE,
  posicionamento TEXT,
  oferta_demanda TEXT,
  tipologia_dominante TEXT,
  competitividade TEXT,
  estimativa_ativo NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.market_conclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver conclusoes das suas pesquisas"
  ON public.market_conclusions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.market_searches s
    WHERE s.id = search_id
      AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'gestor'::app_role))
  ));

CREATE POLICY "Gestores gerenciam conclusoes"
  ON public.market_conclusions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'::app_role));