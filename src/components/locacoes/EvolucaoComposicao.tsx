import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Bloco, chartTooltipStyle } from "@/components/operacional/Shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { brl, MESES, num2, pct } from "@/lib/locacoes";
import { CATEGORIAS_ALUGUEL, filtrarPeriodo, principaisUnidades, resumoComposicao, serieAluguel, type EvolucaoMensal, type MetricaAluguel, type MovimentoAluguel, type PeriodoAluguel } from "@/lib/evolucaoAluguel";

const db = supabase as any;
const COR = { salas: "hsl(var(--evolucao-salas))", lojas: "hsl(var(--evolucao-lojas))", total: "hsl(var(--evolucao-total))", reducao: "hsl(var(--evolucao-reducao))" };
const corCat: Record<string, string> = { "Reajuste por Índice": COR.lojas, "Aditivos e Renovações": COR.salas, Acordos: COR.reducao, Saídas: COR.reducao };
const mesCurto = (k: string) => `${MESES[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`;
const n2 = (v: number | null | undefined) => v == null ? "—" : num2(v);
const mil = (v: number) => `${Math.round(v / 1000).toLocaleString("pt-BR")} mil`;
const Cartao = ({ titulo, valor, dica }: { titulo: string; valor: string; dica?: string }) => <div title={dica} className="rounded-md border bg-card p-4"><div className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">{titulo}</div><div className="mt-2 text-[26px] font-extralight tabular-nums">{valor}</div></div>;

export function EvolucaoComposicao({ edificioId, hoje }: { edificioId: string; hoje: string }) {
  const mesAtual = `${hoje.slice(0, 7)}-01`;
  const q = useQuery({
    queryKey: ["loc-evolucao-composicao", edificioId, mesAtual],
    queryFn: async () => {
      const [ev, comp] = await Promise.all([db.rpc("loc_evolucao_rsm2", { p_edificio: edificioId, p_inicio: "2020-09-01", p_fim: mesAtual }), db.rpc("loc_composicao_aluguel", { p_edificio: edificioId })]);
      if (ev.error) throw ev.error;
      if (comp.error) throw comp.error;
      return { evolucao: (ev.data ?? []) as EvolucaoMensal[], composicao: (comp.data ?? []) as MovimentoAluguel[] };
    },
  });
  if (q.isLoading) return <Skeleton className="h-[720px] w-full" />;
  if (q.error) return <p className="text-sm text-destructive">Não foi possível carregar a evolução do aluguel: {(q.error as Error).message}</p>;
  return <><Periodo rows={q.data?.evolucao ?? []} hoje={hoje} /><Composicao rows={q.data?.composicao ?? []} hoje={hoje} /></>;
}

function Periodo({ rows, hoje }: { rows: EvolucaoMensal[]; hoje: string }) {
  const [metrica, setMetrica] = useState<MetricaAluguel>("rs_m2");
  const [periodo, setPeriodo] = useState<PeriodoAluguel>("tudo");
  const serie = useMemo(() => filtrarPeriodo(serieAluguel(rows, hoje), periodo, hoje), [rows, periodo, hoje]);
  const dados = serie.map((m) => ({ ...m, s: m.Salas?.[metrica] ?? null, l: m.Lojas?.[metrica] ?? null, t: metrica === "aluguel" ? m.Total?.aluguel ?? null : null }));
  const pts = dados.filter((d) => (metrica === "aluguel" ? d.t : d.s) != null);
  const ini = metrica === "aluguel" ? pts[0]?.t : pts[0]?.s, fim = metrica === "aluguel" ? pts.at(-1)?.t : pts.at(-1)?.s;
  const fmt = (v: number | null | undefined) => metrica === "rs_m2" ? brl(v) : brl(v);
  return <Bloco titulo="Evolução por Período (R$/m² e Receita Mensal)" acao={<div className="flex flex-wrap gap-2">
    <Select value={metrica} onValueChange={(v) => setMetrica(v as MetricaAluguel)}><SelectTrigger className="h-8 w-[190px]" aria-label="Métrica"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rs_m2">R$/m²</SelectItem><SelectItem value="aluguel">Receita Mensal (R$)</SelectItem></SelectContent></Select>
    <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoAluguel)}><SelectTrigger className="h-8 w-[170px]" aria-label="Período"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tudo">Tudo</SelectItem><SelectItem value="24">Últimos 24 Meses</SelectItem><SelectItem value="12">Últimos 12 Meses</SelectItem><SelectItem value="ano">Ano Atual</SelectItem></SelectContent></Select>
  </div>}>
    <div className="mb-4 grid gap-3 sm:grid-cols-3"><Cartao titulo="Início do Período" valor={fmt(ini)} /><Cartao titulo="Fim do Período" valor={fmt(fim)} /><Cartao titulo="Variação" valor={ini && fim ? pct((fim / ini - 1) * 100) : "—"} /></div>
    <div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={dados} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
      <CartesianGrid stroke="hsl(var(--line2))" vertical={false} /><XAxis dataKey="mes" tickFormatter={mesCurto} minTickGap={24} tick={{ fontSize: 11 }} /><YAxis width={76} tickFormatter={(v) => metrica === "rs_m2" ? `R$ ${num2(v)}` : mil(v)} tick={{ fontSize: 11 }} />
      <Tooltip contentStyle={chartTooltipStyle} content={({ active, payload, label }) => active && payload?.[0] ? <TooltipMes row={payload[0].payload} label={String(label)} /> : null} /><Legend verticalAlign="top" height={30} />
      <Line name="Salas" dataKey="s" stroke={COR.salas} dot={false} strokeWidth={2} connectNulls={false} /><Line name="Lojas" dataKey="l" stroke={COR.lojas} dot={false} strokeWidth={2} connectNulls={false} />{metrica === "aluguel" && <Line name="Total" dataKey="t" stroke={COR.total} strokeDasharray="5 4" dot={false} strokeWidth={2} connectNulls={false} />}
    </LineChart></ResponsiveContainer></div>
    <p className="mt-3 text-xs text-muted-foreground">R$/m² = aluguel contratual bruto ÷ área privativa da matrícula dos contratos em vigor no mês. Receita mensal = aluguel contratual bruto desses contratos. A média muda também quando entram ou saem contratos.</p>
  </Bloco>;
}

