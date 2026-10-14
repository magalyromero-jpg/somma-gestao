create or replace function loc_reforecast_vs_orcado(p_edificio uuid, p_ano int)
returns table (contrato_id uuid, unidades text, locatario text, mes date, orcado numeric, reforecast numeric, diferenca numeric)
language sql stable security invoker set search_path = public as $$
  with r as (select * from loc_previsto_caixa(p_edificio, p_ano)),
       o as (select * from loc_orcado_caixa(p_edificio, p_ano)),
       k as (select contrato_id, mes from r union select contrato_id, mes from o)
  select k.contrato_id,
         (select string_agg(u.nome, ' + ' order by u.nome) from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
           where cu.contrato_id = k.contrato_id and u.tipo <> 'garagem'),
         (select lc.nome from loc_contratos c join loc_v_locatarios_cliente lc on lc.id = c.locatario_id where c.id = k.contrato_id limit 1),
         k.mes, coalesce(o.valor,0), coalesce(r.valor,0), coalesce(r.valor,0) - coalesce(o.valor,0)
  from k left join r using (contrato_id, mes) left join o using (contrato_id, mes)
$$;
grant execute on function loc_reforecast_vs_orcado(uuid, int) to authenticated;