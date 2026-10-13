alter table loc_contratos
  add column if not exists data_inicio_vigente date,
  add column if not exists data_saida          date,
  add column if not exists data_em_pauta       date,
  add column if not exists motivo_encerramento text;

comment on column loc_contratos.data_assinatura is 'Assinatura do contrato original';
comment on column loc_contratos.data_inicio     is 'Início da locação original (1º dia do contrato original)';
comment on column loc_contratos.data_fim        is 'Fim do prazo em vigor (contrato original ou último aditivo)';

do $$ begin
  alter table loc_contratos add constraint loc_contratos_saida_ck
    check (data_saida is null or data_inicio is null or data_saida >= data_inicio);
exception when duplicate_object then null; end $$;

create or replace function loc_gerar_cronograma(p_contrato uuid, p_ate date default (current_date + interval '24 months')::date)
returns int language plpgsql security invoker set search_path = public as $$
declare c loc_contratos%rowtype; m date; v numeric; o text; n int := 0; v_ini date; v_fim date;
begin
  select * into c from loc_contratos where id = p_contrato;
  if not loc_eh_admin(c.edificio_id) then raise exception 'sem permissão'; end if;
  v_ini := date_trunc('month', c.data_inicio)::date;
  if c.competencia = 'posterior' then v_ini := (v_ini + interval '1 month')::date; end if;
  v_fim := least(coalesce(c.data_saida, c.data_fim, p_ate), p_ate);
  delete from loc_cronograma where contrato_id = p_contrato and origem <> 'manual';
  m := v_ini;
  while m <= date_trunc('month', v_fim)::date loop
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

create or replace view loc_v_ciclo with (security_invoker = true) as
select c.edificio_id, c.id as contrato_id, cu.unidade_id,
       c.data_inicio            as inicio_original,
       c.data_inicio_vigente    as inicio_vigencia_atual,
       c.data_fim               as fim_contrato,
       c.data_saida, c.data_em_pauta, c.motivo_encerramento,
       (c.data_fim - current_date) as dias_para_o_fim,
       case
         when c.data_saida is not null or c.status = 'encerrado' then
              case when c.data_em_pauta is not null then 'encerrado_em_pauta' else 'encerrado' end
         when c.data_fim is null                      then 'fim_a_informar'
         when c.data_fim < current_date               then 'vencido_sem_renovacao'
         when c.data_fim <= current_date + 120        then 'a_vencer_120d'
         when c.data_fim <= current_date + 365        then 'a_vencer_12m'
         else 'vigente' end as ciclo
from loc_contratos c
left join loc_contrato_unidades cu on cu.contrato_id = c.id;

create or replace view loc_v_ocupacao with (security_invoker = true) as
select u.edificio_id, u.id as unidade_id, u.nome, u.tipo, u.area_m2,
       case
         when exists (select 1 from loc_v_ciclo v where v.unidade_id = u.id
                      and v.ciclo not in ('encerrado','encerrado_em_pauta')) then 'locada'
         when exists (select 1 from loc_v_ciclo v where v.unidade_id = u.id
                      and v.ciclo = 'encerrado_em_pauta') then 'em_pauta'
         else 'vaga' end as situacao
from loc_unidades u
where not coalesce(u.fora_da_cobranca, false);

alter type loc_indice add value if not exists 'MEDIA';