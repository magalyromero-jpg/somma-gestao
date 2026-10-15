create or replace function public.loc_em_aberto(p_edificio uuid, p_ano int)
returns table (contrato_id uuid, unidades text, locatario text, previsto numeric, recebido numeric, saldo numeric,
               competencias text, encerrado boolean)
language sql stable security invoker set search_path = public as $$
  with f as (
    select m.contrato_id, string_agg(to_char(m.mes, 'MM/YYYY'), ', ' order by m.mes) as comp
    from loc_em_aberto_mensal_contrato(p_edificio, p_ano) m
    where m.em_aberto > 0.004
    group by m.contrato_id
  )
  select x.contrato_id, max(x.unidades), max(x.locatario), sum(x.previsto), sum(x.recebido), round(sum(x.saldo), 2),
         case when bool_or(x.encerrado) then string_agg(to_char(x.mes, 'MM/YYYY'), ', ' order by x.mes) filter (where x.saldo > 2)
              else coalesce(max(f.comp), string_agg(to_char(x.mes, 'MM/YYYY'), ', ' order by x.mes) filter (where x.saldo > 2)) end,
         bool_or(x.encerrado)
  from loc_conferencia(p_edificio, p_ano) x
  left join f on f.contrato_id = x.contrato_id
  group by x.contrato_id
  having sum(x.saldo) > 2
$$;
grant execute on function public.loc_em_aberto(uuid, int) to authenticated;