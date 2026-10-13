alter table loc_unidades
  add column if not exists matricula text,
  add column if not exists area_privativa_m2 numeric(10,2),
  add column if not exists area_total_m2 numeric(10,4);

alter table loc_contratos add column if not exists retencao_pct numeric(5,2) not null default 0;
alter table loc_contratos add column if not exists mes_reajuste int check (mes_reajuste between 1 and 12);

create table if not exists loc_vigencias (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references loc_edificios(id) on delete cascade,
  contrato_id uuid not null references loc_contratos(id) on delete cascade,
  seq int not null,
  tipo text not null check (tipo in ('contrato','aditivo')),
  data_documento date,
  inicio date not null,
  fim date not null,
  valor_mensal numeric(14,2) not null,
  area_contrato_m2 numeric(10,2),
  indice loc_indice not null default 'NENHUM',
  mes_reajuste int check (mes_reajuste between 1 and 12),
  documento_id uuid references loc_documentos(id),
  observacao text,
  created_at timestamptz default now(),
  unique (contrato_id, seq),
  check (fim >= inicio)
);
create index if not exists loc_vig_contrato on loc_vigencias (contrato_id, inicio);

create table if not exists loc_vigencia_degraus (
  vigencia_id uuid not null references loc_vigencias(id) on delete cascade,
  a_partir date not null,
  valor_mensal numeric(14,2) not null,
  origem text not null default 'degrau' check (origem in ('degrau','reajuste','acordo')),
  primary key (vigencia_id, a_partir)
);

alter table loc_vigencias enable row level security;
drop policy if exists loc_vigencias_sel on loc_vigencias;
drop policy if exists loc_vigencias_all on loc_vigencias;
create policy loc_vigencias_sel on loc_vigencias for select using (loc_pode_ver(edificio_id));
create policy loc_vigencias_all on loc_vigencias for all using (loc_eh_admin(edificio_id)) with check (loc_eh_admin(edificio_id));

alter table loc_vigencia_degraus enable row level security;
drop policy if exists loc_degraus_sel on loc_vigencia_degraus;
drop policy if exists loc_degraus_all on loc_vigencia_degraus;
create policy loc_degraus_sel on loc_vigencia_degraus for select
  using (exists (select 1 from loc_vigencias v where v.id = vigencia_id and loc_pode_ver(v.edificio_id)));
create policy loc_degraus_all on loc_vigencia_degraus for all
  using (exists (select 1 from loc_vigencias v where v.id = vigencia_id and loc_eh_admin(v.edificio_id)))
  with check (exists (select 1 from loc_vigencias v where v.id = vigencia_id and loc_eh_admin(v.edificio_id)));

create or replace function loc_valor_em(p_contrato uuid, p_ref date)
returns numeric language sql stable security invoker set search_path = public as $$
  with v as (
    select * from loc_vigencias
    where contrato_id = p_contrato and inicio <= (date_trunc('month', p_ref) + interval '1 month - 1 day')::date
      and fim >= date_trunc('month', p_ref)::date
    order by seq desc limit 1)
  select coalesce(
    (select d.valor_mensal from loc_vigencia_degraus d where d.vigencia_id = (select id from v)
       and d.a_partir <= date_trunc('month', p_ref)::date order by d.a_partir desc limit 1),
    (select valor_mensal from v));
$$;

create or replace view loc_v_contrato_vigente with (security_invoker = true) as
select c.edificio_id, c.id as contrato_id,
       (select string_agg(u.nome, ' + ' order by u.nome) from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
         where cu.contrato_id = c.id and u.tipo <> 'garagem') as unidades,
       (select string_agg(u.matricula, ' / ' order by u.nome) from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
         where cu.contrato_id = c.id and u.tipo <> 'garagem') as matriculas,
       v.seq as vigencia_seq, v.inicio, v.fim, v.indice, v.mes_reajuste,
       loc_valor_em(c.id, current_date) as valor_vigente,
       v.area_contrato_m2,
       (select sum(u.area_privativa_m2) from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
         where cu.contrato_id = c.id and u.tipo <> 'garagem') as area_matricula_m2,
       round(loc_valor_em(c.id, current_date) /
         nullif((select sum(u.area_privativa_m2) from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
                  where cu.contrato_id = c.id and u.tipo <> 'garagem'), 0), 2) as rs_m2_matricula
