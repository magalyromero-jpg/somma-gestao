alter table public.loc_contratos add column if not exists recebe_por_boleto boolean not null default true;
update public.loc_contratos c set recebe_por_boleto = false
  from public.loc_locatarios l where l.id = c.locatario_id and (l.nome ilike 'Município de Itajaí%' or l.nome ilike 'Bradesco%');

create table if not exists public.loc_boletos (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references public.loc_edificios(id),
  nosso_numero text not null,
  pagador text not null,
  documento text,
  contrato_id uuid references public.loc_contratos(id),
  data_emissao date,
  data_vencimento date not null,
  data_pagamento date,
  data_baixa date,
  valor_titulo numeric(14,2) not null,
  valor_pago numeric(14,2) not null default 0,
  status text not null check (status in ('paga','a_vencer','vencida','cancelada')),
  arquivo_origem text,
  atualizado_em timestamptz not null default now(),
  unique (edificio_id, nosso_numero)
);
create index if not exists loc_boletos_venc on public.loc_boletos (edificio_id, data_vencimento);
create index if not exists loc_boletos_pgto on public.loc_boletos (edificio_id, data_pagamento);

create table if not exists public.loc_pagador_vinculo (
  edificio_id uuid not null references public.loc_edificios(id),
  documento text not null,
  contrato_id uuid not null references public.loc_contratos(id),
  primary key (edificio_id, documento)
);

grant select, insert, update, delete on public.loc_boletos to authenticated;
grant all on public.loc_boletos to service_role;
grant select, insert, update, delete on public.loc_pagador_vinculo to authenticated;
grant all on public.loc_pagador_vinculo to service_role;

alter table public.loc_boletos enable row level security;
alter table public.loc_pagador_vinculo enable row level security;
create policy loc_boletos_all on public.loc_boletos to authenticated using (public.loc_eh_admin(edificio_id)) with check (public.loc_eh_admin(edificio_id));
create policy loc_boletos_sel on public.loc_boletos for select to authenticated using (public.loc_pode_ver(edificio_id));
create policy loc_pagador_vinculo_all on public.loc_pagador_vinculo to authenticated using (public.loc_eh_admin(edificio_id)) with check (public.loc_eh_admin(edificio_id));
create policy loc_pagador_vinculo_sel on public.loc_pagador_vinculo for select to authenticated using (public.loc_pode_ver(edificio_id));

create or replace view public.loc_v_boleto_encargos with (security_invoker = true) as
select b.id, b.edificio_id, b.contrato_id, b.nosso_numero, b.pagador, b.data_vencimento, b.data_pagamento,
       date_trunc('month', b.data_pagamento)::date as competencia,
       b.valor_titulo, b.valor_pago,
       (b.data_pagamento - b.data_vencimento) as dias_atraso,
       round(b.valor_pago - b.valor_titulo, 2) as acrescimo,
       least(round(b.valor_pago - b.valor_titulo, 2),
             round(b.valor_titulo * 0.01 * (b.data_pagamento - b.data_vencimento) / 30.0, 2)) as juros,
       round(b.valor_pago - b.valor_titulo, 2)
         - least(round(b.valor_pago - b.valor_titulo, 2),
                 round(b.valor_titulo * 0.01 * (b.data_pagamento - b.data_vencimento) / 30.0, 2)) as multa
from public.loc_boletos b
where b.status = 'paga' and b.data_pagamento is not null
  and b.valor_pago - b.valor_titulo > 0.005 and b.data_pagamento > b.data_vencimento;
grant select on public.loc_v_boleto_encargos to authenticated;

