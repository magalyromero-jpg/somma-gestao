import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton, ErrorState } from "@/components/LoadingState";
import { useImoveis } from "@/hooks/useApiData";
import type { Imovel } from "@/data/mock";
import { formatBRL, formatPct } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Group = { key: string; count: number; sum: number; avg: number };

const groupAvg = <K extends string>(
  rows: Imovel[],
  by: (i: Imovel) => K | undefined,
  value: (i: Imovel) => number,
  filter: (i: Imovel) => boolean = () => true,
): Group[] => {
  const map = new Map<string, { sum: number; count: number }>();
  for (const i of rows) {
    if (!filter(i)) continue;
    const k = by(i);
    if (!k) continue;
    const v = value(i);
    if (!Number.isFinite(v) || v <= 0) continue;
    const cur = map.get(k) ?? { sum: 0, count: 0 };
    cur.sum += v;
    cur.count += 1;
    map.set(k, cur);
  }
  return Array.from(map.entries())
    .map(([key, { sum, count }]) => ({ key, sum, count, avg: sum / count }))
    .sort((a, b) => b.avg - a.avg);
};

const vacancyBy = <K extends string>(
  rows: Imovel[],
  by: (i: Imovel) => K | undefined,
): { key: string; total: number; vagos: number; rate: number }[] => {
  const map = new Map<string, { total: number; vagos: number }>();
  for (const i of rows) {
    const k = by(i);
    if (!k) continue;
    const cur = map.get(k) ?? { total: 0, vagos: 0 };
    cur.total += 1;
    if (i.status === "Vago") cur.vagos += 1;
    map.set(k, cur);
  }
  return Array.from(map.entries())
    .map(([key, { total, vagos }]) => ({
      key,
      total,
      vagos,
      rate: total > 0 ? (vagos / total) * 100 : 0,
    }))
    .sort((a, b) => b.rate - a.rate);
};

const PALETTE = ["#CC8B15", "#185FA5", "#2D7A4F", "#9A6B0A", "#4D6571", "#C0392B", "#2E3E44"];

export default function Analytics() {
  const { imoveis, isLoading, error } = useImoveis();

  const data = useMemo(() => {
    const locados = imoveis.filter((i) => i.status === "Locado" && i.valor_aluguel_mensal > 0);
    return {
      avgRentByCity: groupAvg(locados, (i) => i.cidade, (i) => i.valor_aluguel_mensal),
      avgRentByNeighborhood: groupAvg(
        locados,
        (i) => `${i.bairro} — ${i.cidade}`,
        (i) => i.valor_aluguel_mensal,
      ),
      avgRentByType: groupAvg(locados, (i) => i.tipo, (i) => i.valor_aluguel_mensal),
      yieldByCity: (() => {
        const map = new Map<string, { rent: number; mkt: number; n: number }>();
        for (const i of locados) {
          if (i.valor_mercado <= 0) continue;
          const cur = map.get(i.cidade) ?? { rent: 0, mkt: 0, n: 0 };
          cur.rent += i.valor_aluguel_mensal * 12;
          cur.mkt += i.valor_mercado;
          cur.n += 1;
          map.set(i.cidade, cur);
        }
        return Array.from(map.entries())
          .map(([key, { rent, mkt, n }]) => ({
            key,
            count: n,
            yieldPct: mkt > 0 ? (rent / mkt) * 100 : 0,
          }))
          .sort((a, b) => b.yieldPct - a.yieldPct);
      })(),
      vacancyByCity: vacancyBy(imoveis, (i) => i.cidade),
      vacancyByType: vacancyBy(imoveis, (i) => i.tipo),
    };
  }, [imoveis]);

  return (
    <>
      <PageHeader title="Análises" subtitle="Métricas calculadas a partir do portfólio Lidderar" />

      {error && <ErrorState error={error} hint="Verifique o token Lidderar em /configuracoes." />}
      {isLoading && <LoadingSkeleton rows={6} />}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="Aluguel médio por cidade" subtitle={`${data.avgRentByCity.length} cidades · imóveis locados`}>
            <BarRow rows={data.avgRentByCity.slice(0, 12)} valueLabel="Aluguel médio" />
          </ChartCard>

          <ChartCard title="Aluguel médio por tipo de imóvel" subtitle={`${data.avgRentByType.length} tipos`}>
            <BarRow rows={data.avgRentByType.slice(0, 12)} valueLabel="Aluguel médio" />
          </ChartCard>

          <ChartCard
            title="Yield bruto anual por cidade"
            subtitle="Aluguel anual ÷ valor de mercado"
            className="lg:col-span-2"
          >
            <YieldChart rows={data.yieldByCity} />
          </ChartCard>

          <ChartCard title="Vacância por cidade" subtitle="% de imóveis vagos">
            <VacancyTable rows={data.vacancyByCity} />
          </ChartCard>

          <ChartCard title="Vacância por tipo de imóvel" subtitle="% de imóveis vagos">
            <VacancyTable rows={data.vacancyByType} />
          </ChartCard>

          <ChartCard
            title="Aluguel médio por bairro"
            subtitle={`${data.avgRentByNeighborhood.length} bairros · ordenável`}
            className="lg:col-span-2"
          >
            <NeighborhoodTable rows={data.avgRentByNeighborhood} />
          </ChartCard>
        </div>
      )}
    </>
  );
}

