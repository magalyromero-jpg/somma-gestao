# Architecture rules
- Define shared visual roles in `src/index.css` and reuse the UI components for page controls; global theme changes must not alter data queries or access rules.
- Keep Reforecast aggregation and comparison in a pure helper module so contractual forecasts remain independent of received payments and can be tested.