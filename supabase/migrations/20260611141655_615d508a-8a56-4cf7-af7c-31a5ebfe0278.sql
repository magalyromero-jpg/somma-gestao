ALTER TABLE public.familias_onboarding ADD COLUMN IF NOT EXISTS bitrix_marcador TEXT;
GRANT SELECT, UPDATE ON public.familias_onboarding TO authenticated;
GRANT ALL ON public.familias_onboarding TO service_role;