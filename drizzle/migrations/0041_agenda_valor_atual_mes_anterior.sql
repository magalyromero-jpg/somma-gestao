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
       coalesce(k.reg_valor,
                case when k.status_final = 'realizado' and k.tipo <> 'renovacao'
                     then loc_valor_em(k.contrato_id, (date_trunc('month', k.data_evento) + interval '1 month')::date) end) as valor_novo,
       k.reg_obs as observacao, k.documento_id, k.registrado_em
  from cls k
  cross join lateral (select loc_valor_em(k.contrato_id, (date_trunc('month', k.data_evento) - interval '1 month')::date) as valor) va
  left join lateral (select * from loc_calcular_reajuste(k.contrato_id, k.data_evento, va.valor)
                      where k.tipo = 'reajuste' and k.status_final <> 'realizado' and va.valor is not null) r on true;