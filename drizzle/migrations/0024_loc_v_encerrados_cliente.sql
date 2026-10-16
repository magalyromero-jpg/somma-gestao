create or replace view public.loc_v_encerrados with (security_invoker = true) as
select c.edificio_id, c.id as contrato_id, l.nome as locatario,
       (select string_agg(u.nome, ' + ' order by u.nome) from public.loc_contrato_unidades cu join public.loc_unidades u on u.id = cu.unidade_id
         where cu.contrato_id = c.id and u.tipo <> 'garagem') as unidades,
       c.data_saida, c.motivo_encerramento, c.data_em_pauta, c.debito_condominio,
       coalesce(c.debito_alugueis,
         greatest(0, coalesce((select sum(o.valor) from public.loc_previsto_caixa(c.edificio_id, extract(year from c.data_saida)::int) o
                               where o.contrato_id = c.id and o.mes <= (date_trunc('month', c.data_saida) + interval '1 month')::date), 0)
                   - coalesce((select sum(p.valor_liquido) from public.loc_pagamentos p
                               where p.contrato_id = c.id and p.data_pagamento >= date_trunc('year', c.data_saida)), 0))) as alugueis_em_aberto
from public.loc_contratos c
join public.loc_v_locatarios_cliente l on l.id = c.locatario_id and l.edificio_id = c.edificio_id
where (c.data_saida is not null or c.status = 'encerrado') and (c.debito_alugueis is not null or c.conferir_recebimento);
grant select on public.loc_v_encerrados to authenticated;