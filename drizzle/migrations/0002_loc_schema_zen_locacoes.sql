create extension if not exists pgcrypto;

do $$ begin
  create type loc_indice        as enum ('IGPM','IPCA','FIXO','NENHUM');
  create type loc_status        as enum ('rascunho','ativo','em_renovacao','inadimplente','encerrado');
  create type loc_competencia   as enum ('posterior','antecipada');
  create type loc_tipo_contrato as enum ('locacao','eventual','repasse');
  create type loc_doc_tipo      as enum ('contrato','aditivo','distrato','vistoria','garantia','boleto','comunicado','outro');
exception when duplicate_object then null; end $$;

create table if not exists loc_edificios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo_id uuid,
  created_at timestamptz default now()
);

create table if not exists loc_unidades (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references loc_edificios(id) on delete cascade,
  nome text not null,
  tipo text not null default 'sala' check (tipo in ('sala','loja','garagem','area_comum')),
  andar int,
  area_m2 numeric(10,2),
  fora_da_cobranca boolean default false,
  unique (edificio_id, nome)
);

create table if not exists loc_locatarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  emails text[] default '{}',
  telefone text
);

create table if not exists loc_contratos (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references loc_edificios(id) on delete cascade,
  locatario_id uuid not null references loc_locatarios(id),
  tipo loc_tipo_contrato not null default 'locacao',
  status loc_status not null default 'rascunho',
  data_assinatura date,
  data_inicio date,
  data_fim date,
  dia_vencimento int check (dia_vencimento between 1 and 31),
  competencia loc_competencia not null default 'posterior',
  indice loc_indice not null default 'NENHUM',
  periodicidade_meses int not null default 12,
  mes_aniversario date,
  piso_zero boolean not null default true,
  valor_inicial numeric(14,2) not null,
  carencia_meses int not null default 0,
  contrato_anterior_id uuid references loc_contratos(id),
  created_at timestamptz default now()
);

create table if not exists loc_contratos_notas (
  contrato_id uuid primary key references loc_contratos(id) on delete cascade,
  edificio_id uuid not null references loc_edificios(id),
  nota text
);

create table if not exists loc_contrato_unidades (
  contrato_id uuid references loc_contratos(id) on delete cascade,
  unidade_id uuid references loc_unidades(id),
  edificio_id uuid not null references loc_edificios(id),
  primary key (contrato_id, unidade_id)
);

create table if not exists loc_codigos_lidderar (
  edificio_id uuid not null references loc_edificios(id),
  codigo text not null,
  nome_no_lidderar text,
  contrato_id uuid references loc_contratos(id),
  primary key (edificio_id, codigo)
);

create table if not exists loc_aditivos (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references loc_edificios(id),
  contrato_id uuid not null references loc_contratos(id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('reajuste','reducao','prorrogacao','inclusao_unidade','exclusao_unidade','carencia','outro')),
  descricao text,
  valor_novo numeric(14,2),
  vigencia_inicio date,
  vigencia_fim date
);

