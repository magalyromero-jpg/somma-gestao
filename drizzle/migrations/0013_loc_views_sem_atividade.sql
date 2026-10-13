drop view if exists public.loc_v_evolucao;
drop view if exists public.loc_v_metragem;
drop view if exists public.loc_v_contrato_vigente;
drop view if exists public.loc_v_locatarios_cliente;
comment on column public.loc_locatarios.atividade is 'DEPRECATED: não exibido; mantido sem uso';

create view public.loc_v_locatarios_cliente as
select distinct l.id, l.nome, c.edificio_id
from public.loc_locatarios l join public.loc_contratos c on c.locatario_id = l.id
where public.loc_pode_ver(c.edificio_id);
grant select on public.loc_v_locatarios_cliente to authenticated;

create view public.loc_v_contrato_vigente with (security_invoker = true) as
select c.edificio_id, c.id as contrato_id,
       (select string_agg(u.nome, ' + ' order by u.nome) from public.loc_contrato_unidades cu join public.loc_unidades u on u.id = cu.unidade_id
         where cu.contrato_id = c.id and u.tipo <> 'garagem') as unidades,
       (select string_agg(u.matricula, ' / ' order by u.nome) from public.loc_contrato_unidades cu join public.loc_unidades u on u.id = cu.unidade_id
         where cu.contrato_id = c.id and u.tipo <> 'garagem') as matriculas,
       v.seq as vigencia_seq, v.inicio, v.fim, v.indice, v.mes_reajuste,
       public.loc_valor_em(c.id, current_date) as valor_vigente,
       v.area_contrato_m2,
       (select sum(u.area_privativa_m2) from public.loc_contrato_unidades cu join public.loc_unidades u on u.id = cu.unidade_id
         where cu.contrato_id = c.id and u.tipo <> 'garagem') as area_matricula_m2,
       round(public.loc_valor_em(c.id, current_date) /
         nullif((select sum(u.area_privativa_m2) from public.loc_contrato_unidades cu join public.loc_unidades u on u.id = cu.unidade_id
                  where cu.contrato_id = c.id and u.tipo <> 'garagem'), 0), 2) as rs_m2_matricula,
       lc.nome as locatario
from public.loc_contratos c
left join lateral (select * from public.loc_vigencias v where v.contrato_id = c.id and v.inicio <= current_date
                   order by v.seq desc limit 1) v on true
left join public.loc_v_locatarios_cliente lc on lc.id = c.locatario_id and lc.edificio_id = c.edificio_id
where c.status in ('ativo','em_renovacao','inadimplente');
grant select on public.loc_v_contrato_vigente to authenticated;

create view public.loc_v_metragem with (security_invoker = true) as
select edificio_id, contrato_id, unidades, matriculas, area_contrato_m2, area_matricula_m2,
       round(area_contrato_m2 - area_matricula_m2, 2) as diferenca_m2
from public.loc_v_contrato_vigente;
grant select on public.loc_v_metragem to authenticated;

create view public.loc_v_evolucao with (security_invoker = true) as
select c.edificio_id, c.id as contrato_id,
       (select string_agg(u.nome, ' + ' order by u.nome) from public.loc_contrato_unidades cu join public.loc_unidades u on u.id = cu.unidade_id
         where cu.contrato_id = c.id and u.tipo <> 'garagem') as unidades,
       lc.nome as locatario,
       v0.inicio as inicio_inicial,
       (select min(inicio) from public.loc_vigencias x where x.contrato_id = c.id and x.tipo = 'aditivo') as inicio_aditivo,
       vv.fim as fim_vigente,
       v0.valor_mensal as aluguel_inicial,
       public.loc_valor_em(c.id, current_date) as aluguel_atual,
       round((public.loc_valor_em(c.id, current_date) / nullif(v0.valor_mensal,0) - 1) * 100, 1) as variacao_pct,
       (select count(*) from public.loc_vigencias x where x.contrato_id = c.id and x.tipo = 'aditivo') > 0 as tem_aditivo,
       case when vv.fim < current_date then 'vencido'
            when vv.fim < current_date + interval '180 days' then 'vence em até 180 dias'
            else 'vigente' end as status
from public.loc_contratos c
join public.loc_vigencias v0 on v0.contrato_id = c.id and v0.seq = 0
left join lateral (select * from public.loc_vigencias v where v.contrato_id = c.id order by seq desc limit 1) vv on true
left join public.loc_v_locatarios_cliente lc on lc.id = c.locatario_id and lc.edificio_id = c.edificio_id;
grant select on public.loc_v_evolucao to authenticated;