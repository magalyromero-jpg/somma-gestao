create table if not exists public.loc_documentos_esperados (
  id uuid primary key default gen_random_uuid(),
  edificio_id uuid not null references public.loc_edificios(id),
  contrato_id uuid references public.loc_contratos(id) on delete cascade,
  grupo text not null default 'contrato' check (grupo in ('contrato','aditivo','garagem','encerramento','outro')),
  descricao text not null,
  data_ref date,
  situacao text not null default 'necessario' check (situacao in ('necessario','a_confirmar')),
  detalhe text,
  documento_id uuid references public.loc_documentos(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists loc_doc_esp_contrato on public.loc_documentos_esperados (contrato_id);
create unique index if not exists loc_doc_esp_documento on public.loc_documentos_esperados (documento_id) where documento_id is not null;
alter table public.loc_documentos_esperados enable row level security;
drop policy if exists loc_doc_esp_sel on public.loc_documentos_esperados;
drop policy if exists loc_doc_esp_all on public.loc_documentos_esperados;
create policy loc_doc_esp_sel on public.loc_documentos_esperados for select using (
  public.loc_eh_admin(edificio_id)
  or (public.loc_pode_ver(edificio_id) and exists (select 1 from public.loc_documentos d
        where d.id = documento_id and d.visivel_cliente and d.revisado)));
create policy loc_doc_esp_all on public.loc_documentos_esperados for all
  using (public.loc_eh_admin(edificio_id)) with check (public.loc_eh_admin(edificio_id));
grant select on public.loc_documentos_esperados to authenticated;
grant all on public.loc_documentos_esperados to service_role;