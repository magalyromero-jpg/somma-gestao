CREATE TABLE public.loc_leituras_documento (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),edificio_id uuid NOT NULL REFERENCES public.loc_edificios(id),documento_id uuid NOT NULL REFERENCES public.loc_documentos(id) ON DELETE CASCADE,contrato_id uuid REFERENCES public.loc_contratos(id),status text NOT NULL DEFAULT 'lendo' CHECK(status IN ('lendo','pendente','aplicada','descartada','erro')),dados jsonb,erro text,modelo text,criado_em timestamptz NOT NULL DEFAULT now(),aplicado_em timestamptz,aplicado_por uuid);
GRANT SELECT,INSERT,UPDATE ON public.loc_leituras_documento TO authenticated; GRANT ALL ON public.loc_leituras_documento TO service_role;
ALTER TABLE public.loc_leituras_documento ENABLE ROW LEVEL SECURITY;
CREATE POLICY loc_leituras_operadores ON public.loc_leituras_documento TO authenticated USING(public.loc_eh_admin(edificio_id)) WITH CHECK(public.loc_eh_admin(edificio_id));
CREATE INDEX loc_leituras_doc_idx ON public.loc_leituras_documento(documento_id,criado_em DESC);
CREATE UNIQUE INDEX loc_leituras_em_curso ON public.loc_leituras_documento(documento_id) WHERE status='lendo';
ALTER TABLE public.loc_contratos ADD COLUMN retencao_orcada_pct numeric;
UPDATE public.loc_contratos SET retencao_orcada_pct=retencao_pct;
COMMENT ON COLUMN public.loc_contratos.retencao_orcada_pct IS 'Frozen budget retention; document proposals only change contractual retention.';
CREATE OR REPLACE FUNCTION public.loc_orcado_caixa(p_edificio uuid,p_ano integer) RETURNS TABLE(contrato_id uuid,mes date,valor numeric) LANGUAGE sql STABLE SET search_path=public AS $$ SELECT c.id,g.m::date,round(coalesce(public.loc_valor_orcado_em(c.id,CASE WHEN c.competencia='posterior' THEN (g.m-interval '1 month')::date ELSE g.m::date END),0)*(1-coalesce(c.retencao_orcada_pct,c.retencao_pct)/100),2) FROM public.loc_contratos c CROSS JOIN generate_series(make_date(p_ano,1,1),make_date(p_ano,12,1),interval '1 month') g(m) WHERE c.edificio_id=p_edificio AND c.tipo='locacao' AND c.no_orcamento; $$;
CREATE OR REPLACE VIEW public.loc_v_auditoria_reajuste WITH(security_invoker=true) AS SELECT edificio_id,contrato_id,aniversario,indice,mes_referencia,percentual,valor_anterior,valor_calculado,valor_aplicado,valor_aplicado-valor_calculado AS diferenca,CASE WHEN valor_aplicado IS NULL THEN 'pendente' WHEN valor_calculado IS NULL THEN 'sem_previsto' WHEN abs(valor_aplicado-valor_calculado)<=2 THEN 'ok' ELSE 'divergente' END AS parecer,vigencia_a_partir,estimado FROM public.loc_reajustes;
CREATE OR REPLACE FUNCTION public.loc_previsao_leitura(p_contrato uuid,p_data date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE c public.loc_contratos%rowtype; r public.loc_reajustes%rowtype; g record; cal record; anterior numeric; previsto numeric; regra text; percentual numeric; estimado boolean:=false;
BEGIN
 SELECT * INTO c FROM public.loc_contratos WHERE id=p_contrato;
 IF NOT FOUND OR NOT public.loc_eh_admin(c.edificio_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 anterior:=public.loc_valor_em(c.id,(date_trunc('month',p_data)-interval '1 day')::date);
 SELECT * INTO r FROM public.loc_reajustes WHERE contrato_id=c.id AND date_trunc('month',aniversario)=date_trunc('month',p_data) ORDER BY aniversario DESC LIMIT 1;
 SELECT d.*,v.seq INTO g FROM public.loc_vigencia_degraus d JOIN public.loc_vigencias v ON v.id=d.vigencia_id WHERE v.contrato_id=c.id AND v.inicio<=(date_trunc('month',p_data)+interval '1 month - 1 day')::date AND v.fim>=date_trunc('month',p_data)::date AND date_trunc('month',d.a_partir)=date_trunc('month',p_data) ORDER BY v.seq DESC,d.a_partir DESC LIMIT 1;
 IF g IS NOT NULL THEN previsto:=g.valor_mensal; regra:='Degrau';
 ELSIF r.valor_calculado IS NOT NULL THEN previsto:=r.valor_calculado; regra:=r.indice::text; percentual:=r.percentual; anterior:=r.valor_anterior; estimado:=r.estimado;
 ELSIF c.indice IN ('IPCA','IGPM','MEDIA') AND c.mes_reajuste=extract(month FROM p_data) AND anterior IS NOT NULL THEN
  IF c.indice='MEDIA' THEN percentual:=public.loc_indice_12m(c.indice,(date_trunc('month',p_data)-interval '1 month')::date); estimado:=percentual IS NULL; IF c.piso_zero AND percentual<0 THEN percentual:=0; END IF; previsto:=round(anterior*(1+percentual/100),2);
  ELSE SELECT * INTO cal FROM public.loc_calcular_reajuste(c.id,p_data,anterior); previsto:=cal.valor_calculado; percentual:=cal.percentual; estimado:=cal.estimado; END IF; regra:=c.indice::text;
 END IF;
 RETURN jsonb_build_object('data',p_data,'valor_anterior',anterior,'previsto',previsto,'regra',regra,'indice',c.indice,'percentual',percentual,'estimado',estimado,'ja_realizado',r.valor_aplicado IS NOT NULL);
END $$;
CREATE OR REPLACE FUNCTION public.loc_conferir_leitura(p_leitura uuid,p_dados jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE l public.loc_leituras_documento%rowtype; m record; d jsonb; p jsonb; res jsonb:='[]'; dif numeric;
BEGIN
 SELECT * INTO l FROM public.loc_leituras_documento WHERE id=p_leitura;
 IF NOT FOUND OR NOT public.loc_eh_admin(l.edificio_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF l.contrato_id IS NULL THEN RETURN res; END IF; d:=coalesce(p_dados,l.dados);
 FOR m IN SELECT (v->>'inicio')::date AS data,(v->>'valor_mensal')::numeric AS valor FROM jsonb_array_elements(coalesce(d->'vigencias','[]')) v UNION SELECT (g->>'a_partir')::date,(g->>'valor_mensal')::numeric FROM jsonb_array_elements(coalesce(d->'vigencias','[]')) v CROSS JOIN LATERAL jsonb_array_elements(coalesce(v->'degraus','[]')) g UNION SELECT (r->>'data_efeito')::date,(r->>'valor_mensal')::numeric FROM jsonb_array_elements(coalesce(d->'reajustes','[]')) r ORDER BY 1 LOOP
 CONTINUE WHEN m.data IS NULL OR m.valor IS NULL;
 p:=public.loc_previsao_leitura(l.contrato_id,m.data); dif:=round(m.valor-(p->>'previsto')::numeric,2);
 res:=res||jsonb_build_array(p||jsonb_build_object('valor_documento',m.valor,'diferenca',dif,'situacao',CASE WHEN dif IS NULL THEN 'sem_previsto' WHEN abs(dif)<=2 THEN 'confere' ELSE 'diverge' END)); END LOOP; RETURN res;
END $$;
CREATE OR REPLACE FUNCTION public.loc_aplicar_leitura(p_leitura uuid,p_dados jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE l public.loc_leituras_documento%rowtype; c public.loc_contratos%rowtype; doc public.loc_documentos%rowtype; v jsonb; d jsonb; r jsonb; pr jsonb; vg public.loc_vigencias%rowtype; dg public.loc_vigencia_degraus%rowtype; vid uuid; seqn int; ins int:=0; upd int:=0; prot int:=0; realizados int:=0; avisos jsonb:='[]'; val numeric; data_r date; st text;
BEGIN
 SELECT * INTO l FROM public.loc_leituras_documento WHERE id=p_leitura FOR UPDATE;
 IF NOT FOUND OR NOT public.loc_eh_admin(l.edificio_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF l.status<>'pendente' THEN RAISE EXCEPTION 'A proposta não está pendente'; END IF;
 SELECT * INTO c FROM public.loc_contratos WHERE id=l.contrato_id AND edificio_id=l.edificio_id FOR UPDATE;
 SELECT * INTO doc FROM public.loc_documentos WHERE id=l.documento_id AND edificio_id=l.edificio_id AND contrato_id=l.contrato_id;
 IF c.id IS NULL OR doc.id IS NULL THEN RAISE EXCEPTION 'O vínculo do documento mudou. Leia o documento novamente'; END IF;
 IF jsonb_typeof(p_dados)<>'object' OR jsonb_typeof(coalesce(p_dados->'vigencias','[]'))<>'array' OR jsonb_typeof(coalesce(p_dados->'reajustes','[]'))<>'array' THEN RAISE EXCEPTION 'Proposta inválida'; END IF;
 FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p_dados->'reajustes','[]')) LOOP
 data_r:=(r->>'data')::date; val:=(r->>'valor_documento')::numeric;
 IF data_r IS NULL OR val IS NULL OR val<0 THEN RAISE EXCEPTION 'Reajuste incompleto'; END IF;
 pr:=public.loc_previsao_leitura(c.id,data_r); st:=CASE WHEN pr->>'previsto' IS NULL OR abs(val-(pr->>'previsto')::numeric)<=2 THEN 'aplicado' ELSE 'divergente' END;
 SELECT * INTO vg FROM public.loc_vigencias WHERE contrato_id=c.id AND inicio<=(date_trunc('month',data_r)+interval '1 month - 1 day')::date AND fim>=date_trunc('month',data_r)::date ORDER BY seq DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Não existe vigência para o reajuste de %',to_char(data_r,'DD/MM/YYYY'); END IF;
 SELECT * INTO dg FROM public.loc_vigencia_degraus WHERE vigencia_id=vg.id AND date_trunc('month',a_partir)=date_trunc('month',data_r) ORDER BY a_partir DESC LIMIT 1; vid:=vg.id;
 IF dg.no_orcamento AND abs(dg.valor_mensal-val)>0.005 THEN
 avisos:=avisos||jsonb_build_array(format('Degrau do Orçado de %s foi preservado; o valor aplicado entra somente no Reforecast.',to_char(data_r,'DD/MM/YYYY')));
 SELECT coalesce(max(seq),-1)+1 INTO seqn FROM public.loc_vigencias WHERE contrato_id=c.id;
 INSERT INTO public.loc_vigencias(edificio_id,contrato_id,seq,tipo,data_documento,inicio,fim,valor_mensal,area_contrato_m2,indice,mes_reajuste,documento_id,no_orcamento,observacao) VALUES(c.edificio_id,c.id,seqn,'aditivo',(l.dados->>'data_documento')::date,vg.inicio,vg.fim,vg.valor_mensal,vg.area_contrato_m2,vg.indice,vg.mes_reajuste,doc.id,false,'Reajuste confirmado pelo documento; Orçado preservado') RETURNING id INTO vid;
 INSERT INTO public.loc_vigencia_degraus(vigencia_id,a_partir,valor_mensal,origem,no_orcamento) SELECT vid,a_partir,valor_mensal,origem,false FROM public.loc_vigencia_degraus WHERE vigencia_id=vg.id; END IF;
 IF NOT coalesce(dg.no_orcamento,false) OR vid<>vg.id OR dg.vigencia_id IS NULL THEN INSERT INTO public.loc_vigencia_degraus(vigencia_id,a_partir,valor_mensal,origem,no_orcamento) VALUES(vid,coalesce(dg.a_partir,date_trunc('month',data_r)::date),val,'reajuste',false) ON CONFLICT(vigencia_id,a_partir) DO UPDATE SET valor_mensal=excluded.valor_mensal,origem='reajuste' WHERE NOT public.loc_vigencia_degraus.no_orcamento; END IF;
 INSERT INTO public.loc_reajustes(edificio_id,contrato_id,aniversario,indice,mes_referencia,percentual,valor_anterior,valor_calculado,valor_aplicado,vigencia_a_partir,status,estimado,observacao) VALUES(c.edificio_id,c.id,date_trunc('month',data_r)::date,coalesce((pr->>'indice')::public.loc_indice,c.indice),(date_trunc('month',data_r)-interval '1 month')::date,(pr->>'percentual')::numeric,coalesce((pr->>'valor_anterior')::numeric,val),(pr->>'previsto')::numeric,val,CASE WHEN c.competencia='posterior' THEN (date_trunc('month',data_r)+interval '1 month')::date ELSE date_trunc('month',data_r)::date END,st,coalesce((pr->>'estimado')::boolean,false),'Confirmado pelo documento') ON CONFLICT(contrato_id,aniversario) DO UPDATE SET valor_calculado=excluded.valor_calculado,valor_aplicado=excluded.valor_aplicado,status=excluded.status,observacao=excluded.observacao; realizados:=realizados+1; END LOOP;
 FOR v IN SELECT * FROM jsonb_array_elements(coalesce(p_dados->'vigencias','[]')) LOOP
 IF nullif(v->>'inicio','') IS NULL OR nullif(v->>'fim','') IS NULL OR nullif(v->>'valor_mensal','') IS NULL OR (v->>'fim')::date<=(v->>'inicio')::date OR (v->>'valor_mensal')::numeric<0 THEN RAISE EXCEPTION 'Preencha início, fim posterior ao início e valor mensal válido'; END IF;
 IF nullif(v->>'mes_reajuste','') IS NOT NULL AND (v->>'mes_reajuste')::int NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Mês de reajuste inválido'; END IF;
 IF EXISTS(SELECT 1 FROM public.loc_vigencias WHERE contrato_id=c.id AND inicio=(v->>'inicio')::date AND no_orcamento) THEN prot:=prot+1; avisos:=avisos||jsonb_build_array('Vigência do Orçado preservada: '||to_char((v->>'inicio')::date,'DD/MM/YYYY')); CONTINUE; END IF;
 SELECT * INTO vg FROM public.loc_vigencias WHERE contrato_id=c.id AND inicio=(v->>'inicio')::date ORDER BY seq DESC LIMIT 1;
 IF FOUND THEN vid:=vg.id; UPDATE public.loc_vigencias SET fim=(v->>'fim')::date,valor_mensal=(v->>'valor_mensal')::numeric,indice=coalesce(nullif(v->>'indice','')::public.loc_indice,indice),mes_reajuste=nullif(v->>'mes_reajuste','')::int,data_documento=nullif(v->>'data_documento','')::date,documento_id=doc.id WHERE id=vid AND NOT no_orcamento; upd:=upd+1;
 ELSE SELECT coalesce(max(seq),-1)+1 INTO seqn FROM public.loc_vigencias WHERE contrato_id=c.id; INSERT INTO public.loc_vigencias(edificio_id,contrato_id,seq,tipo,data_documento,inicio,fim,valor_mensal,indice,mes_reajuste,documento_id,no_orcamento,observacao) VALUES(c.edificio_id,c.id,seqn,CASE WHEN seqn=0 THEN 'contrato' ELSE 'aditivo' END,nullif(v->>'data_documento','')::date,(v->>'inicio')::date,(v->>'fim')::date,(v->>'valor_mensal')::numeric,coalesce(nullif(v->>'indice','')::public.loc_indice,'NENHUM'),nullif(v->>'mes_reajuste','')::int,doc.id,false,'Vigência confirmada pelo documento') RETURNING id INTO vid; ins:=ins+1; END IF;
 FOR d IN SELECT * FROM jsonb_array_elements(coalesce(v->'degraus','[]')) LOOP
 IF nullif(d->>'a_partir','') IS NULL OR nullif(d->>'valor_mensal','') IS NULL OR (d->>'valor_mensal')::numeric<0 OR (d->>'a_partir')::date NOT BETWEEN (v->>'inicio')::date AND (v->>'fim')::date THEN RAISE EXCEPTION 'Degrau fora da vigência ou incompleto'; END IF;
 IF EXISTS(SELECT 1 FROM public.loc_vigencia_degraus WHERE vigencia_id=vid AND a_partir=(d->>'a_partir')::date AND no_orcamento) THEN avisos:=avisos||jsonb_build_array('Degrau do Orçado preservado'); CONTINUE; END IF;
 INSERT INTO public.loc_vigencia_degraus(vigencia_id,a_partir,valor_mensal,origem,no_orcamento) VALUES(vid,(d->>'a_partir')::date,(d->>'valor_mensal')::numeric,coalesce(nullif(d->>'origem',''),'degrau'),false) ON CONFLICT(vigencia_id,a_partir) DO UPDATE SET valor_mensal=excluded.valor_mensal WHERE NOT public.loc_vigencia_degraus.no_orcamento; END LOOP;
 IF EXISTS(SELECT 1 FROM public.loc_vigencias WHERE contrato_id=c.id AND id<>vid AND inicio<=(v->>'fim')::date AND fim>=(v->>'inicio')::date) THEN avisos:=avisos||jsonb_build_array('Vigências sobrepostas: confira os períodos do contrato'); END IF; END LOOP;
 IF nullif(p_dados->'contrato'->>'dia_vencimento','') IS NOT NULL AND (p_dados->'contrato'->>'dia_vencimento')::int NOT BETWEEN 1 AND 31 THEN RAISE EXCEPTION 'Dia de vencimento inválido'; END IF;
 IF nullif(p_dados->'contrato'->>'retencao_pct','') IS NOT NULL AND (p_dados->'contrato'->>'retencao_pct')::numeric NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Retenção inválida'; END IF;
 UPDATE public.loc_contratos SET dia_vencimento=coalesce(nullif(p_dados->'contrato'->>'dia_vencimento','')::int,dia_vencimento),retencao_pct=coalesce(nullif(p_dados->'contrato'->>'retencao_pct','')::numeric,retencao_pct) WHERE id=c.id;
 UPDATE public.loc_leituras_documento SET status='aplicada',dados=p_dados,aplicado_em=now(),aplicado_por=auth.uid() WHERE id=l.id;
 RETURN jsonb_build_object('inseridas',ins,'atualizadas',upd,'protegidas',prot,'realizados',realizados,'avisos',avisos);
END $$;
REVOKE ALL ON FUNCTION public.loc_previsao_leitura(uuid,date),public.loc_conferir_leitura(uuid,jsonb),public.loc_aplicar_leitura(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.loc_previsao_leitura(uuid,date),public.loc_conferir_leitura(uuid,jsonb),public.loc_aplicar_leitura(uuid,jsonb) TO authenticated,service_role;