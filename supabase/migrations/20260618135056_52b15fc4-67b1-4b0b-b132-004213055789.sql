CREATE OR REPLACE FUNCTION public.atribuir_ids_sinteticos()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH familias_sem_id AS (
  SELECT DISTINCT familia_titulo,
    -ROW_NUMBER() OVER (ORDER BY familia_titulo) - 1000 AS id_sintetico
  FROM bitrix_tarefas
  WHERE familia_bitrix_id IS NULL
    AND familia_titulo NOT IN (
      'Operacional','Acompanhamento','Analítico','Gestão de Contas',
      'Gestão Patrimonial','Análise/Proposta','Gestão de Patrimônio',
      'Planejamento Patrimonial','Due Diligence Prévio','Negócios'
    )
    AND familia_titulo IS NOT NULL
)
UPDATE bitrix_tarefas t
SET familia_bitrix_id = f.id_sintetico
FROM familias_sem_id f
WHERE t.familia_titulo = f.familia_titulo
  AND t.familia_bitrix_id IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.atribuir_ids_sinteticos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.atribuir_ids_sinteticos() TO service_role;
GRANT EXECUTE ON FUNCTION public.atribuir_ids_sinteticos() TO anon;