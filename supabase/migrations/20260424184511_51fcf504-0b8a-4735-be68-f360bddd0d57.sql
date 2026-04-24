ALTER TABLE public.market_listings ADD COLUMN IF NOT EXISTS dias_no_mercado integer;
ALTER TABLE public.market_metrics ADD COLUMN IF NOT EXISTS tempo_medio_mercado numeric;