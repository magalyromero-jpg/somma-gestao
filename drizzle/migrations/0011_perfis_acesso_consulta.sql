create or replace function public.loc_eh_admin(p_edificio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'gestor'::app_role);
$$;
create or replace function public.loc_pode_ver(p_edificio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'gestor'::app_role)
      or public.has_role(auth.uid(), 'consulta'::app_role)
      or exists (select 1 from public.loc_acessos a where a.user_id = auth.uid() and a.edificio_id = p_edificio);
$$;
drop policy if exists loc_locatarios_all on public.loc_locatarios;
create policy loc_locatarios_all on public.loc_locatarios for all
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'gestor'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'gestor'::app_role));
drop policy if exists "Consulta le locatarios" on public.loc_locatarios;
create policy "Consulta le locatarios" on public.loc_locatarios for select
  using (public.has_role(auth.uid(), 'consulta'::app_role));
drop policy if exists "Equipe pode ler snapshot operacional" on public.operacional_snapshot_diario;
create policy "Equipe pode ler snapshot operacional" on public.operacional_snapshot_diario for select
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'gestor'::app_role) or public.has_role(auth.uid(), 'consulta'::app_role));
drop policy if exists "Consulta le tarefas" on public.bitrix_tarefas;
create policy "Consulta le tarefas" on public.bitrix_tarefas for select using (public.has_role(auth.uid(), 'consulta'::app_role));
drop policy if exists "Consulta le pesquisas" on public.market_searches;
create policy "Consulta le pesquisas" on public.market_searches for select using (public.has_role(auth.uid(), 'consulta'::app_role));
drop policy if exists "Consulta le listings" on public.market_listings;
create policy "Consulta le listings" on public.market_listings for select using (public.has_role(auth.uid(), 'consulta'::app_role));
drop policy if exists "Consulta le metricas" on public.market_metrics;
create policy "Consulta le metricas" on public.market_metrics for select using (public.has_role(auth.uid(), 'consulta'::app_role));
drop policy if exists "Consulta le conclusoes" on public.market_conclusions;
create policy "Consulta le conclusoes" on public.market_conclusions for select using (public.has_role(auth.uid(), 'consulta'::app_role));