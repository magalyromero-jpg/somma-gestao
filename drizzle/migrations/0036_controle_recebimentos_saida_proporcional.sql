CREATE OR REPLACE FUNCTION public.loc_esperado_caixa(p_edificio uuid, p_ano int)
RETURNS TABLE(contrato_id uuid, mes date, valor numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
SELECT p.contrato_id,p.mes, CASE WHEN c.data_saida IS NULL THEN p.valor
WHEN p.mes < (date_trunc('month',c.data_saida) + CASE WHEN c.competencia='posterior' THEN interval '1 month' ELSE interval '0 month' END)::date THEN p.valor
WHEN p.mes = (date_trunc('month',c.data_saida) + CASE WHEN c.competencia='posterior' THEN interval '1 month' ELSE interval '0 month' END)::date THEN round(p.valor * extract(day FROM c.data_saida) / extract(day FROM (date_trunc('month',c.data_saida)+interval '1 month - 1 day')),2)
ELSE 0 END FROM public.loc_previsto_caixa(p_edificio,p_ano) p JOIN public.loc_contratos c ON c.id=p.contrato_id;
$$;
CREATE OR REPLACE FUNCTION public.loc_cobranca_mensal(p_edificio uuid,p_ano int)
RETURNS TABLE(contrato_id uuid,mes date,esperado numeric,recebido numeric,boleto_a_vencer numeric,boleto_vencido numeric,boleto_pago numeric,situacao text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH prev AS (SELECT p.contrato_id,p.mes,p.valor FROM public.loc_esperado_caixa(p_edificio,p_ano) p),
rec AS (SELECT p.contrato_id,date_trunc('month',p.data_vencimento)::date mes,sum(p.valor_liquido) v FROM public.loc_pagamentos p WHERE p.edificio_id=p_edificio AND p.contrato_id IS NOT NULL AND extract(year FROM p.data_vencimento)=p_ano GROUP BY 1,2),
bol AS (SELECT b.contrato_id,date_trunc('month',b.data_vencimento)::date mes,coalesce(sum(b.valor_titulo) FILTER(WHERE b.status='a_vencer'),0) av,coalesce(sum(b.valor_titulo) FILTER(WHERE b.status='vencida'),0) vc,coalesce(sum(b.valor_titulo) FILTER(WHERE b.status='paga'),0) pg FROM public.loc_boletos b WHERE b.edificio_id=p_edificio AND b.contrato_id IS NOT NULL AND b.natureza='aluguel' AND b.status<>'cancelada' AND extract(year FROM b.data_vencimento)=p_ano GROUP BY 1,2),
fora AS (SELECT c.id contrato_id FROM public.loc_contratos c WHERE c.edificio_id=p_edificio AND NOT c.recebe_por_boleto)
SELECT prev.contrato_id,prev.mes,prev.valor,coalesce(rec.v,0),coalesce(bol.av,0),coalesce(bol.vc,0),coalesce(bol.pg,0),
CASE WHEN prev.valor<=0 AND coalesce(rec.v,0)=0 THEN 'sem_cobranca' WHEN coalesce(rec.v,0)>=prev.valor-2.00 THEN 'recebido' WHEN coalesce(rec.v,0)>0 THEN 'parcial' WHEN coalesce(bol.vc,0)>0 THEN 'vencido' WHEN coalesce(bol.pg,0)>0 THEN 'pago_no_boleto' WHEN coalesce(bol.av,0)>0 THEN 'boleto_emitido' WHEN fora.contrato_id IS NOT NULL THEN 'fora_do_boleto' WHEN prev.mes<date_trunc('month',current_date)::date THEN 'sem_registro' ELSE 'sem_boleto' END
FROM prev LEFT JOIN rec ON rec.contrato_id=prev.contrato_id AND rec.mes=prev.mes LEFT JOIN bol ON bol.contrato_id=prev.contrato_id AND bol.mes=prev.mes LEFT JOIN fora ON fora.contrato_id=prev.contrato_id;
$$;
CREATE OR REPLACE FUNCTION public.loc_planejamento_caixa(p_edificio uuid,p_ano int)
RETURNS TABLE(contrato_id uuid,mes date,previsto numeric,emitido numeric,em_aberto numeric,pago numeric,sem_boleto numeric,fora_boleto boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH prev AS (SELECT p.contrato_id,p.mes,p.valor FROM public.loc_esperado_caixa(p_edificio,p_ano) p),
bol AS (SELECT b.contrato_id,date_trunc('month',b.data_vencimento)::date mes,sum(b.valor_titulo) FILTER(WHERE b.status='a_vencer') emitido,sum(b.valor_titulo) FILTER(WHERE b.status='vencida') em_aberto,sum(b.valor_titulo) FILTER(WHERE b.status='paga') pago FROM public.loc_boletos b WHERE b.edificio_id=p_edificio AND b.contrato_id IS NOT NULL AND b.natureza='aluguel' GROUP BY 1,2),
base AS (SELECT c.id contrato_id,NOT c.recebe_por_boleto sem_boleto_fixo FROM public.loc_contratos c WHERE c.edificio_id=p_edificio),
j AS (SELECT coalesce(prev.contrato_id,bol.contrato_id) contrato_id,coalesce(prev.mes,bol.mes) mes,coalesce(prev.valor,0) previsto,coalesce(bol.emitido,0) emitido,coalesce(bol.em_aberto,0) em_aberto,coalesce(bol.pago,0) pago FROM prev FULL JOIN bol ON bol.contrato_id=prev.contrato_id AND bol.mes=prev.mes)
SELECT j.contrato_id,j.mes,j.previsto,j.emitido,j.em_aberto,j.pago,CASE WHEN base.sem_boleto_fixo THEN 0 ELSE greatest(j.previsto-j.emitido-j.em_aberto-j.pago,0) END,base.sem_boleto_fixo FROM j LEFT JOIN base ON base.contrato_id=j.contrato_id WHERE extract(year FROM j.mes)=p_ano;
$$;
CREATE OR REPLACE FUNCTION public.loc_controle_recebimentos(p_edificio uuid,p_ano int)
RETURNS TABLE(contrato_id uuid,mes date,recebido numeric,a_receber numeric,situacao text,valor_boleto numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH esp AS (SELECT e.contrato_id,e.mes,e.valor FROM public.loc_esperado_caixa(p_edificio,p_ano) e),
pago_v AS (SELECT p.contrato_id,date_trunc('month',p.data_vencimento)::date mes,sum(p.valor_liquido) v FROM public.loc_pagamentos p WHERE p.edificio_id=p_edificio AND p.contrato_id IS NOT NULL AND extract(year FROM p.data_vencimento)=p_ano GROUP BY 1,2),
pago_c AS (SELECT p.contrato_id,date_trunc('month',p.data_pagamento)::date mes,sum(p.valor_liquido) v FROM public.loc_pagamentos p WHERE p.edificio_id=p_edificio AND p.contrato_id IS NOT NULL AND extract(year FROM p.data_pagamento)=p_ano GROUP BY 1,2),
bol AS (SELECT b.contrato_id,date_trunc('month',b.data_vencimento)::date mes,coalesce(sum(b.valor_titulo) FILTER(WHERE b.status='a_vencer'),0) av,coalesce(sum(b.valor_titulo) FILTER(WHERE b.status='vencida'),0) vc,coalesce(sum(b.valor_titulo) FILTER(WHERE b.status='paga'),0) pg FROM public.loc_boletos b WHERE b.edificio_id=p_edificio AND b.contrato_id IS NOT NULL AND b.natureza='aluguel' AND b.status<>'cancelada' AND extract(year FROM b.data_vencimento)=p_ano GROUP BY 1,2),
fora AS (SELECT c.id contrato_id FROM public.loc_contratos c WHERE c.edificio_id=p_edificio AND NOT c.recebe_por_boleto),
pend AS (SELECT esp.contrato_id,esp.mes,greatest(esp.valor-coalesce(pago_v.v,0),0) resto,esp.valor,coalesce(bol.av,0) av,coalesce(bol.vc,0) vc,coalesce(bol.pg,0) pg,(fora.contrato_id IS NOT NULL) eh_fora FROM esp LEFT JOIN pago_v ON pago_v.contrato_id=esp.contrato_id AND pago_v.mes=esp.mes LEFT JOIN bol ON bol.contrato_id=esp.contrato_id AND bol.mes=esp.mes LEFT JOIN fora ON fora.contrato_id=esp.contrato_id)
SELECT coalesce(pend.contrato_id,pago_c.contrato_id),coalesce(pend.mes,pago_c.mes),coalesce(pago_c.v,0),CASE WHEN coalesce(pend.resto,0)>2.00 THEN pend.resto ELSE 0 END,
CASE WHEN coalesce(pend.resto,0)<=2.00 THEN NULL WHEN pend.vc>0 THEN 'vencido' WHEN pend.pg>0 THEN 'pago_no_boleto' WHEN pend.av>0 THEN 'boleto_emitido' WHEN pend.eh_fora THEN 'fora_do_boleto' WHEN pend.mes<date_trunc('month',current_date)::date THEN 'sem_registro' ELSE 'sem_boleto' END,
CASE WHEN coalesce(pend.resto,0)<=2.00 THEN 0 ELSE pend.vc+pend.pg+pend.av END FROM pend FULL JOIN pago_c ON pago_c.contrato_id=pend.contrato_id AND pago_c.mes=pend.mes;
$$;
REVOKE ALL ON FUNCTION public.loc_esperado_caixa(uuid,int),public.loc_controle_recebimentos(uuid,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.loc_esperado_caixa(uuid,int),public.loc_controle_recebimentos(uuid,int) TO authenticated,service_role;