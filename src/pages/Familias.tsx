import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useFamilias, useImoveis } from "@/hooks/useApiData";
import { computeFamiliaKpis } from "@/lib/lidderar-adapters";
import { formatBRL, formatPct, pctClass } from "@/lib/format";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSkeleton, ErrorState } from "@/components/LoadingState";

const PERFIS = ["Family Office", "Banco de Dados", "Lidderar"] as const;

export default function Familias() {
  const { familias, isLoading: loadingF, error: errorF } = useFamilias();
  const { imoveis, isLoading: loadingI, error: errorI } = useImoveis();
  const [view, setView] = useState<"conta" | "perfil">("conta");

  const isLoading = loadingF || loadingI;
  const error = errorF || errorI;

  // Aggregate by perfil for "Por Perfil" view.
  const perfilGroups = useMemo(() => {
    return PERFIS.map((perfil) => {
      const list = imoveis.filter((i) => i.perfis?.includes(perfil));
      const valor_mercado = list.reduce((s, i) => s + i.valor_mercado, 0);
      const valor_compra = list.reduce((s, i) => s + i.valor_compra, 0);
      const receita_mensal = list.reduce(
        (s, i) => s + (i.status === "Locado" ? i.valor_aluguel_mensal : 0),
        0,
      );
      const valorizacao = valor_compra > 0 ? ((valor_mercado - valor_compra) / valor_compra) * 100 : 0;
      return {
        id: perfil,
        nome: perfil,
        cor_avatar: perfil === "Family Office" ? "#CC8B15" : perfil === "Banco de Dados" ? "#185FA5" : "#2D7A4F",
        total: list.length,
        valor_mercado,
        valor_compra,
        receita_mensal,
        valorizacao,
        locados: list.filter((i) => i.status === "Locado").length,
        vagos: list.filter((i) => i.status === "Vago").length,
        carencia: list.filter((i) => i.status === "Carencia").length,
        inativos: list.filter((i) => ["Inativo", "Vendido", "Doado"].includes(i.status)).length,
      };
    });
  }, [imoveis]);

  return (
    <>
      <PageHeader title="Famílias" subtitle="Portfólios sob gestão Somma MFO" />

      <div className="inline-flex rounded-lg border border-border p-1 mb-6 bg-muted/30">
        {([
          { id: "conta", label: "Por Conta" },
          { id: "perfil", label: "Por Perfil" },
        ] as const).map((opt) => (
          <button
            key={opt.id}
            onClick={() => setView(opt.id)}
            className={cn(
              "px-4 py-1.5 text-xs font-medium rounded-md transition-colors",
              view === opt.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <ErrorState error={error} hint="Verifique o token Lidderar em /configuracoes." />}
      {isLoading && <LoadingSkeleton rows={6} />}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {view === "conta" &&
            familias.map((f) => {
              const k = computeFamiliaKpis(imoveis, f.id);
              return (
                <FamiliaCard
                  key={f.id}
                  href={`/familias/${f.id}`}
                  nome={f.nome}
                  cor={f.cor_avatar}
                  k={k}
                />
              );
            })}

          {view === "perfil" &&
            perfilGroups.map((g) => (
              <FamiliaCard key={g.id} nome={g.nome} cor={g.cor_avatar} k={g} />
            ))}

          {view === "conta" && familias.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground col-span-full">
              Nenhuma família retornada pela API Lidderar.
            </Card>
          )}
        </div>
      )}
    </>
  );
}

interface KpiShape {
  total: number;
  valor_mercado: number;
  valorizacao: number;
  receita_mensal: number;
  locados: number;
  vagos: number;
  carencia: number;
  inativos: number;
}

const FamiliaCard = ({
  href,
  nome,
  cor,
  k,
}: {
  href?: string;
  nome: string;
  cor: string;
  k: KpiShape;
}) => {
  const inner = (
    <Card className="shadow-card hover:shadow-elevated transition-all border-border/70 group-hover:border-gold/60 h-full">
      <CardContent className="p-6">
        <div className="flex items-start gap-4 mb-5">
          <div
            className="h-12 w-12 rounded-full grid place-items-center text-white font-semibold shrink-0"
            style={{ backgroundColor: cor }}
          >
            {nome.split(" ").pop()?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground truncate">{nome}</div>
            <div className="text-xs text-muted-foreground">{k.total} imóveis</div>
          </div>
          {href && <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-gold transition-colors" />}
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
  );
  return href ? (
    <Link to={href} className="group">
      {inner}
    </Link>
  ) : (
    <div className="group">{inner}</div>
  );
};

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