from loc_contratos c
left join lateral (select * from loc_vigencias v where v.contrato_id = c.id and v.inicio <= current_date
                   order by v.seq desc limit 1) v on true
where c.status in ('ativo','em_renovacao','inadimplente');

create or replace view loc_v_metragem with (security_invoker = true) as
select edificio_id, contrato_id, unidades, matriculas, area_contrato_m2, area_matricula_m2,
       round(area_contrato_m2 - area_matricula_m2, 2) as diferenca_m2
from loc_v_contrato_vigente;

create or replace function loc_orcado_caixa(p_edificio uuid, p_ano int)
returns table (contrato_id uuid, mes date, valor numeric)
language sql stable security invoker set search_path = public as $$
  select c.id, g.m::date,
         round(coalesce(loc_valor_em(c.id,
               case when c.competencia = 'posterior' then (g.m - interval '1 month')::date else g.m::date end), 0)
               * (1 - c.retencao_pct/100), 2)
  from loc_contratos c
  cross join generate_series(make_date(p_ano,1,1), make_date(p_ano,12,1), interval '1 month') as g(m)
  where c.edificio_id = p_edificio and c.tipo = 'locacao';
$$;

create or replace view loc_v_evolucao with (security_invoker = true) as
select c.edificio_id, c.id as contrato_id,
       v0.inicio as inicio_inicial, v0.valor_mensal as aluguel_inicial,
       (select count(*) from loc_vigencias x where x.contrato_id = c.id and x.tipo = 'aditivo') > 0 as tem_aditivo,
       (select min(inicio) from loc_vigencias x where x.contrato_id = c.id and x.tipo = 'aditivo') as inicio_aditivo,
       vv.fim as fim_vigente,
       loc_valor_em(c.id, current_date) as aluguel_atual,
       round((loc_valor_em(c.id, current_date) / nullif(v0.valor_mensal,0) - 1) * 100, 1) as variacao_pct,
       case when vv.fim < current_date then 'vencido'
            when vv.fim < current_date + interval '180 days' then 'vence em até 180 dias'
            else 'vigente' end as status
from loc_contratos c
join loc_vigencias v0 on v0.contrato_id = c.id and v0.seq = 0
left join lateral (select * from loc_vigencias v where v.contrato_id = c.id order by seq desc limit 1) vv on true;

create or replace function loc_indice_12m(p_indice loc_indice, p_mes date) returns numeric
language sql stable security invoker set search_path = public as $$
  select case when p_indice = 'MEDIA'
    then (select avg(acumulado_12m) from loc_indices where indice in ('IPCA','IGPM') and mes = p_mes having count(*) = 2)
    else (select acumulado_12m from loc_indices where indice = p_indice and mes = p_mes) end;
$$;

do $$ declare t text; begin
  foreach t in array array['loc_edificios','loc_unidades','loc_locatarios','loc_contratos','loc_contratos_notas','loc_contrato_unidades',
    'loc_codigos_lidderar','loc_aditivos','loc_documentos','loc_indices','loc_reajustes','loc_cronograma','loc_novas_locacoes',
    'loc_importacoes','loc_pagamentos','loc_acessos','loc_parametros_cenario','loc_vigencias','loc_vigencia_degraus']
  loop
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('grant all on %I to service_role', t);
  end loop;
  foreach t in array array['loc_v_cobranca','loc_v_auditoria_reajuste','loc_v_alerta_reajuste','loc_v_ciclo','loc_v_ocupacao',
    'loc_v_contrato_vigente','loc_v_metragem','loc_v_evolucao','loc_v_locatarios_cliente']
  loop
    execute format('grant select on %I to authenticated', t);
    execute format('grant select on %I to service_role', t);
  end loop;
end $$;