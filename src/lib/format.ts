export const parseBRL = (val: string | null | undefined): number => {
  if (!val) return 0;
  return parseFloat(String(val).replace(/\./g, "").replace(",", "."));
};

export const formatBRL = (value: number, opts?: { compact?: boolean }) => {
  if (opts?.compact) {
    if (Math.abs(value) >= 1_000_000)
      return "R$ " + (value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " M";
    if (Math.abs(value) >= 1_000)
      return "R$ " + (value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " mil";
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const formatPct = (value: number, withSign = true) => {
  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
};

export const pctClass = (value: number) =>
  value > 0 ? "num-positive" : value < 0 ? "num-negative" : "text-muted-foreground";
