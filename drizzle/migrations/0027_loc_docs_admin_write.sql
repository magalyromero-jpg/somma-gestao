do $$
begin
  if to_regclass('storage.objects') is not null then
    if not exists (select 1 from pg_policies where schemaname='storage'
                   and tablename='objects' and policyname='loc_docs_admin_update') then
      execute $p$
        create policy loc_docs_admin_update on storage.objects
        for update to authenticated
        using (bucket_id='loc-docs'
               and public.loc_eh_admin(((storage.foldername(name))[1])::uuid))
        with check (bucket_id='loc-docs'
               and public.loc_eh_admin(((storage.foldername(name))[1])::uuid))
      $p$;
    end if;
    if not exists (select 1 from pg_policies where schemaname='storage'
                   and tablename='objects' and policyname='loc_docs_admin_delete') then
      execute $p$
        create policy loc_docs_admin_delete on storage.objects
        for delete to authenticated
        using (bucket_id='loc-docs'
               and public.loc_eh_admin(((storage.foldername(name))[1])::uuid))
      $p$;
    end if;
  end if;

  if to_regclass('public.loc_documentos') is not null then
    if not exists (select 1 from pg_policies where schemaname='public'
                   and tablename='loc_documentos' and policyname='loc_documentos_admin_update') then
      execute $p$
        create policy loc_documentos_admin_update on public.loc_documentos
        for update to authenticated
        using (public.loc_eh_admin(edificio_id))
        with check (public.loc_eh_admin(edificio_id))
      $p$;
    end if;
    if not exists (select 1 from pg_policies where schemaname='public'
                   and tablename='loc_documentos' and policyname='loc_documentos_admin_delete') then
      execute $p$
        create policy loc_documentos_admin_delete on public.loc_documentos
        for delete to authenticated
        using (public.loc_eh_admin(edificio_id))
      $p$;
    end if;
  end if;

  if to_regclass('public.loc_vigencias') is not null then
    if not exists (select 1 from pg_policies where schemaname='public'
                   and tablename='loc_vigencias' and policyname='loc_vigencias_admin_update') then
      execute $p$
        create policy loc_vigencias_admin_update on public.loc_vigencias
        for update to authenticated
        using (public.loc_eh_admin(edificio_id))
        with check (public.loc_eh_admin(edificio_id))
      $p$;
    end if;
  end if;

  if to_regclass('public.loc_documentos_esperados') is not null then
    if not exists (select 1 from pg_policies where schemaname='public'
                   and tablename='loc_documentos_esperados' and policyname='loc_documentos_esperados_admin_update') then
      execute $p$
        create policy loc_documentos_esperados_admin_update on public.loc_documentos_esperados
        for update to authenticated
        using (public.loc_eh_admin(edificio_id))
        with check (public.loc_eh_admin(edificio_id))
      $p$;
    end if;
  end if;
end $$;