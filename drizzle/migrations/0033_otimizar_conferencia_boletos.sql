CREATE OR REPLACE VIEW public.loc_v_boletos_a_conferir WITH (security_invoker=true) AS
WITH candidatos AS MATERIALIZED (
 SELECT b.* FROM public.loc_boletos b WHERE b.status <> 'cancelada' AND b.natureza='aluguel' AND NOT b.classificado AND b.contrato_id IS NOT NULL
), anos AS MATERIALIZED (
 SELECT DISTINCT edificio_id,extract(year FROM data_vencimento)::int AS ano FROM candidatos
), previsoes AS MATERIALIZED (
 SELECT a.edificio_id,p.contrato_id,p.mes,p.valor,l.documento FROM anos a CROSS JOIN LATERAL public.loc_previsto_caixa(a.edificio_id,a.ano) p JOIN public.loc_contratos c ON c.id=p.contrato_id JOIN public.loc_locatarios l ON l.id=c.locatario_id
)
SELECT b.id,b.edificio_id,b.nosso_numero,b.pagador,b.contrato_id,b.data_vencimento,b.valor_titulo,b.valor_pago,b.status,
coalesce(sum(p.valor),0) AS previsto_mes
FROM candidatos b LEFT JOIN previsoes p ON p.edificio_id=b.edificio_id AND p.documento=b.documento AND p.mes=date_trunc('month',b.data_vencimento)::date
GROUP BY b.id,b.edificio_id,b.nosso_numero,b.pagador,b.contrato_id,b.data_vencimento,b.valor_titulo,b.valor_pago,b.status
HAVING NOT coalesce(bool_or(abs(p.valor-b.valor_titulo)<=2.00),false);
GRANT SELECT ON public.loc_v_boletos_a_conferir TO authenticated,service_role;