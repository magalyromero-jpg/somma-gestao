create or replace view public.loc_v_encargos_realizados with (security_invoker = true) as
select e.id, e.edificio_id, e.contrato_id, e.nosso_numero, e.pagador, e.data_vencimento, e.data_pagamento,
       e.competencia, e.dias_atraso, e.valor_titulo, e.valor_pago, e.acrescimo, e.juros, e.multa,
       exists (select 1 from public.loc_pagamentos p
                where p.edificio_id = e.edificio_id and p.contrato_id is not distinct from e.contrato_id
                  and e.contrato_id is not null
                  and (abs(p.valor_liquido - e.valor_pago) <= 0.50 or abs(coalesce(p.valor_bruto,0) - e.valor_pago) <= 0.50)
                  and p.data_pagamento between e.data_pagamento - 3 and e.data_pagamento + 3) as ja_no_realizado
from public.loc_v_boleto_encargos e;
GRANT SELECT ON public.loc_v_encargos_realizados TO authenticated;
GRANT ALL ON public.loc_v_encargos_realizados TO service_role;