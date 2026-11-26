create or replace view loc_v_agenda_contratos with (security_invoker = true) as
with base as (
  select c.id, c.edificio_id, c.indice, c.mes_aniversario, c.periodicidade_meses
    from loc_contratos c
   where c.status in ('ativo', 'em_renovacao') and c.data_saida is null),
ev as (
  select b.edificio_id, b.id as contrato_id, 'reajuste'::text as tipo, a.aniversario as data_evento, b.indice::text as indice
    from base b
    cross join lateral (select (b.mes_aniversario + make_interval(months => k * coalesce(nullif(b.periodicidade_meses, 0), 12)))::date as aniversario
                          from generate_series(-3, 3) k) a
   where b.indice in ('IPCA', 'IGPM', 'MEDIA') and b.mes_aniversario is not null
     and a.aniversario between date_trunc('year', current_date)::date and (current_date + interval '12 months')::date
  union all
  select b.edificio_id, b.id, 'degrau', d.a_partir, null
    from base b
    join loc_vigencias v on v.contrato_id = b.id
    join loc_vigencia_degraus d on d.vigencia_id = v.id
   where d.origem = 'degrau' and d.a_partir > date_trunc('month', v.inicio)::date
     and v.seq = (select max(v2.seq) from loc_vigencias v2 where v2.contrato_id = b.id)
     and d.a_partir between date_trunc('year', current_date)::date and (current_date + interval '12 months')::date
     and not (b.indice in ('IPCA', 'IGPM', 'MEDIA') and b.mes_aniversario is not null
              and extract(month from d.a_partir) = extract(month from b.mes_aniversario))
  union all
  select b.edificio_id, b.id, 'renovacao', v.fim, null
    from base b
    join loc_vigencias v on v.contrato_id = b.id
   where v.fim between date_trunc('year', current_date)::date and (current_date + interval '12 months')::date),
cls as (
  select e.*, g.id as registro_id, g.status as reg_status, g.valor_novo as reg_valor, g.observacao as reg_obs, g.documento_id,
         g.registrado_em,
         case
           when g.status is not null then g.status
           when e.tipo = 'reajuste' and (exists (select 1 from loc_reajustes r where r.contrato_id = e.contrato_id
                    and date_trunc('month', r.aniversario) = date_trunc('month', e.data_evento) and r.valor_aplicado is not null)
                 or exists (select 1 from loc_vigencias v where v.contrato_id = e.contrato_id and v.seq > 0
                    and date_trunc('month', v.inicio) = date_trunc('month', e.data_evento))) then 'realizado'
           when e.tipo = 'degrau' and e.data_evento <= current_date then 'realizado'
           when e.tipo = 'renovacao' and exists (select 1 from loc_vigencias v where v.contrato_id = e.contrato_id
                    and v.inicio > e.data_evento - 40 and v.fim > e.data_evento) then 'realizado'
           when e.data_evento < current_date then 'pendente'
           else 'a_vencer' end as status_final
    from ev e
    left join loc_agenda_contratos g on g.contrato_id = e.contrato_id and g.tipo = e.tipo and g.data_evento = e.data_evento)
select k.edificio_id, k.contrato_id, k.tipo, k.data_evento, k.status_final as status,
       (k.registro_id is not null) as registrado,
       (select string_agg(u.nome, ' + ' order by u.nome) from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
         where cu.contrato_id = k.contrato_id and u.tipo <> 'garagem') as unidades,
       (select l.nome from loc_contratos c join loc_locatarios l on l.id = c.locatario_id where c.id = k.contrato_id) as locatario,
       k.indice,
       va.valor as valor_atual,
       r.mes_referencia, r.percentual as percentual_sugerido, r.valor_calculado as valor_sugerido,
       coalesce(r.vigencia_a_partir, (date_trunc('month', k.data_evento))::date) as vigencia_sugerida,
       coalesce(r.estimado, false) as indice_estimado,
       coalesce(case when k.tipo = 'renovacao' and k.reg_status is distinct from 'realizado' then null else k.reg_valor end,
                case when k.status_final = 'realizado' and k.tipo <> 'renovacao'
                     then loc_valor_em(k.contrato_id, (date_trunc('month', k.data_evento) + interval '1 month')::date) end) as valor_novo,
       k.reg_obs as observacao, k.documento_id, k.registrado_em
  from cls k
  cross join lateral (select loc_valor_em(k.contrato_id, (date_trunc('month', k.data_evento) - interval '1 month')::date) as valor) va
  left join lateral (select * from loc_calcular_reajuste(k.contrato_id, k.data_evento, va.valor)
                      where k.tipo = 'reajuste' and k.status_final <> 'realizado' and va.valor is not null) r on true;

create or replace function loc_registrar_agenda(
  p_contrato uuid, p_tipo text, p_data_evento date, p_status text,
  p_valor_novo numeric default null, p_vigencia_a_partir date default null, p_nova_data_fim date default null,
  p_indice text default null, p_percentual numeric default null, p_documento uuid default null, p_observacao text default null)
returns void language plpgsql set search_path to 'public' as $$
declare c loc_contratos%rowtype; v_mes date := date_trunc('month', p_data_evento)::date; v_vig uuid;
begin
  select * into c from loc_contratos where id = p_contrato;
  if not found or not loc_eh_admin(c.edificio_id) then raise exception 'sem permissão'; end if;
  if p_status not in ('em_andamento', 'realizado', 'dispensado') then raise exception 'status inválido'; end if;
  if p_status = 'realizado' and p_tipo in ('reajuste', 'degrau') and (p_valor_novo is null or p_valor_novo <= 0) then
    raise exception 'informe o novo valor'; end if;
  insert into loc_agenda_contratos (edificio_id, contrato_id, tipo, data_evento, status, indice, percentual, valor_anterior, valor_novo,
                                    vigencia_a_partir, nova_data_fim, documento_id, observacao, registrado_por)
    values (c.edificio_id, p_contrato, p_tipo, p_data_evento, p_status, p_indice, p_percentual,
            loc_valor_em(p_contrato, (v_mes - interval '1 month')::date),
            case when p_tipo = 'renovacao' and p_status <> 'realizado' then null else p_valor_novo end, p_vigencia_a_partir, p_nova_data_fim,
            p_documento, p_observacao, auth.uid())
  on conflict (contrato_id, tipo, data_evento) do update
    set status = excluded.status, indice = excluded.indice, percentual = excluded.percentual, valor_novo = excluded.valor_novo,
        vigencia_a_partir = excluded.vigencia_a_partir, nova_data_fim = excluded.nova_data_fim,
        documento_id = coalesce(excluded.documento_id, loc_agenda_contratos.documento_id),
        observacao = excluded.observacao, registrado_por = excluded.registrado_por, registrado_em = now();
  if p_status = 'realizado' and p_tipo = 'reajuste' then
    perform loc_aplicar_reajuste(p_contrato, p_data_evento, p_valor_novo, p_observacao);
  elsif p_status = 'realizado' and p_tipo = 'degrau' then
    select v.id into v_vig from loc_vigencias v where v.contrato_id = p_contrato
       and v.inicio <= (v_mes + interval '1 month - 1 day')::date and v.fim >= v_mes order by v.seq desc limit 1;
    if v_vig is not null then
      update loc_vigencia_degraus set valor_real = p_valor_novo where vigencia_id = v_vig and a_partir = v_mes;
    end if;
  end if;
end $$;