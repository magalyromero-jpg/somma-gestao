# Architecture rules
- Define shared visual roles in `src/index.css` and reuse the UI components for page controls; global theme changes must not alter data queries or access rules.
- Keep Reforecast aggregation and comparison in a pure helper module so contractual forecasts remain independent of received payments and can be tested.
- Keep PDF extraction server-side with an environment-configured Anthropic model; reviewed proposals apply atomically through authorized RPCs so AI output never writes contracts directly.
- Freeze budget retention separately from contractual retention and preserve all budget vigências/degraus on document application so forecast changes cannot change the budget.
- Read bank boleto PDF exports in the browser with a fixed-rule parser (src/lib/boletos.ts), never AI; boleto principal never changes Orçado, Reforecast or Realizado.
- Aggregate realized receipts in src/lib/locacoes.ts for both overview and cash flow; only nonduplicated paid late fees from the security-invoker view enter imported-month Realizado, never budget or forecast.
- Store boleto nature per boleto and classify through an authorized RPC; imports must preserve that classification so subsequent bank exports cannot reintroduce non-rent charges into realized rent.
- IPTU repassado aos locatários é só acompanhamento (loc_iptu/loc_iptu_parcelas): nunca soma em Orçado, Reforecast, Realizado, Planejamento ou Fluxo de Caixa; só o administrador marca parcelas, via RPC autorizada.
