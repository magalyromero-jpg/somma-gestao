create table if not exists loc_iptu (
  edificio_id uuid not null references loc_edificios(id),
  ano int not null,
  unidade text not null,
  locatario text,
  forma text not null check (forma in ('avista','parcelado','sem_registro','proprio')),
  valor_sala numeric(14,2),
  valor_garagem numeric(14,2),
  pago_em date,
  observacao text,
  primary key (edificio_id, ano, unidade)
);
create table if not exists loc_iptu_parcelas (
  edificio_id uuid not null references loc_edificios(id),
  ano int not null,
  unidade text not null,
  parcela int not null check (parcela between 1 and 10),
  pago_em date,
  primary key (edificio_id, ano, unidade, parcela)
);
GRANT SELECT ON public.loc_iptu TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.loc_iptu TO authenticated;
GRANT ALL ON public.loc_iptu TO service_role;
GRANT SELECT ON public.loc_iptu_parcelas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.loc_iptu_parcelas TO authenticated;
GRANT ALL ON public.loc_iptu_parcelas TO service_role;
alter table loc_iptu enable row level security;
alter table loc_iptu_parcelas enable row level security;
drop policy if exists loc_iptu_all on loc_iptu; drop policy if exists loc_iptu_sel on loc_iptu;
create policy loc_iptu_all on loc_iptu using (loc_eh_admin(edificio_id)) with check (loc_eh_admin(edificio_id));
create policy loc_iptu_sel on loc_iptu for select using (loc_pode_ver(edificio_id));
drop policy if exists loc_iptu_parcelas_all on loc_iptu_parcelas; drop policy if exists loc_iptu_parcelas_sel on loc_iptu_parcelas;
create policy loc_iptu_parcelas_all on loc_iptu_parcelas using (loc_eh_admin(edificio_id)) with check (loc_eh_admin(edificio_id));
create policy loc_iptu_parcelas_sel on loc_iptu_parcelas for select using (loc_pode_ver(edificio_id));
create or replace function loc_iptu_marcar_parcela(p_edificio uuid, p_ano int, p_unidade text, p_parcela int, p_pago_em date)
returns void language plpgsql security invoker as $$
begin
  if not loc_eh_admin(p_edificio) then raise exception 'Sem permissão'; end if;
  insert into loc_iptu_parcelas (edificio_id, ano, unidade, parcela, pago_em) values (p_edificio, p_ano, p_unidade, p_parcela, p_pago_em)
  on conflict (edificio_id, ano, unidade, parcela) do update set pago_em = excluded.pago_em;
end $$;