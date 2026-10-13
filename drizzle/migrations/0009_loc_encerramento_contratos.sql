alter table public.loc_contratos add column if not exists debito_condominio numeric(14,2) not null default 0;
alter table public.loc_contratos add column if not exists no_orcamento boolean not null default true;

create or replace function public.loc_orcado_caixa(p_edificio uuid, p_ano int)
returns table (contrato_id uuid, mes date, valor numeric)
language sql stable security invoker set search_path = public as $$
  select c.id, g.m::date,
         round(coalesce(loc_valor_em(c.id,
               case when c.competencia = 'posterior' then (g.m - interval '1 month')::date else g.m::date end), 0)
               * (1 - c.retencao_pct/100), 2)
  from loc_contratos c
  cross join generate_series(make_date(p_ano,1,1), make_date(p_ano,12,1), interval '1 month') as g(m)
  where c.edificio_id = p_edificio and c.tipo = 'locacao' and c.no_orcamento;
$$;

create or replace view public.loc_v_encerrados with (security_invoker = true) as
select c.edificio_id, c.id as contrato_id, l.nome as locatario,
       (select string_agg(u.nome, ' + ' order by u.nome) from loc_contrato_unidades cu join loc_unidades u on u.id = cu.unidade_id
         where cu.contrato_id = c.id and u.tipo <> 'garagem') as unidades,
       c.data_saida, c.motivo_encerramento, c.data_em_pauta, c.debito_condominio,
       greatest(0, coalesce((select sum(o.valor) from loc_orcado_caixa(c.edificio_id, extract(year from c.data_saida)::int) o
                             where o.contrato_id = c.id
                               and o.mes <= (date_trunc('month', c.data_saida) + interval '1 month')::date), 0)
                 - coalesce((select sum(p.valor_liquido) from loc_pagamentos p
                             where p.contrato_id = c.id and p.data_pagamento >= date_trunc('year', c.data_saida)), 0)) as alugueis_em_aberto
from loc_contratos c join loc_locatarios l on l.id = c.locatario_id
where c.data_saida is not null or c.status = 'encerrado';

grant select on public.loc_v_encerrados to authenticated;