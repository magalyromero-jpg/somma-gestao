do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='loc_documentos' and policyname='loc_documentos_leitura_todos') then
    execute $p$ create policy loc_documentos_leitura_todos on public.loc_documentos for select to authenticated using (public.loc_pode_ver(edificio_id)) $p$;
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='loc_docs_leitura_todos') then
    execute $p$ create policy loc_docs_leitura_todos on storage.objects for select to authenticated using (bucket_id = 'loc-docs' and public.loc_pode_ver(((storage.foldername(name))[1])::uuid)) $p$;
  end if;
end $$;