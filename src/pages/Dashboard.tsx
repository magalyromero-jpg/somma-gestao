import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFamilias, useImoveis } from "@/hooks/useApiData";
import { computeFamiliaKpis } from "@/lib/lidderar-adapters";
import { formatBRL } from "@/lib/format";
import { Building2, Users, AlertTriangle, FileWarning } from "lucide-react";
import {
  Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { LoadingSkeleton, ErrorState } from "@/components/LoadingState";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const PERFIS = ["Family Office", "Banco de Dados", "Lidderar"] as const;
type Perfil = (typeof PERFIS)[number];

const STATUS_COLORS: Record<string, string> = {
  Locado: "hsl(var(--success))",
  Vago: "hsl(var(--destructive))",
  Carencia: "hsl(var(--warning))",
  EmDesenvolvimento: "hsl(var(--info))",
  Inativo: "hsl(var(--neutral))",
  Vendido: "hsl(var(--neutral))",
  Doado: "hsl(var(--neutral))",
};
const CLASS_COLORS = ["hsl(var(--primary))", "hsl(var(--gold))", "hsl(var(--info))", "hsl(var(--success))"];

export default function Dashboard() {
  const { familias, isLoading: lf, error: ef } = useFamilias();
  const { imoveis: allImoveis, isLoading: li, error: ei } = useImoveis();
  const [perfilFilter, setPerfilFilter] = useState<Perfil | null>(null);

  const imoveis = useMemo(
    () => (perfilFilter ? allImoveis.filter((i) => i.perfis?.includes(perfilFilter)) : allImoveis),
    [allImoveis, perfilFilter],
  );

  const isLoading = lf || li;
  const error = ef || ei;

  const k = useMemo(() => {
    const valor_mercado = imoveis.reduce((s, i) => s + i.valor_mercado, 0);
    const receita_mensal = imoveis.reduce(
      (s, i) => s + (i.status === "Locado" ? i.valor_aluguel_mensal : 0),
      0,
    );
    return {
      total_familias: familias.length,
      total_imoveis: imoveis.length,
      valor_mercado,
      receita_mensal,
    };
  }, [familias, imoveis]);

  const topFamilias = useMemo(
    () =>
      familias
        .map((f) => ({ ...f, ...computeFamiliaKpis(imoveis, f.id) }))
        .sort((a, b) => b.valor_mercado - a.valor_mercado),
    [familias, imoveis],
  );

  const statusData = useMemo(
    () =>
      Object.entries(
        imoveis.reduce<Record<string, number>>((acc, i) => {
          acc[i.status] = (acc[i.status] || 0) + 1;
          return acc;
        }, {}),
      ).map(([name, value]) => ({ name, value })),
    [imoveis],
  );

  const classData = useMemo(
    () =>
      Object.entries(
        imoveis.reduce<Record<string, number>>((acc, i) => {
          acc[i.classificacao] = (acc[i.classificacao] || 0) + 1;
          return acc;
        }, {}),
      ).map(([name, value]) => ({ name, value })),
    [imoveis],
  );

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão consolidada do portfólio Somma" />

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setPerfilFilter(null)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
            !perfilFilter
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:border-foreground/40",
          )}
        >
          Todos
        </button>
        {PERFIS.map((p) => {
          const active = perfilFilter === p;
          return (
            <button
              key={p}
              onClick={() => setPerfilFilter(active ? null : p)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                active
                  ? "bg-gold text-background border-gold"
                  : "bg-background text-muted-foreground border-border hover:border-gold/60",
              )}
            >
              {p}
            </button>
          );
        })}
        {perfilFilter && (
          <Badge variant="outline" className="ml-2">
            {imoveis.length} de {allImoveis.length} imóveis
          </Badge>
        )}
      </div>

      {error && <ErrorState error={error} hint="Verifique o token Lidderar em /configuracoes." />}
      {isLoading && <LoadingSkeleton rows={6} />}

      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard label="Famílias" value={String(k.total_familias)} icon={<Users className="h-4 w-4" />} hint="ativas" />
            <KpiCard label="Imóveis" value={String(k.total_imoveis)} icon={<Building2 className="h-4 w-4" />} hint="no portfólio" />
            <KpiCard label="Valor de mercado" value={formatBRL(k.valor_mercado, { compact: true })} icon={<TrendingUp className="h-4 w-4" />} />
            <KpiCard label="Receita mensal" value={formatBRL(k.receita_mensal, { compact: true })} icon={<Wallet className="h-4 w-4" />} hint="aluguéis ativos" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card className="lg:col-span-2 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top famílias por valor de mercado</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topFamilias.slice(0, 10)} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <XAxis dataKey="nome" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      formatter={(v: number) => formatBRL(v)}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Bar dataKey="valor_mercado" fill="hsl(var(--gold))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Status de locação</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                      {statusData.map((entry, idx) => (
                        <Cell key={idx} fill={STATUS_COLORS[entry.name] || "hsl(var(--neutral))"} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top 5 famílias</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground border-b">
                    <tr>
                      <th className="text-left px-5 py-3">Família</th>
                      <th className="text-right px-5 py-3">Imóveis</th>
                      <th className="text-right px-5 py-3">Valor mercado</th>
                      <th className="text-right px-5 py-3">Receita / mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topFamilias.slice(0, 5).map((f) => (
                      <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <Link to={`/familias/${f.id}`} className="font-medium hover:text-gold">
                            {f.nome}
                          </Link>
                        </td>
                        <td className="text-right px-5 py-3">{f.total}</td>
                        <td className="text-right px-5 py-3 font-medium">{formatBRL(f.valor_mercado)}</td>
                        <td className="text-right px-5 py-3 text-muted-foreground">{formatBRL(f.receita_mensal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Por classificação</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={classData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={75} paddingAngle={2}>
                      {classData.map((_, idx) => (
                        <Cell key={idx} fill={CLASS_COLORS[idx % CLASS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
