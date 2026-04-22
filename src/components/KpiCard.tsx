import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { pctClass, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export const KpiCard = ({
  label,
  value,
  delta,
  icon,
  hint,
}: {
  label: string;
  value: string;
  delta?: number;
  icon?: ReactNode;
  hint?: string;
}) => (
  <Card className="shadow-card border-border/70">
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
        {icon && <div className="text-gold">{icon}</div>}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta !== undefined && (
          <span className={cn(pctClass(delta), "font-medium")}>{formatPct(delta)}</span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </CardContent>
  </Card>
);
