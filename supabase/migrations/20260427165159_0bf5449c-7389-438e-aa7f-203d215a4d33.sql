-- Rename columns on market_searches
ALTER TABLE public.market_searches RENAME COLUMN user_id TO created_by;
ALTER TABLE public.market_searches RENAME COLUMN margem TO margem_pct;
ALTER TABLE public.market_searches RENAME COLUMN raio TO raio_metros;

-- Drop existing RLS policies that referenced the old column name
DROP POLICY IF EXISTS "Usuario atualiza suas pesquisas" ON public.market_searches;
DROP POLICY IF EXISTS "Usuario cria suas pesquisas" ON public.market_searches;
DROP POLICY IF EXISTS "Usuario remove suas pesquisas" ON public.market_searches;
DROP POLICY IF EXISTS "Usuario ve suas pesquisas" ON public.market_searches;

-- Recreate RLS policies using created_by
CREATE POLICY "Usuario ve suas pesquisas"
ON public.market_searches
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Usuario cria suas pesquisas"
ON public.market_searches
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Usuario atualiza suas pesquisas"
ON public.market_searches
FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Usuario remove suas pesquisas"
ON public.market_searches
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Update dependent RLS policies on related tables that joined via s.user_id
DROP POLICY IF EXISTS "Ver listings das suas pesquisas" ON public.market_listings;
CREATE POLICY "Ver listings das suas pesquisas"
ON public.market_listings
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.market_searches s
  WHERE s.id = market_listings.search_id
    AND (s.created_by = auth.uid() OR public.has_role(auth.uid(), 'gestor'::app_role))
));

DROP POLICY IF EXISTS "Ver metricas das suas pesquisas" ON public.market_metrics;
CREATE POLICY "Ver metricas das suas pesquisas"
ON public.market_metrics
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.market_searches s
  WHERE s.id = market_metrics.search_id
    AND (s.created_by = auth.uid() OR public.has_role(auth.uid(), 'gestor'::app_role))
));

DROP POLICY IF EXISTS "Ver conclusoes das suas pesquisas" ON public.market_conclusions;
CREATE POLICY "Ver conclusoes das suas pesquisas"
ON public.market_conclusions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.market_searches s
  WHERE s.id = market_conclusions.search_id
    AND (s.created_by = auth.uid() OR public.has_role(auth.uid(), 'gestor'::app_role))
));