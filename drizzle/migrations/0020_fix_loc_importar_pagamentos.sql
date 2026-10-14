create or replace function public.loc_importar_pagamentos(p_edificio uuid, p_arquivo text, p_linhas jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  r record; v_imp uuid; v_chave text; v_contrato uuid; v_ins int;
  n_total int := 0; n_novas int := 0; n_dup int := 0; n_sem int := 0;
  v_sem jsonb := '[]'::jsonb;
begin
  if not loc_eh_admin(p_edificio) then raise exception 'sem permissão'; end if;
  insert into loc_importacoes (edificio_id, arquivo) values (p_edificio, p_arquivo) returning id into v_imp;

  for r in
    select x.codigo, x.imovel, x.vencimento, x.pagamento, x.bruto, x.liquido, e.ord,
           row_number() over (partition by x.codigo, x.vencimento, x.pagamento, x.bruto, x.liquido order by e.ord) as ocorrencia
    from jsonb_array_elements(p_linhas) with ordinality as e(j, ord)
    cross join lateral jsonb_to_record(e.j)
         as x(codigo text, imovel text, vencimento date, pagamento date, bruto numeric, liquido numeric)
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