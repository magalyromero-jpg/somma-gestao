ALTER TABLE public.familias_onboarding 
ADD COLUMN IF NOT EXISTS tipo_perfil text,
ADD COLUMN IF NOT EXISTS observacoes text;