create or replace function public.loc_evolucao_rsm2(p_edificio uuid, p_inicio date, p_fim date)
returns table(grupo text, mes date, contratos int, area_m2 numeric, aluguel numeric, rs_m2 numeric, projetado boolean)
language sql stable security invoker set search_path to 'public' as $$
  with base as (
    select c.id, c.data_saida,
           case when exists (select 1 from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
                              where cu.contrato_id = c.id and u.nome ilike 'Loja%') then 'Lojas' else 'Salas' end as grupo,
           (select sum(u.area_privativa_m2) from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
             where cu.contrato_id = c.id and u.tipo <> 'garagem') as area
      from loc_contratos c
      where c.edificio_id = p_edificio and c.tipo = 'locacao'),
  meses as (select g::date as mes from generate_series(date_trunc('month', p_inicio)::date, date_trunc('month', p_fim)::date, interval '1 month') g)
  select b.grupo, m.mes, count(*)::int, round(sum(b.area), 2), round(sum(loc_valor_em(b.id, m.mes)), 2),
         round(sum(loc_valor_em(b.id, m.mes)) / nullif(sum(b.area), 0), 2),
         m.mes > date_trunc('month', current_date)::date
    from base b cross join meses m
   where b.area > 0 and loc_valor_em(b.id, m.mes) > 0
     and (b.data_saida is null or b.data_saida >= m.mes)
   group by b.grupo, m.mes
   order by b.grupo, m.mes;
$$;
revoke execute on function public.loc_evolucao_rsm2(uuid,date,date) from public, anon;
grant execute on function public.loc_evolucao_rsm2(uuid,date,date) to authenticated, service_role;
create or replace function public.loc_composicao_aluguel(p_edificio uuid)
returns table(contrato_id uuid, unidades text, locatario text, grupo text, data date, categoria text, valor numeric)
language sql stable security invoker set search_path to 'public' as $$
  with ctr as (
    select c.id, c.data_saida,
           (select string_agg(u.nome, ' + ' order by u.nome) from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
             where cu.contrato_id = c.id and u.tipo <> 'garagem') as unidades,
           (select v0.valor_mensal from loc_vigencias v0 where v0.contrato_id = c.id and v0.seq = 0) as inicial,
           coalesce(loc_valor_em(c.id, date_trunc('month', current_date)::date), 0) as atual,
           (select max(v.fim) from loc_vigencias v where v.contrato_id = c.id) as fim_contrato
      from loc_contratos c where c.edificio_id = p_edificio and c.tipo = 'locacao'),
  ev as (
    select v.contrato_id, v.inicio as data, 'Aditivos e Renovações'::text as categoria, v.valor_mensal as novo, v.seq as s2, 1 as ordem
      from loc_vigencias v where v.seq > 0
    union all
    select v.contrato_id, d.a_partir,
           case d.origem when 'reajuste' then 'Reajuste por Índice' when 'acordo' then 'Acordos' else 'Aditivos e Renovações' end,
           coalesce(d.valor_real, d.valor_mensal), v.seq, 2
      from loc_vigencia_degraus d join loc_vigencias v on v.id = d.vigencia_id),
  seq as (select e.*, lag(novo) over (partition by contrato_id order by data, s2, ordem) as ant from ev e where data <= current_date),
  mov as (
    select s.contrato_id, s.data, s.categoria, s.novo - coalesce(s.ant, c.inicial) as delta
      from seq s join ctr c on c.id = s.contrato_id where c.inicial is not null),
  soma as (select contrato_id, coalesce(sum(delta), 0) as d from mov group by 1),
  resto as (
    select c.id as contrato_id, c.atual - c.inicial - coalesce(s.d, 0) as r,
           coalesce(c.data_saida, least(c.fim_contrato + 1, current_date)) as data
      from ctr c left join soma s on s.contrato_id = c.id where c.inicial is not null)
  select c.id, c.unidades, (select l.nome from loc_contratos x join loc_locatarios l on l.id = x.locatario_id where x.id = c.id),
         case when c.unidades ilike 'Loja%' then 'Lojas' else 'Salas' end, m.data, m.categoria, round(m.delta, 2)
    from mov m join ctr c on c.id = m.contrato_id where abs(m.delta) > 0.005
  union all
  select c.id, c.unidades, (select l.nome from loc_contratos x join loc_locatarios l on l.id = x.locatario_id where x.id = c.id),
         case when c.unidades ilike 'Loja%' then 'Lojas' else 'Salas' end, r.data, 'Saídas', round(r.r, 2)
     from resto r join ctr c on c.id = r.contrato_id where abs(r.r) > 0.005
  union all
  select c.id, c.unidades, (select l.nome from loc_contratos x join loc_locatarios l on l.id = x.locatario_id where x.id = c.id),
         case when c.unidades ilike 'Loja%' then 'Lojas' else 'Salas' end, null::date, 'Base', c.inicial
    from ctr c where c.inicial is not null
  order by 4, 5 nulls first;
$$;
revoke execute on function public.loc_composicao_aluguel(uuid) from public, anon;
grant execute on function public.loc_composicao_aluguel(uuid) to authenticated, service_role;