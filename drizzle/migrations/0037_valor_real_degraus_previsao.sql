alter table public.loc_vigencia_degraus add column if not exists valor_real numeric(14,2);
comment on column public.loc_vigencia_degraus.valor_real is 'Valor exato com centavos usado só na previsão (Reforecast, Fluxo, Planejamento). Orçado nunca usa.';

create or replace function public.loc_valor_em(p_contrato uuid, p_ref date)
returns numeric language sql stable set search_path to 'public' as $$
  with v as (
    select * from loc_vigencias
    where contrato_id = p_contrato and inicio <= (date_trunc('month', p_ref) + interval '1 month - 1 day')::date
      and fim >= date_trunc('month', p_ref)::date
    order by seq desc limit 1)
  select coalesce(
    (select coalesce(d.valor_real, d.valor_mensal) from loc_vigencia_degraus d where d.vigencia_id = (select id from v)
       and d.a_partir <= date_trunc('month', p_ref)::date order by d.a_partir desc limit 1),
    (select valor_mensal from v));
$$;

-- Degraus fora do Orçado gravados com centavos (ex.: leitura de documentos) guardam o valor exato em valor_real.
create or replace function public.loc_degrau_valor_real() returns trigger language plpgsql set search_path to 'public' as $$
begin
  if not new.no_orcamento then
    if tg_op = 'INSERT' and new.valor_real is null then
      new.valor_real := new.valor_mensal;
    elsif tg_op = 'UPDATE' and new.valor_mensal is distinct from old.valor_mensal
          and new.valor_real is not distinct from old.valor_real then
      new.valor_real := new.valor_mensal;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_loc_degrau_valor_real on public.loc_vigencia_degraus;
create trigger trg_loc_degrau_valor_real before insert or update on public.loc_vigencia_degraus
for each row execute function public.loc_degrau_valor_real();

-- Reajuste confirmado como aplicado grava o valor exato no degrau do mesmo contrato e aniversário.
create or replace function public.loc_reajuste_valor_real() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare vid uuid;
begin
  if new.status = 'aplicado' and new.valor_aplicado is not null then
    select id into vid from loc_vigencias where contrato_id = new.contrato_id
      and inicio <= new.aniversario and fim >= new.aniversario order by seq desc limit 1;
    if vid is null then return new; end if;
    if exists (select 1 from loc_vigencia_degraus where vigencia_id = vid and a_partir = new.aniversario) then
      update loc_vigencia_degraus set valor_real = new.valor_aplicado where vigencia_id = vid and a_partir = new.aniversario;
    else
      insert into loc_vigencia_degraus(vigencia_id, a_partir, valor_mensal, origem, no_orcamento, valor_real)
      values (vid, new.aniversario, round(new.valor_aplicado), 'reajuste', false, new.valor_aplicado);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_loc_reajuste_valor_real on public.loc_reajustes;
create trigger trg_loc_reajuste_valor_real after insert or update of status, valor_aplicado on public.loc_reajustes
for each row execute function public.loc_reajuste_valor_real();