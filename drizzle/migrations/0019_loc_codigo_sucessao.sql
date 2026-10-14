create table if not exists public.loc_codigo_sucessao (
  edificio_id uuid not null references public.loc_edificios(id) on delete cascade,
  codigo text not null,
  a_partir_vencimento date not null,
  contrato_id uuid not null references public.loc_contratos(id) on delete cascade,
  primary key (edificio_id, codigo, a_partir_vencimento)
);
grant select, insert, update, delete on public.loc_codigo_sucessao to authenticated;
grant all on public.loc_codigo_sucessao to service_role;
alter table public.loc_codigo_sucessao enable row level security;
drop policy if exists loc_codigo_sucessao_admin on public.loc_codigo_sucessao;
create policy loc_codigo_sucessao_admin on public.loc_codigo_sucessao for all to authenticated
  using (public.loc_eh_admin(edificio_id)) with check (public.loc_eh_admin(edificio_id));

create or replace function public.loc_aplicar_sucessao() returns trigger language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select s.contrato_id into v from loc_codigo_sucessao s
   where s.edificio_id = new.edificio_id and s.codigo = new.codigo and s.a_partir_vencimento <= new.data_vencimento
   order by s.a_partir_vencimento desc limit 1;
  if v is not null then new.contrato_id := v; end if;
  return new;
end $$;
drop trigger if exists loc_pagamentos_sucessao on public.loc_pagamentos;
create trigger loc_pagamentos_sucessao before insert or update of codigo, data_vencimento on public.loc_pagamentos
  for each row execute function public.loc_aplicar_sucessao();

create or replace function public.loc_remapear_pagamentos(p_edificio uuid) returns int
language sql security invoker set search_path = public as $$
  with u as (
    update loc_pagamentos p set contrato_id = c.contrato_id
    from loc_codigos_lidderar c
    where p.edificio_id = p_edificio and c.edificio_id = p_edificio and c.codigo = p.codigo
      and c.contrato_id is not null and p.contrato_id is null
    returning 1)
  select count(*)::int from u;
$$;