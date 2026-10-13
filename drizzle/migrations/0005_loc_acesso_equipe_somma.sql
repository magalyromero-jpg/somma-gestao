create or replace function loc_pode_ver(p_edificio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor')
    or exists (select 1 from loc_acessos a where a.user_id = auth.uid() and a.edificio_id = p_edificio);
$$;
create or replace function loc_eh_admin(p_edificio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor')
    or exists (select 1 from loc_acessos a where a.user_id = auth.uid() and a.edificio_id = p_edificio and a.papel = 'admin');
$$;
drop policy if exists loc_locatarios_all on loc_locatarios;
create policy loc_locatarios_all on loc_locatarios for all
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or exists (select 1 from loc_acessos a where a.user_id = auth.uid() and a.papel = 'admin'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or exists (select 1 from loc_acessos a where a.user_id = auth.uid() and a.papel = 'admin'));