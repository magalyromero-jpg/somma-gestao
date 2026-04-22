import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

export const LoadingSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <Card className="p-5 space-y-3 shadow-card">
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-10 w-full" />
    ))}
  </Card>
);

export const ErrorState = ({ error, hint }: { error: unknown; hint?: string }) => {
  const msg = error instanceof Error ? error.message : "Erro ao carregar dados.";
  return (
    <Card className="p-6 shadow-card border-destructive/30 bg-destructive/5">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-medium text-destructive mb-1">Não foi possível carregar dados da Lidderar</div>
          <div className="text-muted-foreground">{msg}</div>
          {hint && <div className="text-xs text-muted-foreground mt-2">{hint}</div>}
        </div>
      </div>
    </Card>
  );
};
