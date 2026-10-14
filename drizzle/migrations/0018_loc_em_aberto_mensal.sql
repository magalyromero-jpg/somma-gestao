create or replace function public.loc_em_aberto_mensal(p_edificio uuid, p_ano int)
returns table (mes date, em_aberto_acumulado numeric, novo_em_aberto numeric, regularizado numeric)
language sql stable security invoker set search_path = public as $$
  with c as (
    select contrato_id, mes,
           case when sum(saldo) over (partition by contrato_id order by mes) < 10 then 0 else sum(saldo) over (partition by contrato_id order by mes) end as acum
    from public.loc_conferencia(p_edificio, p_ano) where not encerrado
  ),
  m as (select mes, round(sum(acum), 2) as acum from c group by mes)
  select mes, acum,
         greatest(0, acum - coalesce(lag(acum) over (order by mes), 0)),
         greatest(0, coalesce(lag(acum) over (order by mes), 0) - acum)
  from m order by mes
$$;
grant execute on function public.loc_em_aberto_mensal(uuid, int) to authenticated;