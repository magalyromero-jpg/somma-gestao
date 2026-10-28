alter table public.loc_boletos add column if not exists outra_receita text;
alter table public.loc_pagador_vinculo add column if not exists outra_receita text;
alter table public.loc_pagador_vinculo alter column contrato_id drop not null;
alter table public.loc_pagador_vinculo drop constraint if exists loc_pagador_vinculo_destino;
alter table public.loc_pagador_vinculo add constraint loc_pagador_vinculo_destino
  check ((contrato_id is not null) <> (outra_receita is not null));

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
                 round(b.valor_titulo * 0.01 * (b.data_pagamento - b.data_vencimento) / 30.0, 2)) as multa,
       b.outra_receita
from public.loc_boletos b
where b.status = 'paga' and b.data_pagamento is not null
  and b.valor_pago - b.valor_titulo > 0.005 and b.data_pagamento > b.data_vencimento;

create or replace function public.loc_importar_boletos(p_edificio uuid, p_boletos jsonb, p_arquivo text)
returns jsonb language plpgsql security invoker set search_path to 'public' as $$
declare r jsonb; v_ctr uuid; v_outra text; n_novos int := 0; n_atual int := 0; n_sem int := 0; v_existe boolean; n_cands int;
begin
  if not loc_eh_admin(p_edificio) then raise exception 'Sem permissão'; end if;
  for r in select * from jsonb_array_elements(p_boletos) loop
    v_ctr := null; v_outra := null;
    select contrato_id, outra_receita into v_ctr, v_outra
      from loc_pagador_vinculo where edificio_id = p_edificio and documento = r->>'documento';
    if v_ctr is null and v_outra is null then
      select count(*) into n_cands from loc_contratos c join loc_locatarios l on l.id = c.locatario_id
        where c.edificio_id = p_edificio and l.documento = r->>'documento' and c.status in ('ativo','em_renovacao','inadimplente');
      if n_cands = 0 then
        select c.id into v_ctr from loc_contratos c join loc_locatarios l on l.id = c.locatario_id
          where c.edificio_id = p_edificio and l.documento = r->>'documento' order by c.data_inicio desc nulls last limit 1;
      elsif n_cands = 1 then
        select c.id into v_ctr from loc_contratos c join loc_locatarios l on l.id = c.locatario_id
          where c.edificio_id = p_edificio and l.documento = r->>'documento' and c.status in ('ativo','em_renovacao','inadimplente');
      else
        select p.contrato_id into v_ctr
          from loc_previsto_caixa(p_edificio, extract(year from (r->>'data_vencimento')::date)::int) p
          join loc_contratos c on c.id = p.contrato_id join loc_locatarios l on l.id = c.locatario_id
         where l.documento = r->>'documento' and p.mes = date_trunc('month', (r->>'data_vencimento')::date)::date
         order by abs(p.valor - (r->>'valor_titulo')::numeric) limit 1;
      end if;
    end if;
    if v_ctr is null and v_outra is null then n_sem := n_sem + 1; end if;
    select exists(select 1 from loc_boletos where edificio_id = p_edificio and nosso_numero = r->>'nosso_numero') into v_existe;
    insert into loc_boletos (edificio_id, nosso_numero, pagador, documento, contrato_id, outra_receita, data_emissao, data_vencimento,
                             data_pagamento, data_baixa, valor_titulo, valor_pago, status, arquivo_origem, atualizado_em)
    values (p_edificio, r->>'nosso_numero', r->>'pagador', r->>'documento', v_ctr, v_outra,
            nullif(r->>'data_emissao','')::date, (r->>'data_vencimento')::date, nullif(r->>'data_pagamento','')::date,
            nullif(r->>'data_baixa','')::date, (r->>'valor_titulo')::numeric, coalesce((r->>'valor_pago')::numeric,0),
            r->>'status', p_arquivo, now())
    on conflict (edificio_id, nosso_numero) do update set
       pagador = excluded.pagador, documento = excluded.documento,
       contrato_id = coalesce(loc_boletos.contrato_id, excluded.contrato_id),
       outra_receita = coalesce(loc_boletos.outra_receita, excluded.outra_receita),
       data_emissao = excluded.data_emissao, data_vencimento = excluded.data_vencimento,
       data_pagamento = excluded.data_pagamento, data_baixa = excluded.data_baixa,
       valor_titulo = excluded.valor_titulo, valor_pago = excluded.valor_pago, status = excluded.status,
       arquivo_origem = excluded.arquivo_origem, atualizado_em = now();
    if v_existe then n_atual := n_atual + 1; else n_novos := n_novos + 1; end if;
  end loop;
  return jsonb_build_object('novos', n_novos, 'atualizados', n_atual, 'sem_vinculo', n_sem);
end $$;

create or replace function public.loc_vincular_pagador(p_edificio uuid, p_documento text, p_contrato uuid, p_outra text)
returns int language plpgsql security invoker set search_path to 'public' as $$
declare n int;
begin
  if not loc_eh_admin(p_edificio) then raise exception 'Sem permissão'; end if;
  if (p_contrato is null) = (p_outra is null) then raise exception 'Informe um contrato ou uma outra receita'; end if;
  insert into loc_pagador_vinculo (edificio_id, documento, contrato_id, outra_receita)
  values (p_edificio, p_documento, p_contrato, p_outra)
  on conflict (edificio_id, documento) do update set contrato_id = excluded.contrato_id, outra_receita = excluded.outra_receita;
  update loc_boletos set contrato_id = p_contrato, outra_receita = p_outra
   where edificio_id = p_edificio and documento = p_documento;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.loc_planejamento_outras(p_edificio uuid, p_ano int)
returns table(outra_receita text, mes date, emitido numeric, em_aberto numeric, pago numeric)
language sql stable security invoker set search_path to 'public' as $$
  select b.outra_receita, date_trunc('month', b.data_vencimento)::date,
         coalesce(sum(b.valor_titulo) filter (where b.status = 'a_vencer'), 0),
         coalesce(sum(b.valor_titulo) filter (where b.status = 'vencida'), 0),
         coalesce(sum(b.valor_titulo) filter (where b.status = 'paga'), 0)
    from loc_boletos b
   where b.edificio_id = p_edificio and b.outra_receita is not null
     and extract(year from b.data_vencimento) = p_ano
   group by 1, 2;
$$;