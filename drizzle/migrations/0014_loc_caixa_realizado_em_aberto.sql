create or replace function public.loc_conferencia(p_edificio uuid, p_ano int)
returns table (mes date, contrato_id uuid, unidades text, locatario text, orcado numeric, recebido numeric,
               pago_em date, saldo numeric, situacao text, encerrado boolean)
language sql stable security invoker set search_path = public as $$
  with lim as (select date_trunc('month', max(data_pagamento))::date as ate from loc_pagamentos where edificio_id = p_edificio),
  b as (
    select o.mes, o.contrato_id, o.valor as orcado,
           coalesce((select sum(p.valor_liquido) from loc_pagamentos p where p.contrato_id = o.contrato_id and p.competencia = o.mes), 0) as recebido,
           (select max(p.data_pagamento) from loc_pagamentos p where p.contrato_id = o.contrato_id and p.competencia = o.mes) as pago_em
    from loc_orcado_caixa(p_edificio, p_ano) o, lim
    where o.valor > 0 and o.mes <= lim.ate
  )
  select b.mes, b.contrato_id,
         (select string_agg(u.nome, ' + ' order by u.nome) from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
           where cu.contrato_id = b.contrato_id and u.tipo <> 'garagem'),
         lc.nome, b.orcado, b.recebido, b.pago_em,
         round(b.orcado - b.recebido, 2),
         case when b.orcado - b.recebido > 2 and b.recebido <= 2 then 'Em aberto'
              when b.orcado - b.recebido > 2 then 'Recebido parcialmente'
              when b.orcado - b.recebido < -2 then 'Recebido a maior'
              else 'Conforme' end,
         c.status = 'encerrado'
  from b join loc_contratos c on c.id = b.contrato_id
  left join loc_v_locatarios_cliente lc on lc.id = c.locatario_id and lc.edificio_id = c.edificio_id
$$;

create or replace function public.loc_caixa_mensal(p_edificio uuid, p_ano int)
returns table (mes date, orcado numeric, recebido_da_competencia numeric, em_aberto numeric, em_aberto_encerrados numeric,
               recebido_a_maior numeric, outras_receitas numeric, entrou_no_caixa numeric,
               de_meses_anteriores numeric, recebido_no_mes_seguinte numeric)
language sql stable security invoker set search_path = public as $$
  with c as (select * from loc_conferencia(p_edificio, p_ano)),
  m as (select distinct mes from c)
  select m.mes,
    (select coalesce(sum(orcado),0) from c where c.mes = m.mes),
    (select coalesce(sum(recebido),0) from c where c.mes = m.mes),
    (select coalesce(sum(saldo),0) from c where c.mes = m.mes and saldo > 2 and not encerrado),
    (select coalesce(sum(saldo),0) from c where c.mes = m.mes and saldo > 2 and encerrado),
    (select coalesce(sum(-saldo),0) from c where c.mes = m.mes and saldo < -2),
    (select coalesce(sum(valor_liquido),0) from loc_pagamentos p where p.edificio_id = p_edificio and p.contrato_id is null and p.competencia = m.mes),
    (select coalesce(sum(valor_liquido),0) from loc_pagamentos p where p.edificio_id = p_edificio and date_trunc('month', p.data_pagamento) = m.mes),
    (select coalesce(sum(valor_liquido),0) from loc_pagamentos p where p.edificio_id = p_edificio and date_trunc('month', p.data_pagamento) = m.mes and p.competencia < m.mes),
    (select coalesce(sum(valor_liquido),0) from loc_pagamentos p where p.edificio_id = p_edificio and p.competencia = m.mes and date_trunc('month', p.data_pagamento) > m.mes)
  from m order by m.mes
$$;
grant execute on function public.loc_conferencia(uuid,int), public.loc_caixa_mensal(uuid,int) to authenticated;

create or replace function public.loc_em_aberto(p_edificio uuid, p_ano int)
returns table (contrato_id uuid, unidades text, locatario text, orcado numeric, recebido numeric, saldo numeric,
               competencias text, encerrado boolean)
language sql stable security invoker set search_path = public as $$
  select x.contrato_id, max(x.unidades), max(x.locatario), sum(x.orcado), sum(x.recebido), round(sum(x.saldo), 2),
         string_agg(to_char(x.mes, 'MM/YYYY'), ', ' order by x.mes) filter (where x.saldo > 2),
         bool_or(x.encerrado)
  from loc_conferencia(p_edificio, p_ano) x
  group by x.contrato_id
  having sum(x.saldo) > 2
$$;
grant execute on function public.loc_em_aberto(uuid,int) to authenticated;