CREATE OR REPLACE FUNCTION public.consolidar_familia_ids()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE bitrix_tarefas t1
  SET familia_bitrix_id = t2.familia_bitrix_id
  FROM (
    SELECT DISTINCT familia_titulo, familia_bitrix_id
    FROM bitrix_tarefas
    WHERE familia_bitrix_id IS NOT NULL
      AND familia_bitrix_id > 0
  ) t2
  WHERE t1.familia_titulo = t2.familia_titulo
    AND t1.familia_bitrix_id IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.consolidar_familia_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consolidar_familia_ids() TO service_role;