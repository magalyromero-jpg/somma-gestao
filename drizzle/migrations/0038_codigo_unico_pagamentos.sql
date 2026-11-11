create or replace function public.loc_codigo_unico(p_edificio uuid, p_codigo text)
returns text language plpgsql stable set search_path to 'public' as $$
declare v_partes text[]; v_ach text;
begin
  if p_codigo !~ ',' then return trim(p_codigo); end if;
  v_partes := array(select trim(x) from unnest(string_to_array(p_codigo, ',')) x where trim(x) <> '');
  select p.codigo into v_ach from loc_pagamentos p
   where p.edificio_id = p_edificio and p.codigo = any(v_partes) order by p.data_pagamento desc limit 1;
  if v_ach is null then
    select c.codigo into v_ach from loc_codigos_lidderar c
     where c.edificio_id = p_edificio and c.codigo = any(v_partes) and c.contrato_id is not null
     order by c.codigo limit 1;
  end if;
  return coalesce(v_ach, v_partes[1]);
end $$;

create or replace function public.loc_importar_pagamentos(p_edificio uuid, p_arquivo text, p_linhas jsonb)
returns jsonb language plpgsql set search_path to 'public' as $$
declare
  r record; v_imp uuid; v_chave text; v_contrato uuid; v_ins int;
  n_total int := 0; n_novas int := 0; n_dup int := 0; n_sem int := 0;
  v_sem jsonb := '[]'::jsonb;
begin
  if not loc_eh_admin(p_edificio) then raise exception 'sem permissão'; end if;
  insert into loc_importacoes (edificio_id, arquivo) values (p_edificio, p_arquivo) returning id into v_imp;
  for r in
    select y.*, row_number() over (partition by y.codigo, y.vencimento, y.pagamento, y.bruto, y.liquido order by y.ord) as ocorrencia
    from (select loc_codigo_unico(p_edificio, t.j->>'codigo') as codigo, t.j->>'imovel' as imovel,
                 nullif(t.j->>'vencimento','')::date as vencimento, nullif(t.j->>'pagamento','')::date as pagamento,
                 nullif(t.j->>'bruto','')::numeric as bruto, nullif(t.j->>'liquido','')::numeric as liquido, t.ord
            from jsonb_array_elements(p_linhas) with ordinality as t(j, ord)) y
  loop
    n_total := n_total + 1;
    v_chave := md5(concat_ws('|', r.codigo, r.vencimento, r.pagamento, coalesce(r.bruto,0), r.liquido, r.ocorrencia));
    select contrato_id into v_contrato from loc_codigos_lidderar where edificio_id = p_edificio and codigo = r.codigo;
    if v_contrato is null then
      n_sem := n_sem + 1;
      v_sem := v_sem || to_jsonb(r.codigo || ' — ' || coalesce(r.imovel,''));
      insert into loc_codigos_lidderar (edificio_id, codigo, nome_no_lidderar) values (p_edificio, r.codigo, r.imovel)
        on conflict do nothing;
    end if;
    insert into loc_pagamentos (edificio_id, importacao_id, codigo, imovel_nome, data_vencimento, data_pagamento, valor_bruto, valor_liquido, contrato_id, chave)
      values (p_edificio, v_imp, r.codigo, r.imovel, r.vencimento, r.pagamento, r.bruto, r.liquido, v_contrato, v_chave)
      on conflict (edificio_id, chave) do nothing;
    get diagnostics v_ins = row_count;
    if v_ins = 1 then n_novas := n_novas + 1; else n_dup := n_dup + 1; end if;
  end loop;
  update loc_importacoes set linhas = n_total, novas = n_novas, duplicadas = n_dup, sem_mapeamento = n_sem where id = v_imp;
  return jsonb_build_object('importacao', v_imp, 'linhas', n_total, 'novas', n_novas, 'duplicadas', n_dup,
                            'sem_mapeamento', n_sem, 'codigos_para_mapear', v_sem);
end $$;