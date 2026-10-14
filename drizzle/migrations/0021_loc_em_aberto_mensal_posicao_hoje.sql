drop function if exists public.loc_em_aberto_mensal(uuid, int);
create function public.loc_em_aberto_mensal(p_edificio uuid, p_ano int)
returns table (mes date, em_aberto numeric, em_aberto_acumulado numeric)
language sql stable security invoker set search_path = public as $$
  with c as (
    select contrato_id, mes, saldo, encerrado,
           sum(saldo) over (partition by contrato_id order by mes) as cum,
           last_value(mes) over (partition by contrato_id order by mes rows between unbounded preceding and unbounded following) as ult
    from loc_conferencia(p_edificio, p_ano)
  ),
  t as (
    select contrato_id, case when cum < 10 then 0 else cum end as aberto
    from c where mes = ult and not encerrado
  ),
  d as (
    select c.contrato_id, c.mes, case when c.saldo >= 10 then c.saldo else 0 end as deb, t.aberto
    from c join t using (contrato_id)
  ),
  x as (
    select contrato_id, mes, aberto,
           least(deb, greatest(0, aberto - coalesce(sum(deb) over (partition by contrato_id order by mes
                 rows between 1 following and unbounded following), 0))) as aberto_mes,
           row_number() over (partition by contrato_id order by (deb > 0) desc, mes desc) as rn
    from d
  ),
  y as (
    select contrato_id, mes,
           aberto_mes + case when rn = 1 then aberto - sum(aberto_mes) over (partition by contrato_id) else 0 end as v
    from x
  ),
  m as (select mes, round(sum(greatest(v, 0)), 2) as em_aberto from y group by mes)
  select mes, em_aberto, sum(em_aberto) over (order by mes) from m order by mes
$$;
grant execute on function public.loc_em_aberto_mensal(uuid, int) to authenticated;