alter table loc_vigencia_degraus add column if not exists no_orcamento boolean not null default true;
alter table loc_contratos add column if not exists fim_reforecast date;
alter table loc_contratos add column if not exists debito_alugueis numeric(14,2);

create or replace function loc_valor_orcado_em(p_contrato uuid, p_ref date)
returns numeric language sql stable security invoker set search_path = public as $$
  with m as (select date_trunc('month', p_ref)::date as ini, (date_trunc('month', p_ref) + interval '1 month - 1 day')::date as fim_m),
  alvo as (
    select v.* from loc_vigencias v, m
    where v.contrato_id = p_contrato and v.no_orcamento and v.inicio <= m.fim_m
    order by (v.fim >= m.ini) desc, v.seq desc limit 1),
  ok as (select (select fim from alvo) >= (select ini from m) as vigente,
                (select status::text from loc_contratos where id = p_contrato) as st)
  select case when (select vigente from ok) or (select st from ok) <> 'encerrado' then
    coalesce(
      (select d.valor_mensal from loc_vigencia_degraus d where d.vigencia_id = (select id from alvo) and d.no_orcamento
         and d.a_partir <= (select ini from m) order by d.a_partir desc limit 1),
      (select valor_mensal from alvo)) end;
$$;

create or replace function loc_previsto_caixa(p_edificio uuid, p_ano int)
returns table (contrato_id uuid, mes date, valor numeric)
language sql stable security invoker set search_path = public as $$
  select c.id, g.m::date,
         case when c.fim_reforecast is not null and r.ref > date_trunc('month', c.fim_reforecast)::date then 0
              else round(coalesce(loc_valor_em(c.id, r.ref), 0) * (1 - c.retencao_pct/100), 2) end
  from loc_contratos c
  cross join generate_series(make_date(p_ano,1,1), make_date(p_ano,12,1), interval '1 month') as g(m)
  cross join lateral (select case when c.competencia = 'posterior' then (g.m - interval '1 month')::date else g.m::date end as ref) r
  where c.edificio_id = p_edificio and c.tipo = 'locacao';
$$;

create or replace view loc_v_encerrados with (security_invoker = true) as
select c.edificio_id, c.id as contrato_id, l.nome as locatario,
       (select string_agg(u.nome, ' + ' order by u.nome) from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
         where cu.contrato_id = c.id and u.tipo <> 'garagem') as unidades,
       c.data_saida, c.motivo_encerramento, c.data_em_pauta, c.debito_condominio,
       coalesce(c.debito_alugueis,
         greatest(0, coalesce((select sum(o.valor) from loc_previsto_caixa(c.edificio_id, extract(year from c.data_saida)::int) o
                               where o.contrato_id = c.id and o.mes <= (date_trunc('month', c.data_saida) + interval '1 month')::date), 0)
                   - coalesce((select sum(p.valor_liquido) from loc_pagamentos p
                               where p.contrato_id = c.id and p.data_pagamento >= date_trunc('year', c.data_saida)), 0))) as alugueis_em_aberto
from loc_contratos c join loc_locatarios l on l.id = c.locatario_id
where (c.data_saida is not null or c.status = 'encerrado') and (c.debito_alugueis is not null or c.conferir_recebimento);
grant select on loc_v_encerrados to authenticated;

create or replace view loc_v_mudancas_ano with (security_invoker = true) as
select c.edificio_id, c.id as contrato_id,
       (select string_agg(u.nome, ' + ' order by u.nome) from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
         where cu.contrato_id = c.id and u.tipo <> 'garagem') as unidades,
       lc.nome as locatario,
       case when v.seq = 0 then 'Contrato novo' else 'Aditivo' end as tipo,
       coalesce(to_date(substring(d.storage_path from '/(\d{4}\.\d{2}\.\d{2})_'), 'YYYY.MM.DD'), v.inicio) as data_decisao,
       v.inicio, v.valor_mensal, v.observacao
from loc_vigencias v
join loc_contratos c on c.id = v.contrato_id
left join loc_documentos d on d.id = v.documento_id
left join loc_v_locatarios_cliente lc on lc.id = c.locatario_id and lc.edificio_id = c.edificio_id
where not v.no_orcamento;
grant select on loc_v_mudancas_ano to authenticated;