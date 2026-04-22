import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useFamilias, useImoveis } from "@/hooks/useApiData";
import { computeFamiliaKpis } from "@/lib/lidderar-adapters";
import { formatBRL, formatPct, pctClass } from "@/lib/format";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSkeleton, ErrorState } from "@/components/LoadingState";

export default function Familias() {
  const { familias, isLoading: loadingF, error: errorF } = useFamilias();
  const { imoveis, isLoading: loadingI, error: errorI } = useImoveis();

  const isLoading = loadingF || loadingI;
  const error = errorF || errorI;

  return (
    <>
      <PageHeader title="Famílias" subtitle="Portfólios sob gestão Somma MFO" />

      {error && <ErrorState error={error} hint="Verifique o token Lidderar em /configuracoes." />}
      {isLoading && <LoadingSkeleton rows={6} />}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {familias.map((f) => {
            const k = computeFamiliaKpis(imoveis, f.id);
            return (
              <Link key={f.id} to={`/familias/${f.id}`} className="group">
                <Card className="shadow-card hover:shadow-elevated transition-all border-border/70 group-hover:border-gold/60">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-5">
                      <div
                        className="h-12 w-12 rounded-full grid place-items-center text-white font-semibold shrink-0"
                        style={{ backgroundColor: f.cor_avatar }}
                      >
                        {f.nome.split(" ").pop()?.[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground truncate">{f.nome}</div>
                        <div className="text-xs text-muted-foreground">{k.total} imóveis</div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-gold transition-colors" />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Valor de mercado</span>
                        <span className="text-lg font-semibold">{formatBRL(k.valor_mercado, { compact: true })}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Valorização</span>
                        <span className={cn("text-sm", pctClass(k.valorizacao))}>{formatPct(k.valorizacao)}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Receita mensal</span>
                        <span className="text-sm font-medium">{formatBRL(k.receita_mensal, { compact: true })}</span>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t flex flex-wrap gap-2">
                      <Pill color="success" label={`${k.locados} Locados`} />
                      {k.carencia > 0 && <Pill color="warning" label={`${k.carencia} Carência`} />}
                      {k.vagos > 0 && <Pill color="destructive" label={`${k.vagos} Vagos`} />}
                      {k.inativos > 0 && <Pill color="neutral" label={`${k.inativos} Inativos`} />}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {familias.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground col-span-full">
              Nenhuma família retornada pela API Lidderar.
            </Card>
          )}
        </div>
      )}
    </>
  );
}

const Pill = ({ color, label }: { color: "success" | "warning" | "destructive" | "neutral"; label: string }) => (
  <span
    className={cn(
      "inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border",
      color === "success" && "bg-success/10 text-success border-success/30",
      color === "warning" && "bg-warning/10 text-warning border-warning/30",
      color === "destructive" && "bg-destructive/10 text-destructive border-destructive/30",
      color === "neutral" && "bg-neutral/10 text-neutral border-neutral/30",
    )}
  >
    {label}
  </span>
);
