# Architecture rules
- Define shared visual roles in `src/index.css` and reuse the UI components for page controls; global theme changes must not alter data queries or access rules.
- Keep Reforecast aggregation and comparison in a pure helper module so contractual forecasts remain independent of received payments and can be tested.
- Keep PDF extraction server-side with an environment-configured Anthropic model; reviewed proposals apply atomically through authorized RPCs so AI output never writes contracts directly.
- Freeze budget retention separately from contractual retention and preserve all budget vigências/degraus on document application so forecast changes cannot change the budget.