const ChartCard = ({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <Card className={cn("shadow-card border-border/70", className)}>
    <CardHeader className="pb-2">
      <CardTitle className="text-base font-medium">{title}</CardTitle>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </CardHeader>
    <CardContent className="pt-2">{children}</CardContent>
  </Card>
);

const BarRow = ({ rows, valueLabel }: { rows: Group[]; valueLabel: string }) => {
  if (!rows.length) return <Empty />;
  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            tickFormatter={(v) => formatBRL(v as number, { compact: true })}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="key"
            width={150}
            tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number, _n, p: any) => [
              `${formatBRL(v)} (${p?.payload?.count ?? 0} imóveis)`,
              valueLabel,
            ]}
          />
          <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
            {rows.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const YieldChart = ({ rows }: { rows: { key: string; count: number; yieldPct: number }[] }) => {
  if (!rows.length) return <Empty />;
  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ left: 8, right: 16, top: 8, bottom: 24 }}>
          <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="key"
            tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
            angle={-20}
            textAnchor="end"
            height={50}
            interval={0}
          />
          <YAxis
            tickFormatter={(v) => `${(v as number).toFixed(1)}%`}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number, _n, p: any) => [
              `${(v as number).toFixed(2)}% (${p?.payload?.count ?? 0} imóveis)`,
              "Yield bruto a.a.",
            ]}
          />
          <Bar dataKey="yieldPct" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))">
            {rows.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const VacancyTable = ({
  rows,
}: {
  rows: { key: string; total: number; vagos: number; rate: number }[];
}) => {
  if (!rows.length) return <Empty />;
  return (
    <div className="max-h-[320px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Imóveis</TableHead>
            <TableHead className="text-right">Vagos</TableHead>
            <TableHead className="text-right">Vacância</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell className="font-medium">{r.key}</TableCell>
              <TableCell className="text-right tabular-nums">{r.total}</TableCell>
              <TableCell className="text-right tabular-nums">{r.vagos}</TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums font-medium",
                  r.rate >= 20 ? "text-destructive" : r.rate >= 10 ? "text-warning" : "text-success",
                )}
              >
                {formatPct(r.rate)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

type SortKey = "key" | "count" | "avg" | "sum";

const NeighborhoodTable = ({ rows }: { rows: Group[] }) => {
  const [sortKey, setSortKey] = useState<SortKey>("avg");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const av = a[sortKey] as string | number;
      const bv = b[sortKey] as string | number;
      if (typeof av === "string" && typeof bv === "string") {
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return dir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return out;
  }, [rows, sortKey, dir]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setDir(k === "key" ? "asc" : "desc");
    }
  };

  if (!rows.length) return <Empty />;

  const Th = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          align === "right" && "ml-auto",
        )}
        onClick={() => toggle(k)}
      >
        {label}
        {sortKey === k &&
          (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );

  return (
    <div className="max-h-[420px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <Th k="key" label="Bairro" />
            <Th k="count" label="Imóveis" align="right" />
            <Th k="avg" label="Aluguel médio" align="right" />
            <Th k="sum" label="Aluguel total" align="right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.key}>
              <TableCell className="font-medium">{r.key}</TableCell>
              <TableCell className="text-right tabular-nums">{r.count}</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(r.avg)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(r.sum)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const Empty = () => (
  <div className="h-[160px] grid place-items-center text-sm text-muted-foreground">
    Sem dados suficientes para calcular esta métrica.
  </div>
);