create table if not exists loc_documentos (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references loc_edificios(id),
  contrato_id uuid references loc_contratos(id) on delete cascade,
  unidade_id uuid references loc_unidades(id),
  tipo loc_doc_tipo not null default 'contrato',
  titulo text not null,
  storage_path text not null,
  visivel_cliente boolean not null default true,
  revisado boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists loc_indices (
  indice loc_indice not null,
  mes date not null,
  variacao_mensal numeric(8,4),
  acumulado_12m numeric(8,4) not null,
  fonte text,
  primary key (indice, mes)
);

create table if not exists loc_reajustes (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references loc_edificios(id),
  contrato_id uuid not null references loc_contratos(id) on delete cascade,
  aniversario date not null,
  indice loc_indice not null,
  mes_referencia date,
  percentual numeric(8,4),
  valor_anterior numeric(14,2) not null,
  valor_calculado numeric(14,2),
  valor_aplicado numeric(14,2),
  vigencia_a_partir date not null,
  status text not null default 'previsto' check (status in ('previsto','calculado','aprovado','aplicado','divergente')),
  estimado boolean not null default false,
  observacao text,
  unique (contrato_id, aniversario)
);

create table if not exists loc_cronograma (
  edificio_id uuid not null references loc_edificios(id),
  contrato_id uuid not null references loc_contratos(id) on delete cascade,
  competencia date not null,
  valor_previsto numeric(14,2) not null,
  origem text not null check (origem in ('contratual','carencia','pro_rata','reajuste','reajuste_estimado','manual')),
  primary key (contrato_id, competencia)
);

create table if not exists loc_novas_locacoes (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references loc_edificios(id),
  unidade_id uuid references loc_unidades(id),
  descricao text,
  inicio_previsto date not null,
  carencia_meses int not null default 0,
  valor_mensal numeric(14,2) not null,
  probabilidade numeric(4,2) not null default 0.5 check (probabilidade between 0 and 1),
  ativa boolean not null default true
);

create table if not exists loc_importacoes (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references loc_edificios(id),
  arquivo text,
  linhas int, novas int, duplicadas int, sem_mapeamento int,
  criado_por uuid default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists loc_pagamentos (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references loc_edificios(id),
  importacao_id uuid references loc_importacoes(id),
  codigo text not null,
  imovel_nome text,
  data_vencimento date not null,
  data_pagamento date not null,
  valor_bruto numeric(14,2),
  valor_liquido numeric(14,2) not null,
  contrato_id uuid references loc_contratos(id),
  competencia date generated always as (data_vencimento - (extract(day from data_vencimento)::int - 1)) stored,
  dias_atraso int generated always as (greatest(0, data_pagamento - data_vencimento)) stored,
  chave text not null,
  unique (edificio_id, chave)
);
create index if not exists loc_pag_contrato_comp on loc_pagamentos (contrato_id, competencia);
create index if not exists loc_pag_data on loc_pagamentos (edificio_id, data_pagamento);

create table if not exists loc_acessos (
  user_id uuid not null references auth.users(id) on delete cascade,
  edificio_id uuid not null references loc_edificios(id) on delete cascade,
  papel text not null check (papel in ('admin','cliente')),
  primary key (user_id, edificio_id)
);

create table if not exists loc_parametros_cenario (
  cenario text primary key check (cenario in ('conservador','base','otimista')),
  usa_novas_locacoes boolean not null,
  fator_prob_novas numeric(4,2) not null,
  recup_0_30 numeric(4,2) not null,
  recup_31_90 numeric(4,2) not null,
  recup_90_mais numeric(4,2) not null
);

create or replace function loc_pode_ver(p_edificio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from loc_acessos a where a.user_id = auth.uid() and a.edificio_id = p_edificio);
$$;
create or replace function loc_eh_admin(p_edificio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from loc_acessos a where a.user_id = auth.uid() and a.edificio_id = p_edificio and a.papel = 'admin');
$$;

do $$
declare t text;
begin
  foreach t in array array['loc_unidades','loc_contratos','loc_contrato_unidades','loc_codigos_lidderar','loc_aditivos',
                           'loc_reajustes','loc_cronograma','loc_novas_locacoes','loc_importacoes','loc_pagamentos']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_sel', t);
    execute format('drop policy if exists %I on %I', t||'_all', t);
    execute format('create policy %I on %I for select using (loc_pode_ver(edificio_id))', t||'_sel', t);
    execute format('create policy %I on %I for all using (loc_eh_admin(edificio_id)) with check (loc_eh_admin(edificio_id))', t||'_all', t);
  end loop;
end $$;

alter table loc_edificios enable row level security;
drop policy if exists loc_edificios_sel on loc_edificios;
create policy loc_edificios_sel on loc_edificios for select using (loc_pode_ver(id));
drop policy if exists loc_edificios_all on loc_edificios;
create policy loc_edificios_all on loc_edificios for all using (loc_eh_admin(id)) with check (loc_eh_admin(id));

alter table loc_documentos enable row level security;
drop policy if exists loc_documentos_sel on loc_documentos;
create policy loc_documentos_sel on loc_documentos for select
  using (loc_eh_admin(edificio_id) or (loc_pode_ver(edificio_id) and visivel_cliente and revisado));
drop policy if exists loc_documentos_all on loc_documentos;
create policy loc_documentos_all on loc_documentos for all using (loc_eh_admin(edificio_id)) with check (loc_eh_admin(edificio_id));

alter table loc_locatarios enable row level security;
drop policy if exists loc_locatarios_sel on loc_locatarios;
drop policy if exists loc_locatarios_all on loc_locatarios;
create policy loc_locatarios_all on loc_locatarios for all
  using (exists (select 1 from loc_acessos a where a.user_id = auth.uid() and a.papel = 'admin'))
  with check (exists (select 1 from loc_acessos a where a.user_id = auth.uid() and a.papel = 'admin'));

alter table loc_contratos_notas enable row level security;
drop policy if exists loc_notas_all on loc_contratos_notas;
create policy loc_notas_all on loc_contratos_notas for all using (loc_eh_admin(edificio_id)) with check (loc_eh_admin(edificio_id));

create or replace view loc_v_locatarios_cliente as
select distinct l.id, l.nome, c.edificio_id
from loc_locatarios l join loc_contratos c on c.locatario_id = l.id
where loc_pode_ver(c.edificio_id);
grant select on loc_v_locatarios_cliente to authenticated;

alter table loc_indices enable row level security;
drop policy if exists loc_indices_sel on loc_indices;
create policy loc_indices_sel on loc_indices for select using (auth.uid() is not null);
alter table loc_parametros_cenario enable row level security;
drop policy if exists loc_param_sel on loc_parametros_cenario;
create policy loc_param_sel on loc_parametros_cenario for select using (auth.uid() is not null);

alter table loc_acessos enable row level security;
drop policy if exists loc_acessos_sel on loc_acessos;
create policy loc_acessos_sel on loc_acessos for select using (user_id = auth.uid());

drop policy if exists loc_docs_read on storage.objects;
create policy loc_docs_read on storage.objects for select using (
  bucket_id = 'loc-docs' and loc_pode_ver(((storage.foldername(name))[1])::uuid)
);
drop policy if exists loc_docs_write on storage.objects;
create policy loc_docs_write on storage.objects for all using (
  bucket_id = 'loc-docs' and loc_eh_admin(((storage.foldername(name))[1])::uuid)
) with check (
  bucket_id = 'loc-docs' and loc_eh_admin(((storage.foldername(name))[1])::uuid)
);

create or replace function loc_importar_pagamentos(p_edificio uuid, p_arquivo text, p_linhas jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  r record; v_imp uuid; v_chave text; v_contrato uuid; v_ins int;
  n_total int := 0; n_novas int := 0; n_dup int := 0; n_sem int := 0;
  v_sem jsonb := '[]'::jsonb;
begin
  if not loc_eh_admin(p_edificio) then raise exception 'sem permissão'; end if;
  insert into loc_importacoes (edificio_id, arquivo) values (p_edificio, p_arquivo) returning id into v_imp;

  for r in
    select x.*, row_number() over (partition by x.codigo, x.vencimento, x.pagamento, x.bruto, x.liquido order by x.ord) as ocorrencia
    from jsonb_to_recordset(p_linhas) with ordinality
         as x(codigo text, imovel text, vencimento date, pagamento date, bruto numeric, liquido numeric, ord bigint)
  loop
    n_total := n_total + 1;
    v_chave := md5(concat_ws('|', r.codigo, r.vencimento, r.pagamento, coalesce(r.bruto,0), r.liquido, r.ocorrencia));
    select contrato_id into v_contrato from loc_codigos_lidderar where edificio_id = p_edificio and codigo = r.codigo;
    if v_contrato is null then
      n_sem := n_sem + 1;
      v_sem := v_sem || to_jsonb(r.codigo || ' — ' || coalesce(r.imovel,''));
      insert into loc_codigos_lidderar (edificio_id, codigo, nome_no_lidderar) values (p_edificio, r.codigo, r.imovel)
        on conflict do nothing;
    end if;
    insert into loc_pagamentos (edificio_id, importacao_id, codigo, imovel_nome, data_vencimento, data_pagamento, valor_bruto, valor_liquido, contrato_id, chave)
      values (p_edificio, v_imp, r.codigo, r.imovel, r.vencimento, r.pagamento, r.bruto, r.liquido, v_contrato, v_chave)
      on conflict (edificio_id, chave) do nothing;
    get diagnostics v_ins = row_count;
    if v_ins = 1 then n_novas := n_novas + 1; else n_dup := n_dup + 1; end if;
  end loop;

  update loc_importacoes set linhas = n_total, novas = n_novas, duplicadas = n_dup, sem_mapeamento = n_sem where id = v_imp;
  return jsonb_build_object('importacao', v_imp, 'linhas', n_total, 'novas', n_novas, 'duplicadas', n_dup,
                            'sem_mapeamento', n_sem, 'codigos_para_mapear', v_sem);
end $$;

create or replace function loc_remapear_pagamentos(p_edificio uuid) returns int
language sql security invoker set search_path = public as $$
  with u as (
    update loc_pagamentos p set contrato_id = c.contrato_id
    from loc_codigos_lidderar c
    where p.edificio_id = p_edificio and c.edificio_id = p_edificio and c.codigo = p.codigo
      and c.contrato_id is not null and p.contrato_id is distinct from c.contrato_id
    returning 1)
  select count(*)::int from u;
$$;

create or replace function loc_calcular_reajuste(p_contrato uuid, p_aniversario date, p_valor_anterior numeric)
returns table (mes_referencia date, percentual numeric, valor_calculado numeric, vigencia_a_partir date, estimado boolean)
language plpgsql stable security invoker set search_path = public as $$
declare c loc_contratos%rowtype; v_ref date; v_pct numeric; v_est boolean := false;
begin
  select * into c from loc_contratos where id = p_contrato;
  v_ref := (date_trunc('month', p_aniversario) - interval '1 month')::date;
  if c.indice in ('IGPM','IPCA') then
    select acumulado_12m into v_pct from loc_indices where indice = c.indice and mes = v_ref;
    if v_pct is null then
      select acumulado_12m into v_pct from loc_indices where indice = c.indice order by mes desc limit 1;
      v_est := true;
    end if;
    if c.piso_zero and v_pct < 0 then v_pct := 0; end if;
  else
    v_pct := 0; v_est := true;
  end if;
  return query select v_ref, v_pct, round(p_valor_anterior * (1 + coalesce(v_pct,0)/100), 2),
    case when c.competencia = 'posterior' then (date_trunc('month', p_aniversario) + interval '1 month')::date
         else date_trunc('month', p_aniversario)::date end, v_est;
end $$;

create or replace function loc_gerar_cronograma(p_contrato uuid, p_ate date default (current_date + interval '24 months')::date)
returns int language plpgsql security invoker set search_path = public as $$
declare c loc_contratos%rowtype; m date; v numeric; o text; n int := 0; rj record; v_ini date;
begin
  select * into c from loc_contratos where id = p_contrato;
  if not loc_eh_admin(c.edificio_id) then raise exception 'sem permissão'; end if;
  v_ini := date_trunc('month', c.data_inicio)::date;
  if c.competencia = 'posterior' then v_ini := (v_ini + interval '1 month')::date; end if;
  delete from loc_cronograma where contrato_id = p_contrato and origem <> 'manual';
  m := v_ini;
  while m <= date_trunc('month', coalesce(c.data_fim, p_ate))::date and m <= p_ate loop
    select coalesce(valor_aplicado, valor_calculado), (case when estimado then 'reajuste_estimado' else 'reajuste' end)
      into v, o
      from loc_reajustes where contrato_id = p_contrato and vigencia_a_partir <= m
      order by vigencia_a_partir desc limit 1;
    if v is null then v := c.valor_inicial; o := 'contratual'; end if;
    if m < (v_ini + make_interval(months => c.carencia_meses))::date then v := 0; o := 'carencia'; end if;
    insert into loc_cronograma (edificio_id, contrato_id, competencia, valor_previsto, origem)
      values (c.edificio_id, p_contrato, m, v, o) on conflict (contrato_id, competencia) do nothing;
    n := n + 1; m := (m + interval '1 month')::date;
  end loop;
  return n;
end $$;

create or replace view loc_v_cobranca with (security_invoker = true) as
select cr.edificio_id, cr.contrato_id, cr.competencia, cr.valor_previsto,
       coalesce(pg.pago,0) as valor_pago, cr.valor_previsto - coalesce(pg.pago,0) as saldo,
       pg.ultimo_pagamento, pg.max_atraso,
       case
         when cr.valor_previsto = 0 then 'sem_cobranca'
         when cr.valor_previsto - coalesce(pg.pago,0) <= 0.5 then case when coalesce(pg.max_atraso,0) > 3 then 'pago_com_atraso' else 'pago' end
         when cr.competencia > date_trunc('month', current_date)::date then 'a_vencer'
         else 'em_aberto' end as situacao,
       greatest(0, current_date - (cr.competencia + interval '4 days')::date) as dias_em_aberto
from loc_cronograma cr
left join (select contrato_id, competencia, sum(valor_liquido) pago, max(data_pagamento) ultimo_pagamento, max(dias_atraso) max_atraso
           from loc_pagamentos group by 1,2) pg
  on pg.contrato_id = cr.contrato_id and pg.competencia = cr.competencia;

create or replace function loc_fluxo(p_edificio uuid, p_cenario text default 'base', p_ate date default (current_date + interval '18 months')::date)
returns table (competencia date, previsto_contratual numeric, novas_locacoes numeric, atraso_recuperado numeric,
               total_projetado numeric, realizado_caixa numeric, diferenca numeric)
language sql stable security invoker set search_path = public as $$
  with prm as (select * from loc_parametros_cenario where cenario = p_cenario),
  meses as (select generate_series(date '2025-10-01', date_trunc('month', p_ate)::date, interval '1 month')::date as m),
  contr as (select cr.competencia m, sum(cr.valor_previsto) v from loc_cronograma cr
            where cr.edificio_id = p_edificio group by 1),
  novas as (select g.m::date as m, sum(n.valor_mensal * n.probabilidade * prm.fator_prob_novas) v
            from loc_novas_locacoes n cross join prm
            join lateral generate_series((n.inicio_previsto + make_interval(months => n.carencia_meses))::date,
                                         p_ate, interval '1 month') as g(m) on true
            where n.edificio_id = p_edificio and n.ativa and prm.usa_novas_locacoes group by 1),
  atraso as (select (date_trunc('month', current_date) + interval '1 month')::date m,
                    sum(b.saldo * case when b.dias_em_aberto <= 30 then prm.recup_0_30
                                       when b.dias_em_aberto <= 90 then prm.recup_31_90 else prm.recup_90_mais end) v
             from loc_v_cobranca b cross join prm
             where b.edificio_id = p_edificio and b.situacao = 'em_aberto' and b.saldo > 0),
  real as (select date_trunc('month', data_pagamento)::date m, sum(valor_liquido) v
           from loc_pagamentos where edificio_id = p_edificio group by 1)
  select meses.m,
         coalesce(contr.v,0), coalesce(novas.v,0), coalesce(atraso.v,0),
         coalesce(contr.v,0) + coalesce(novas.v,0) + coalesce(atraso.v,0),
         real.v,
         case when real.v is not null then real.v - (coalesce(contr.v,0)) end
  from meses left join contr on contr.m = meses.m left join novas on novas.m = meses.m
             left join atraso on atraso.m = meses.m left join real on real.m = meses.m
  order by meses.m;
$$;

create or replace view loc_v_auditoria_reajuste with (security_invoker = true) as
select r.edificio_id, r.contrato_id, r.aniversario, r.indice, r.mes_referencia, r.percentual,
       r.valor_anterior, r.valor_calculado, r.valor_aplicado,
       r.valor_aplicado - r.valor_calculado as diferenca,
       case when r.valor_aplicado is null then 'pendente'
            when abs(r.valor_aplicado - r.valor_calculado) <= 1.00 then 'ok'
            else 'divergente' end as parecer,
       r.vigencia_a_partir, r.estimado
from loc_reajustes r;

create or replace view loc_v_alerta_reajuste with (security_invoker = true) as
select c.edificio_id, c.id as contrato_id, c.indice,
       (c.data_assinatura + make_interval(months => 11 + 12 * k))::date as gatilho,
       (c.data_assinatura + make_interval(months => 12 + 12 * k))::date as aniversario
from loc_contratos c, generate_series(0, 4) k
where c.status in ('ativo','em_renovacao') and c.data_assinatura is not null
  and (c.data_assinatura + make_interval(months => 12 + 12 * k)) >= current_date - interval '1 month'
  and (c.data_assinatura + make_interval(months => 11 + 12 * k)) <= current_date + interval '6 months';