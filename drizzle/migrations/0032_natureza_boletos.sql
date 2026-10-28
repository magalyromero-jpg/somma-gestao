ALTER TABLE public.loc_boletos ADD COLUMN IF NOT EXISTS natureza text NOT NULL DEFAULT 'aluguel';
ALTER TABLE public.loc_boletos ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.loc_boletos ADD COLUMN IF NOT EXISTS classificado boolean NOT NULL DEFAULT false;
ALTER TABLE public.loc_boletos ADD CONSTRAINT loc_boletos_natureza_chk CHECK (natureza IN ('aluguel','outros'));
CREATE OR REPLACE VIEW public.loc_v_boletos_a_conferir WITH (security_invoker = true) AS
SELECT b.id,b.edificio_id,b.nosso_numero,b.pagador,b.contrato_id,b.data_vencimento,b.valor_titulo,b.valor_pago,b.status,
 (SELECT coalesce(sum(p.valor),0) FROM public.loc_previsto_caixa(b.edificio_id,extract(year from b.data_vencimento)::int) p JOIN public.loc_contratos c ON c.id=p.contrato_id JOIN public.loc_locatarios l ON l.id=c.locatario_id WHERE l.documento=b.documento AND p.mes=date_trunc('month',b.data_vencimento)::date) AS previsto_mes
FROM public.loc_boletos b WHERE b.status <> 'cancelada' AND b.natureza='aluguel' AND NOT b.classificado AND b.contrato_id IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM public.loc_previsto_caixa(b.edificio_id,extract(year from b.data_vencimento)::int) p JOIN public.loc_contratos c ON c.id=p.contrato_id JOIN public.loc_locatarios l ON l.id=c.locatario_id WHERE l.documento=b.documento AND p.mes=date_trunc('month',b.data_vencimento)::date AND abs(p.valor-b.valor_titulo)<=2.00);
GRANT SELECT ON public.loc_v_boletos_a_conferir TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.loc_classificar_boleto(p_edificio uuid,p_nosso_numero text,p_natureza text,p_descricao text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.loc_eh_admin(p_edificio) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF p_natureza IS NULL OR p_natureza NOT IN ('aluguel','outros') THEN RAISE EXCEPTION 'Natureza inválida'; END IF;
 UPDATE public.loc_boletos SET natureza=p_natureza,descricao=nullif(trim(coalesce(p_descricao,'')),''),classificado=true WHERE edificio_id=p_edificio AND nosso_numero=p_nosso_numero;
 IF NOT FOUND THEN RAISE EXCEPTION 'Boleto não encontrado'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.loc_classificar_boleto(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.loc_classificar_boleto(uuid,text,text,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.loc_planejamento_caixa(p_edificio uuid,p_ano int)
RETURNS TABLE(contrato_id uuid,mes date,previsto numeric,emitido numeric,em_aberto numeric,pago numeric,sem_boleto numeric,fora_boleto boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH prev AS (SELECT p.contrato_id,p.mes,p.valor FROM public.loc_previsto_caixa(p_edificio,p_ano) p),
bol AS (SELECT b.contrato_id,date_trunc('month',b.data_vencimento)::date AS mes,sum(b.valor_titulo) FILTER(WHERE b.status='a_vencer') AS emitido,sum(b.valor_titulo) FILTER(WHERE b.status='vencida') AS em_aberto,sum(b.valor_titulo) FILTER(WHERE b.status='paga') AS pago FROM public.loc_boletos b WHERE b.edificio_id=p_edificio AND b.contrato_id IS NOT NULL AND b.natureza='aluguel' GROUP BY 1,2),
tem AS (SELECT c.id AS contrato_id FROM public.loc_contratos c WHERE c.edificio_id=p_edificio AND NOT c.recebe_por_boleto)
SELECT coalesce(prev.contrato_id,bol.contrato_id),coalesce(prev.mes,bol.mes),coalesce(prev.valor,0),coalesce(bol.emitido,0),coalesce(bol.em_aberto,0),coalesce(bol.pago,0),CASE WHEN tem.contrato_id IS NOT NULL THEN 0 ELSE greatest(coalesce(prev.valor,0)-coalesce(bol.emitido,0)-coalesce(bol.em_aberto,0)-coalesce(bol.pago,0),0) END,tem.contrato_id IS NOT NULL
FROM prev FULL JOIN bol ON bol.contrato_id=prev.contrato_id AND bol.mes=prev.mes LEFT JOIN tem ON tem.contrato_id=coalesce(prev.contrato_id,bol.contrato_id) WHERE extract(year FROM coalesce(prev.mes,bol.mes))=p_ano;
$$;
CREATE OR REPLACE FUNCTION public.loc_planejamento_outras(p_edificio uuid,p_ano int)
RETURNS TABLE(outra_receita text,mes date,emitido numeric,em_aberto numeric,pago numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
SELECT coalesce(b.outra_receita,'Outros Boletos'),date_trunc('month',b.data_vencimento)::date,coalesce(sum(b.valor_titulo) FILTER(WHERE b.status='a_vencer'),0),coalesce(sum(b.valor_titulo) FILTER(WHERE b.status='vencida'),0),coalesce(sum(b.valor_titulo) FILTER(WHERE b.status='paga'),0)
FROM public.loc_boletos b WHERE b.edificio_id=p_edificio AND b.status <> 'cancelada' AND (b.outra_receita IS NOT NULL OR b.natureza='outros') AND extract(year FROM b.data_vencimento)=p_ano GROUP BY 1,2;
$$;
CREATE OR REPLACE VIEW public.loc_v_encargos_realizados WITH (security_invoker=true) AS
SELECT e.id,e.edificio_id,e.contrato_id,e.nosso_numero,e.pagador,e.data_vencimento,e.data_pagamento,e.competencia,e.dias_atraso,e.valor_titulo,e.valor_pago,e.acrescimo,e.juros,e.multa,
EXISTS(SELECT 1 FROM public.loc_pagamentos p WHERE p.edificio_id=e.edificio_id AND p.contrato_id IS NOT DISTINCT FROM e.contrato_id AND e.contrato_id IS NOT NULL AND (abs(p.valor_liquido-e.valor_pago)<=0.50 OR abs(coalesce(p.valor_bruto,0)-e.valor_pago)<=0.50) AND p.data_pagamento BETWEEN e.data_pagamento-3 AND e.data_pagamento+3) AS ja_no_realizado
FROM public.loc_v_boleto_encargos e JOIN public.loc_boletos b ON b.id=e.id WHERE b.natureza='aluguel';
GRANT SELECT ON public.loc_v_encargos_realizados TO authenticated,service_role;