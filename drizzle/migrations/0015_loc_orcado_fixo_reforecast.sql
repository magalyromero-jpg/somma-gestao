alter table public.loc_vigencias add column if not exists no_orcamento boolean not null default true;
alter table public.loc_contratos add column if not exists conferir_recebimento boolean not null default true;

create or replace function public.loc_valor_orcado_em(p_contrato uuid, p_ref date)
returns numeric language sql stable security invoker set search_path = public as $$
  with v as (
    select * from loc_vigencias
    where contrato_id = p_contrato and no_orcamento
      and inicio <= (date_trunc('month', p_ref) + interval '1 month - 1 day')::date
      and fim >= date_trunc('month', p_ref)::date
    order by seq desc limit 1)
  select coalesce(
    (select d.valor_mensal from loc_vigencia_degraus d where d.vigencia_id = (select id from v)
       and d.a_partir <= date_trunc('month', p_ref)::date order by d.a_partir desc limit 1),
    (select valor_mensal from v));
$$;

create or replace function public.loc_orcado_caixa(p_edificio uuid, p_ano int)
returns table (contrato_id uuid, mes date, valor numeric)
language sql stable security invoker set search_path = public as $$
  select c.id, g.m::date,
         round(coalesce(loc_valor_orcado_em(c.id,
               case when c.competencia = 'posterior' then (g.m - interval '1 month')::date else g.m::date end), 0)
               * (1 - c.retencao_pct/100), 2)
  from loc_contratos c
  cross join generate_series(make_date(p_ano,1,1), make_date(p_ano,12,1), interval '1 month') as g(m)
  where c.edificio_id = p_edificio and c.tipo = 'locacao' and c.no_orcamento;
$$;

create or replace function public.loc_previsto_caixa(p_edificio uuid, p_ano int)
returns table (contrato_id uuid, mes date, valor numeric)
language sql stable security invoker set search_path = public as $$
  select c.id, g.m::date,
         case when c.data_saida is not null and r.ref > date_trunc('month', c.data_saida)::date then 0
              else round(coalesce(loc_valor_em(c.id, r.ref), 0) * (1 - c.retencao_pct/100), 2) end
  from loc_contratos c
  cross join generate_series(make_date(p_ano,1,1), make_date(p_ano,12,1), interval '1 month') as g(m)
  cross join lateral (select case when c.competencia = 'posterior' then (g.m - interval '1 month')::date else g.m::date end as ref) r
  where c.edificio_id = p_edificio and c.tipo = 'locacao';
$$;
grant execute on function public.loc_valor_orcado_em(uuid,date), public.loc_previsto_caixa(uuid,int), public.loc_orcado_caixa(uuid,int) to authenticated;

drop function if exists public.loc_caixa_mensal(uuid, int);
drop function if exists public.loc_em_aberto(uuid, int);
drop function if exists public.loc_conferencia(uuid, int);

create function public.loc_conferencia(p_edificio uuid, p_ano int)
returns table (mes date, contrato_id uuid, unidades text, locatario text, previsto numeric, recebido numeric,
               pago_em date, saldo numeric, situacao text, encerrado boolean)
language sql stable security invoker set search_path = public as $$
  with lim as (select date_trunc('month', max(data_pagamento))::date as ate from loc_pagamentos where edificio_id = p_edificio),
  b as (
    select o.mes, o.contrato_id, o.valor as previsto,
           coalesce((select sum(p.valor_liquido) from loc_pagamentos p where p.contrato_id = o.contrato_id and p.competencia = o.mes), 0) as recebido,
           (select max(p.data_pagamento) from loc_pagamentos p where p.contrato_id = o.contrato_id and p.competencia = o.mes) as pago_em
    from loc_previsto_caixa(p_edificio, p_ano) o, lim
    where o.valor > 0 and o.mes <= lim.ate
  )
  select b.mes, b.contrato_id,
         (select string_agg(u.nome, ' + ' order by u.nome) from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
           where cu.contrato_id = b.contrato_id and u.tipo <> 'garagem'),
         lc.nome, b.previsto, b.recebido, b.pago_em,
         round(b.previsto - b.recebido, 2),
         case when b.previsto - b.recebido > 2 and b.recebido <= 2 then 'Em aberto'
              when b.previsto - b.recebido > 2 then 'Recebido parcialmente'
              when b.previsto - b.recebido < -2 then 'Recebido a maior'
              else 'Conforme' end,
         c.status = 'encerrado'
  from b join loc_contratos c on c.id = b.contrato_id and c.conferir_recebimento
  left join loc_v_locatarios_cliente lc on lc.id = c.locatario_id and lc.edificio_id = c.edificio_id
$$;

create function public.loc_caixa_mensal(p_edificio uuid, p_ano int)
returns table (mes date, orcado numeric, previsto_contratual numeric, recebido_da_competencia numeric, em_aberto numeric,
               em_aberto_encerrados numeric, recebido_a_maior numeric, outras_receitas numeric, entrou_no_caixa numeric,
               de_meses_anteriores numeric, recebido_no_mes_seguinte numeric)
language sql stable security invoker set search_path = public as $$
  with c as (select * from loc_conferencia(p_edificio, p_ano)),
  m as (select distinct mes from c)
  select m.mes,
    (select coalesce(sum(o.valor),0) from loc_orcado_caixa(p_edificio, p_ano) o where o.mes = m.mes),
    (select coalesce(sum(previsto),0) from c where c.mes = m.mes),
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

create function public.loc_em_aberto(p_edificio uuid, p_ano int)
returns table (contrato_id uuid, unidades text, locatario text, previsto numeric, recebido numeric, saldo numeric,
               competencias text, encerrado boolean)
language sql stable security invoker set search_path = public as $$
  select x.contrato_id, max(x.unidades), max(x.locatario), sum(x.previsto), sum(x.recebido), round(sum(x.saldo), 2),
         string_agg(to_char(x.mes, 'MM/YYYY'), ', ' order by x.mes) filter (where x.saldo > 2),
         bool_or(x.encerrado)
  from loc_conferencia(p_edificio, p_ano) x
  group by x.contrato_id
  having sum(x.saldo) > 2
$$;
grant execute on function public.loc_conferencia(uuid,int), public.loc_caixa_mensal(uuid,int), public.loc_em_aberto(uuid,int) to authenticated;

create or replace view public.loc_v_encerrados with (security_invoker = true) as
select c.edificio_id, c.id as contrato_id, l.nome as locatario,
       (select string_agg(u.nome, ' + ' order by u.nome) from public.loc_contrato_unidades cu join public.loc_unidades u on u.id = cu.unidade_id
         where cu.contrato_id = c.id and u.tipo <> 'garagem') as unidades,
       c.data_saida, c.motivo_encerramento, c.data_em_pauta, c.debito_condominio,
       greatest(0, coalesce((select sum(o.valor) from public.loc_previsto_caixa(c.edificio_id, extract(year from c.data_saida)::int) o
                             where o.contrato_id = c.id
                               and o.mes <= (date_trunc('month', c.data_saida) + interval '1 month')::date), 0)
                 - coalesce((select sum(p.valor_liquido) from public.loc_pagamentos p
                             where p.contrato_id = c.id and p.data_pagamento >= date_trunc('year', c.data_saida)), 0)) as alugueis_em_aberto
from public.loc_contratos c join public.loc_locatarios l on l.id = c.locatario_id
where (c.data_saida is not null or c.status = 'encerrado') and c.conferir_recebimento;
grant select on public.loc_v_encerrados to authenticated;