import { ReactNode } from "react";
import { Info } from "lucide-react";
import { AVISO_HISTORICO } from "@/lib/operacional";
import { cn } from "@/lib/utils";

export const CORES = {
  marca: "hsl(var(--primary))",
  secundaria: "hsl(var(--secondary))",
  ouro: "hsl(var(--gold))",
  atraso: "hsl(var(--destructive))",
  fundo: "hsl(var(--muted))",
  texto: "hsl(var(--muted-foreground))",
  borda: "hsl(var(--border))",
};

export function AvisoHistorico() {
  return (
    <div className="flex gap-2 border-l-2 border-gold bg-gold/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
      <span>{AVISO_HISTORICO}</span>
    </div>
  );
}

export function Bloco({ titulo, acao, children, className }: { titulo: string; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-md border bg-card", className)}>
      <div className="flex min-h-11 items-center justify-between gap-3 border-b px-4 py-2">
        <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
        {acao}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function FaixaNumeros({ itens }: { itens: { label: string; valor: string | number; detalhe?: string; danger?: boolean; ativo?: boolean; onClick?: () => void }[] }) {
  return (
    <div className="grid overflow-hidden rounded-md border bg-card sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {itens.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={!item.onClick}
          onClick={item.onClick}
          className={cn(
            "min-h-20 border-b px-4 py-3 text-left transition-colors sm:border-r lg:border-b-0 disabled:cursor-default",
            item.onClick && "hover:bg-muted/60",
            item.ativo && "bg-gold/10 ring-1 ring-inset ring-gold",
          )}
        >
          <div className="text-[11px] font-medium uppercase text-muted-foreground">{item.label}</div>
          <div className={cn("mt-1 text-2xl font-semibold tabular-nums", item.danger && "text-destructive")}>{item.valor}</div>
          {item.detalhe && <div className="mt-0.5 text-[11px] text-muted-foreground">{item.detalhe}</div>}
        </button>
      ))}
    </div>
  );
}

export const chartTooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
};

export const tableClasses = {
  wrap: "max-h-[520px] overflow-auto",
  table: "w-full min-w-[760px] text-xs",
  head: "sticky top-0 z-10 h-9 border-b bg-card text-left font-medium text-muted-foreground",
  th: "px-3 whitespace-nowrap",
  td: "h-9 border-b px-3 align-middle",
  num: "h-9 border-b px-3 text-right align-middle tabular-nums",
};

export const fmtNumero = (n: number, casas = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
export const fmtDias = (n: number | null) => (n == null ? "—" : `${fmtNumero(n, 1)} d`);