function TooltipMes({ row, label }: { row: any; label: string }) {
  return <div style={chartTooltipStyle} className="p-2"><div className="mb-1 font-medium">{mesCurto(label)}</div>{["Salas", "Lojas", "Total"].map((g) => {
    const r = row[g]; return <div key={g} className="tabular-nums"><b>{g}</b>: {r ? `Receita Mensal ${num2(r.aluguel)} · R$/m² ${num2(r.rs_m2)} · ${r.contratos} contratos · ${num2(r.area_m2)} m²` : "Sem contrato"}</div>;
  })}</div>;
}

function Composicao({ rows, hoje }: { rows: MovimentoAluguel[]; hoje: string }) {
  const [grupo, setGrupo] = useState<"Total" | "Salas" | "Lojas">("Total");
  const r = useMemo(() => resumoComposicao(rows, grupo, hoje), [rows, grupo, hoje]);
  const altura = Math.max(260, r.unidades.length * 30 + 70);
  return <Bloco titulo="Composição da Variação do Aluguel (Todo o Histórico dos Contratos)" acao={<Select value={grupo} onValueChange={(v) => setGrupo(v as any)}><SelectTrigger className="h-8 w-[130px]" aria-label="Grupo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Total">Total</SelectItem><SelectItem value="Salas">Salas</SelectItem><SelectItem value="Lojas">Lojas</SelectItem></SelectContent></Select>}>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Cartao titulo="Aluguel Inicial" valor={brl(r.inicial)} /><Cartao titulo="Aluguel Atual" valor={brl(r.atual)} /><Cartao titulo="Variação em R$" valor={brl(r.variacao)} /><Cartao titulo="Variação em %" valor={r.percentual == null ? "—" : pct(r.percentual)} /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <div><h3 className="mb-2 text-sm font-medium">Cascata do Aluguel Mensal</h3><div className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={r.cascata} margin={{ top: 24, right: 12, left: 8, bottom: 32 }}>
        <CartesianGrid stroke="hsl(var(--line2))" vertical={false} /><XAxis dataKey="categoria" interval={0} angle={-18} textAnchor="end" height={58} tick={{ fontSize: 10 }} /><YAxis width={70} tickFormatter={mil} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={chartTooltipStyle} content={({ active, payload }) => active && payload?.[0] ? <TopUnidades categoria={payload[0].payload.categoria} rows={r.itens} /> : null} />
        <Bar dataKey="base" stackId="c" fill="transparent" /><Bar dataKey="faixa" stackId="c">{r.cascata.map((x) => <Cell key={x.categoria} fill={x.total ? COR.salas : x.valor >= 0 ? COR.lojas : COR.reducao} />)}<LabelList dataKey="valor" position="top" formatter={(v: number) => num2(v)} fontSize={10} /></Bar>
      </BarChart></ResponsiveContainer></div></div>
      <div><h3 className="mb-2 text-sm font-medium">Variação por Período</h3><div className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={r.periodos} stackOffset="sign" margin={{ top: 10, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="hsl(var(--line2))" vertical={false} /><XAxis dataKey="nome" tick={{ fontSize: 11 }} /><YAxis width={70} tickFormatter={mil} tick={{ fontSize: 11 }} /><ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" /><Legend verticalAlign="top" height={34} />
        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => num2(v)} />{CATEGORIAS_ALUGUEL.map((c) => <Bar key={c} dataKey={c} stackId="p" fill={corCat[c]} />)}
      </BarChart></ResponsiveContainer></div></div>
    </div>
    <h3 className="mb-2 mt-6 text-sm font-medium">Variação por Unidade</h3><div style={{ height: altura }}><ResponsiveContainer width="100%" height="100%"><BarChart data={r.unidades} layout="vertical" stackOffset="sign" margin={{ top: 4, right: 18, left: 8, bottom: 4 }}>
      <CartesianGrid stroke="hsl(var(--line2))" horizontal={false} /><XAxis type="number" tickFormatter={mil} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="nome" width={330} interval={0} tick={{ fontSize: 10 }} /><ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" /><Legend verticalAlign="top" height={30} />
      <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => num2(v)} />{CATEGORIAS_ALUGUEL.map((c) => <Bar key={c} dataKey={c} stackId="u" fill={corCat[c]} />)}
    </BarChart></ResponsiveContainer></div>
    <p className="mt-3 text-xs text-muted-foreground">Reajuste por Índice, Aditivos e Renovações e Acordos seguem a origem registrada em cada reajuste do contrato. Saídas são contratos encerrados.</p>
  </Bloco>;
}

function TopUnidades({ categoria, rows }: { categoria: string; rows: MovimentoAluguel[] }) {
  return <div style={chartTooltipStyle} className="max-w-[420px] p-2"><div className="mb-1 font-medium">{categoria}</div>{principaisUnidades(rows, categoria).map((u) => <div key={u.unidades + u.locatario} className="tabular-nums">{u.unidades} · {u.locatario}: {num2(u.valor)}</div>)}</div>;
}