create or replace function public.loc_importar_boletos(p_edificio uuid, p_boletos jsonb, p_arquivo text)
returns jsonb language plpgsql security invoker set search_path to 'public' as $$
declare r jsonb; v_ctr uuid; n_novos int := 0; n_atual int := 0; n_sem int := 0; v_existe boolean; n_cands int;
begin
  if not loc_eh_admin(p_edificio) then raise exception 'Sem permissão'; end if;
  for r in select * from jsonb_array_elements(p_boletos) loop
    v_ctr := null;
    select contrato_id into v_ctr from loc_pagador_vinculo where edificio_id = p_edificio and documento = r->>'documento';
    if v_ctr is null then
      select count(*) into n_cands from loc_contratos c join loc_locatarios l on l.id = c.locatario_id
        where c.edificio_id = p_edificio and l.documento = r->>'documento' and c.status in ('ativo','em_renovacao','inadimplente');
      if n_cands = 0 then
        select c.id into v_ctr from loc_contratos c join loc_locatarios l on l.id = c.locatario_id
          where c.edificio_id = p_edificio and l.documento = r->>'documento' order by c.data_inicio desc nulls last limit 1;
      elsif n_cands = 1 then
        select c.id into v_ctr from loc_contratos c join loc_locatarios l on l.id = c.locatario_id
          where c.edificio_id = p_edificio and l.documento = r->>'documento' and c.status in ('ativo','em_renovacao','inadimplente');
      elsif n_cands > 1 then
        select p.contrato_id into v_ctr
          from loc_previsto_caixa(p_edificio, extract(year from (r->>'data_vencimento')::date)::int) p
          join loc_contratos c on c.id = p.contrato_id join loc_locatarios l on l.id = c.locatario_id
         where l.documento = r->>'documento' and p.mes = date_trunc('month', (r->>'data_vencimento')::date)::date
         order by abs(p.valor - (r->>'valor_titulo')::numeric) limit 1;
      end if;
    end if;
    if v_ctr is null then n_sem := n_sem + 1; end if;
    select exists(select 1 from loc_boletos where edificio_id = p_edificio and nosso_numero = r->>'nosso_numero') into v_existe;
    insert into loc_boletos (edificio_id, nosso_numero, pagador, documento, contrato_id, data_emissao, data_vencimento,
                             data_pagamento, data_baixa, valor_titulo, valor_pago, status, arquivo_origem, atualizado_em)
    values (p_edificio, r->>'nosso_numero', r->>'pagador', r->>'documento', v_ctr,
            nullif(r->>'data_emissao','')::date, (r->>'data_vencimento')::date, nullif(r->>'data_pagamento','')::date,
            nullif(r->>'data_baixa','')::date, (r->>'valor_titulo')::numeric, coalesce((r->>'valor_pago')::numeric,0),
            r->>'status', p_arquivo, now())
    on conflict (edificio_id, nosso_numero) do update set
       pagador = excluded.pagador, documento = excluded.documento,
       contrato_id = coalesce(loc_boletos.contrato_id, excluded.contrato_id),
       data_emissao = excluded.data_emissao, data_vencimento = excluded.data_vencimento,
       data_pagamento = excluded.data_pagamento, data_baixa = excluded.data_baixa,
       valor_titulo = excluded.valor_titulo, valor_pago = excluded.valor_pago, status = excluded.status,
       arquivo_origem = excluded.arquivo_origem, atualizado_em = now();
    if v_existe then n_atual := n_atual + 1; else n_novos := n_novos + 1; end if;
  end loop;
  return jsonb_build_object('novos', n_novos, 'atualizados', n_atual, 'sem_vinculo', n_sem);
end $$;

create or replace function public.loc_planejamento_caixa(p_edificio uuid, p_ano int)
returns table(contrato_id uuid, mes date, previsto numeric, emitido numeric, em_aberto numeric, pago numeric, sem_boleto numeric, fora_boleto boolean)
language sql stable security invoker set search_path to 'public' as $$
  with prev as (select p.contrato_id, p.mes, p.valor from loc_previsto_caixa(p_edificio, p_ano) p),
  bol as (
    select b.contrato_id, date_trunc('month', b.data_vencimento)::date as mes,
           sum(b.valor_titulo) filter (where b.status = 'a_vencer') as emitido,
           sum(b.valor_titulo) filter (where b.status = 'vencida') as em_aberto,
           sum(b.valor_titulo) filter (where b.status = 'paga') as pago
      from loc_boletos b where b.edificio_id = p_edificio and b.contrato_id is not null group by 1,2),
  tem as (select c.id as contrato_id from loc_contratos c where c.edificio_id = p_edificio and not c.recebe_por_boleto)
  select coalesce(prev.contrato_id, bol.contrato_id), coalesce(prev.mes, bol.mes),
         coalesce(prev.valor,0), coalesce(bol.emitido,0), coalesce(bol.em_aberto,0), coalesce(bol.pago,0),
         case when tem.contrato_id is not null then 0 else greatest(coalesce(prev.valor,0) - coalesce(bol.emitido,0) - coalesce(bol.em_aberto,0) - coalesce(bol.pago,0), 0) end,
         tem.contrato_id is not null
    from prev full join bol on bol.contrato_id = prev.contrato_id and bol.mes = prev.mes
    left join tem on tem.contrato_id = coalesce(prev.contrato_id, bol.contrato_id)
   where extract(year from coalesce(prev.mes, bol.mes)) = p_ano;
$$;