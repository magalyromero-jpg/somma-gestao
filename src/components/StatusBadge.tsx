import type { StatusLocacao } from "@/data/mock";
import { cn } from "@/lib/utils";

// Cores conforme Brand Book oficial Somma
const map: Record<StatusLocacao, { label: string; cls: string }> = {
  Locado:           { label: "Locado",            cls: "bg-[hsl(var(--success-bg))] text-success border-success/20" },
  Carencia:         { label: "Carência",          cls: "bg-[hsl(var(--warning-bg))] text-warning border-warning/20" },
  Vago:             { label: "Vago",              cls: "bg-[hsl(var(--destructive-bg))] text-destructive border-destructive/20" },
  Inativo:          { label: "Inativo",           cls: "bg-[hsl(var(--neutral-bg))] text-neutral border-neutral/20" },
  Vendido:          { label: "Vendido",           cls: "bg-[hsl(var(--neutral-bg))] text-neutral border-neutral/20" },
  Doado:            { label: "Doado",             cls: "bg-[hsl(var(--neutral-bg))] text-neutral border-neutral/20" },
  EmDesenvolvimento:{ label: "Em desenvolvimento",cls: "bg-[hsl(var(--info-bg))] text-info border-info/20" },
};

export const StatusBadge = ({ status, className }: { status: StatusLocacao; className?: string }) => {
  const m = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        m.cls,
        className,
      )}
    >
      {m.label}
    </span>
  );
};
