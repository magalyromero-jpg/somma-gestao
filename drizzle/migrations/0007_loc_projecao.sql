create table public.loc_projecao_indices (
  ano int not null, indice text not null, valor numeric not null, boletim date not null,
  primary key (ano, indice)
);
grant select on public.loc_projecao_indices to authenticated;
grant insert, update, delete on public.loc_projecao_indices to authenticated;
grant all on public.loc_projecao_indices to service_role;
alter table public.loc_projecao_indices enable row level security;
create policy loc_projecao_indices_sel on public.loc_projecao_indices for select to authenticated using (true);
create policy loc_projecao_indices_adm on public.loc_projecao_indices for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

insert into public.loc_projecao_indices (ano, indice, valor, boletim) values
 (2026,'IPCA',5.01,'2026-10-05'),(2027,'IPCA',4.30,'2026-10-05'),(2028,'IPCA',3.80,'2026-10-05'),(2029,'IPCA',3.51,'2026-10-05'),
 (2026,'IGPM',5.27,'2026-10-05'),(2027,'IGPM',4.11,'2026-10-05'),(2028,'IGPM',3.94,'2026-10-05'),(2029,'IGPM',3.80,'2026-10-05')
on conflict do nothing;

create table public.loc_projecao_regras (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null,
  contrato_id uuid not null,
  renovacao_em date not null,
  valor_renovacao numeric not null,
  observacao text
);
grant select, insert, update, delete on public.loc_projecao_regras to authenticated;
grant all on public.loc_projecao_regras to service_role;
alter table public.loc_projecao_regras enable row level security;
create policy loc_projecao_regras_sel on public.loc_projecao_regras for select to authenticated using (public.loc_pode_ver(edificio_id));
create policy loc_projecao_regras_adm on public.loc_projecao_regras for all to authenticated
  using (public.loc_eh_admin(edificio_id)) with check (public.loc_eh_admin(edificio_id));

insert into public.loc_projecao_regras (edificio_id, contrato_id, renovacao_em, valor_renovacao, observacao) values
 ('294d5d1d-a463-5721-98c8-ec1de1652929','5fea33a8-5351-5e52-9d23-00faaea9760d','2027-07-01',25600,'Relocação'),
 ('294d5d1d-a463-5721-98c8-ec1de1652929','76488e19-358a-5e61-812f-9ccf0e88797f','2026-11-18',5500,'Renovação');