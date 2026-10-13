create or replace function public.loc_definir_acesso(p_edificio uuid, p_user uuid, p_papel text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'sem permissão'; end if;
  if p_papel not in ('admin','cliente') then raise exception 'papel inválido'; end if;
  insert into public.loc_acessos (user_id, edificio_id, papel) values (p_user, p_edificio, p_papel)
  on conflict (user_id, edificio_id) do update set papel = excluded.papel;
end $$;

create or replace function public.loc_acessos_do_usuario(p_user uuid)
returns table(edificio_id uuid, papel text) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'sem permissão'; end if;
  return query select a.edificio_id, a.papel from public.loc_acessos a where a.user_id = p_user;
end $$;

revoke execute on function public.loc_definir_acesso(uuid, uuid, text) from public, anon;
revoke execute on function public.loc_acessos_do_usuario(uuid) from public, anon;
grant execute on function public.loc_definir_acesso(uuid, uuid, text) to authenticated;
grant execute on function public.loc_acessos_do_usuario(uuid) to authenticated;