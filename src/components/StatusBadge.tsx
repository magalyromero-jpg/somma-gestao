import type { StatusLocacao } from "@/data/mock";
import { cn } from "@/lib/utils";

const map: Record<StatusLocacao, { label: string; cls: string }> = {
  Locado: { label: "Locado", cls: "bg-success/15 text-success border-success/30" },
  Carencia: { label: "Carência", cls: "bg-warning/15 text-warning border-warning/30" },
  Vago: { label: "Vago", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  Inativo: { label: "Inativo", cls: "bg-neutral/15 text-neutral border-neutral/30" },
  Vendido: { label: "Vendido", cls: "bg-neutral/15 text-neutral border-neutral/30" },
  Doado: { label: "Doado", cls: "bg-neutral/15 text-neutral border-neutral/30" },
  EmDesenvolvimento: { label: "Em desenvolvimento", cls: "bg-info/15 text-info border-info/30" },
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
