-- Cobrança mensal: valor esperado do mês x boleto, por contrato e mês de vencimento.
-- esperado = previsto de caixa do contrato no mês (mesmo valor do Fluxo de Caixa, líquido de retenção).
-- recebido = pagamentos importados do Lidderar com vencimento no mês.
-- boleto_* = boletos de aluguel do arquivo do banco, pelo mês de vencimento do boleto (cancelados não contam).
create or replace function loc_cobranca_mensal(p_edificio uuid, p_ano int)
returns table(contrato_id uuid, mes date, esperado numeric, recebido numeric, boleto_a_vencer numeric, boleto_vencido numeric,
              boleto_pago numeric, situacao text)
language sql stable security invoker as $$
  with prev as (select p.contrato_id, p.mes, p.valor from loc_previsto_caixa(p_edificio, p_ano) p),
  rec as (select p.contrato_id, date_trunc('month', p.data_vencimento)::date as mes, sum(p.valor_liquido) as v
            from loc_pagamentos p where p.edificio_id = p_edificio and p.contrato_id is not null
             and extract(year from p.data_vencimento) = p_ano group by 1, 2),
  bol as (select b.contrato_id, date_trunc('month', b.data_vencimento)::date as mes,
                 coalesce(sum(b.valor_titulo) filter (where b.status = 'a_vencer'), 0) as av,
                 coalesce(sum(b.valor_titulo) filter (where b.status = 'vencida'), 0) as vc,
                 coalesce(sum(b.valor_titulo) filter (where b.status = 'paga'), 0) as pg
            from loc_boletos b where b.edificio_id = p_edificio and b.contrato_id is not null
             and b.natureza = 'aluguel' and b.status <> 'cancelada' and extract(year from b.data_vencimento) = p_ano group by 1, 2),
  fora as (select c.id as contrato_id from loc_contratos c where c.edificio_id = p_edificio and not c.recebe_por_boleto)
  select prev.contrato_id, prev.mes, prev.valor, coalesce(rec.v, 0), coalesce(bol.av, 0), coalesce(bol.vc, 0), coalesce(bol.pg, 0),
         case
           when prev.valor <= 0 and coalesce(rec.v,0) = 0 then 'sem_cobranca'
           when coalesce(rec.v, 0) >= prev.valor - 2.00 then 'recebido'
           when coalesce(rec.v, 0) > 0 then 'parcial'
           when coalesce(bol.vc, 0) > 0 then 'vencido'
           when coalesce(bol.pg, 0) > 0 then 'pago_no_boleto'
           when coalesce(bol.av, 0) > 0 then 'boleto_emitido'
           when fora.contrato_id is not null then 'fora_do_boleto'
           when prev.mes < date_trunc('month', current_date)::date then 'sem_registro'
           else 'sem_boleto'
         end
    from prev left join rec on rec.contrato_id = prev.contrato_id and rec.mes = prev.mes
              left join bol on bol.contrato_id = prev.contrato_id and bol.mes = prev.mes
              left join fora on fora.contrato_id = prev.contrato_id;
$$;