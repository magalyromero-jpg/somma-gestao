import { useMemo } from "react";
import { ExternalLink, Flame, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bloco, CORES, FaixaNumeros, LegendaTexto, PALETA_NEUTRA, chartTooltipStyle, fmtDias, tableClasses } from "./Shared";
import { FAIXAS_IDADE, FAIXAS_PRAZO, FaixaPrazo, TarefaOperacional, emAndamento, faixaIdade, faixaPrazo, familiaDaTarefa, idadeDias, normalizarTexto, prioridade, responsavelDaTarefa, tipoDaTarefa } from "@/lib/operacional";
import { cn } from "@/lib/utils";

export interface FiltrosEspelho {
  busca: string;
  soPrioridade: boolean;
  prazo: FaixaPrazo | null;
  tipo: string | null;
  responsavel: string | null;
}

export function Espelho({ tarefas, semPrazo, filtros, onFiltros, onFamilia, onLimparTudo }: { tarefas: TarefaOperacional[]; semPrazo: number; filtros: FiltrosEspelho; onFiltros: (f: FiltrosEspelho) => void; onFamilia: (nome: string) => void; onLimparTudo?: () => void }) {
  const fila = useMemo(() => tarefas.filter(emAndamento), [tarefas]);
  const filtradas = useMemo(() => {
    const q = normalizarTexto(filtros.busca);
    return fila.filter((t) => {
      if (filtros.soPrioridade && !prioridade(t)) return false;
      if (filtros.prazo && faixaPrazo(t) !== filtros.prazo) return false;
      if (filtros.tipo && tipoDaTarefa(t) !== filtros.tipo) return false;
      if (filtros.responsavel && responsavelDaTarefa(t) !== filtros.responsavel) return false;
      return !q || [t.titulo, familiaDaTarefa(t), tipoDaTarefa(t), responsavelDaTarefa(t)].some((v) => normalizarTexto(v).includes(q));
    });
  }, [fila, filtros]);

  const contPrazo = (p: FaixaPrazo) => filtradas.filter((t) => faixaPrazo(t) === p).length;
  const atrasadas = contPrazo("atrasadas");
  const antiga = [...filtradas].filter((t) => idadeDias(t) != null).sort((a, b) => (idadeDias(b) ?? 0) - (idadeDias(a) ?? 0))[0];
  const chips: { label: string; remover: () => void }[] = [
    filtros.prazo && { label: FAIXAS_PRAZO.find((f) => f.key === filtros.prazo)?.label ?? "", remover: () => onFiltros({ ...filtros, prazo: null }) },
    filtros.tipo && { label: filtros.tipo, remover: () => onFiltros({ ...filtros, tipo: null }) },
    filtros.responsavel && { label: filtros.responsavel, remover: () => onFiltros({ ...filtros, responsavel: null }) },
    filtros.soPrioridade && { label: "Prioridade", remover: () => onFiltros({ ...filtros, soPrioridade: false }) },
  ].filter(Boolean) as { label: string; remover: () => void }[];
  const reset = () => { onFiltros({ busca: "", soPrioridade: false, prazo: null, tipo: null, responsavel: null }); onLimparTudo?.(); };

  const porFamilia = agrega(filtradas, familiaDaTarefa).slice(0, 14);
  const porResponsavel = agrega(filtradas, responsavelDaTarefa).slice(0, 10);
  const porTipo = conta(filtradas, tipoDaTarefa);
  const porPrazo = FAIXAS_PRAZO.map((f) => ({ nome: f.label, total: contPrazo(f.key), key: f.key }));
  const porIdade = FAIXAS_IDADE.map((f) => ({ nome: f.label, total: filtradas.filter((t) => faixaIdade(idadeDias(t)) === f.key).length }));
  const antigas = [...filtradas].sort((a, b) => (idadeDias(b) ?? -1) - (idadeDias(a) ?? -1)).slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={filtros.soPrioridade ? "default" : "outline"} onClick={() => onFiltros({ ...filtros, soPrioridade: !filtros.soPrioridade })}>
          <Flame className="h-4 w-4" /> Só prioridade
        </Button>
        {chips.map((c) => <Badge key={c.label} variant="outline" className="h-7 gap-1 bg-card">{c.label}<button type="button" aria-label={`Remover ${c.label}`} onClick={c.remover}><X className="h-3 w-3" /></button></Badge>)}
        {chips.length > 0 && <Button size="sm" variant="ghost" onClick={reset}><X className="h-4 w-4" />Limpar filtros</Button>}
      </div>

      <FaixaNumeros itens={[
        { label: "Em andamento", valor: filtradas.length, onClick: reset },
        { label: "Atrasadas", valor: atrasadas, detalhe: `${filtradas.length ? Math.round(atrasadas / filtradas.length * 100) : 0}% das demandas`, danger: true, ativo: filtros.prazo === "atrasadas", onClick: () => onFiltros({ ...filtros, prazo: filtros.prazo === "atrasadas" ? null : "atrasadas" }) },
        { label: "Vencem hoje", valor: contPrazo("hoje"), ativo: filtros.prazo === "hoje", onClick: () => onFiltros({ ...filtros, prazo: filtros.prazo === "hoje" ? null : "hoje" }) },
        { label: "Esta semana", valor: contPrazo("esta_semana"), ativo: filtros.prazo === "esta_semana", onClick: () => onFiltros({ ...filtros, prazo: filtros.prazo === "esta_semana" ? null : "esta_semana" }) },
        { label: "Próx. semana", valor: contPrazo("proxima_semana"), ativo: filtros.prazo === "proxima_semana", onClick: () => onFiltros({ ...filtros, prazo: filtros.prazo === "proxima_semana" ? null : "proxima_semana" }) },
        { label: "Depois", valor: contPrazo("depois"), ativo: filtros.prazo === "depois", onClick: () => onFiltros({ ...filtros, prazo: filtros.prazo === "depois" ? null : "depois" }) },
        { label: "🔥 Prioridade", valor: filtradas.filter(prioridade).length, ativo: filtros.soPrioridade, onClick: () => onFiltros({ ...filtros, soPrioridade: !filtros.soPrioridade }) },
      ]} />

      {antiga && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border-l-4 border-gold bg-card px-4 py-3 text-sm">
        <span className="text-xs font-medium uppercase text-muted-foreground">Mais antiga em andamento</span>
        <a className="inline-flex min-w-0 items-center gap-1 font-semibold hover:underline" href={antiga.link_bitrix ?? undefined} target="_blank" rel="noreferrer">{antiga.titulo ?? "Sem título"}<ExternalLink className="h-3 w-3" /></a>
        <span>{familiaDaTarefa(antiga)}</span><span>{responsavelDaTarefa(antiga)}</span><span className="tabular-nums">criada em {fmtData(antiga.criado_em)} · {fmtDias(idadeDias(antiga))}</span>
      </div>}

      <div className="grid gap-4 xl:grid-cols-2">
        <Bloco titulo="Demandas por família"><StackedHorizontal data={porFamilia} onClick={(nome) => onFamilia(nome)} /></Bloco>
        <Bloco titulo="Por tipo"><Donut data={porTipo} ativo={filtros.tipo} onClick={(nome) => onFiltros({ ...filtros, tipo: filtros.tipo === nome ? null : nome })} /></Bloco>
        <Bloco titulo="Por responsável"><StackedHorizontal data={porResponsavel} ativo={filtros.responsavel} onClick={(nome) => onFiltros({ ...filtros, responsavel: filtros.responsavel === nome ? null : nome })} /></Bloco>
        <Bloco titulo="Por prazo"><SimpleBars data={porPrazo} ativo={filtros.prazo} onClick={(key) => onFiltros({ ...filtros, prazo: filtros.prazo === key ? null : key })} /></Bloco>
        <Bloco titulo="Idade das demandas"><SimpleBars data={porIdade} /></Bloco>
        <Bloco titulo="Mais antigas em andamento">
          <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}><th className={tableClasses.th}>Demanda</th><th className={tableClasses.th}>Família</th><th className={tableClasses.th}>Responsável</th><th className={cn(tableClasses.th, "text-right")}>Idade</th></tr></thead><tbody>{antigas.map((t) => <tr key={t.bitrix_id}><td className={tableClasses.td}><a href={t.link_bitrix ?? undefined} target="_blank" rel="noreferrer" className="font-medium hover:underline">{t.titulo ?? "Sem título"}</a></td><td className={tableClasses.td}>{familiaDaTarefa(t)}</td><td className={tableClasses.td}>{responsavelDaTarefa(t)}</td><td className={cn(tableClasses.num, (idadeDias(t) ?? 0) > 365 && "font-semibold text-destructive")}>{fmtDias(idadeDias(t))}</td></tr>)}</tbody></table></div>
        </Bloco>
      </div>
      <p className="text-xs text-muted-foreground">Não entram na conta {semPrazo} tarefas sem prazo (tarefas base das famílias).</p>
    </div>
  );
}

function conta(tarefas: TarefaOperacional[], chave: (t: TarefaOperacional) => string) {
  const map = new Map<string, number>();
  tarefas.forEach((t) => map.set(chave(t), (map.get(chave(t)) ?? 0) + 1));
  return [...map].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
}
function agrega(tarefas: TarefaOperacional[], chave: (t: TarefaOperacional) => string) {
  const map = new Map<string, { nome: string; atrasadas: number; hojeSemana: number; proximas: number }>();
  tarefas.forEach((t) => { const nome = chave(t); const x = map.get(nome) ?? { nome, atrasadas: 0, hojeSemana: 0, proximas: 0 }; const f = faixaPrazo(t); if (f === "atrasadas") x.atrasadas++; else if (f === "hoje" || f === "esta_semana") x.hojeSemana++; else x.proximas++; map.set(nome, x); });
  return [...map.values()].sort((a, b) => (b.atrasadas + b.hojeSemana + b.proximas) - (a.atrasadas + a.hojeSemana + a.proximas));
}
const op = (ativo: string | null | undefined, nome: string) => (ativo && ativo !== nome ? 0.45 : 1);
function StackedHorizontal({ data, onClick, ativo }: { data: { nome: string; atrasadas: number; hojeSemana: number; proximas: number }[]; onClick: (nome: string) => void; ativo?: string | null }) {
  const segs = [{ k: "atrasadas", n: "Atrasadas", c: CORES.atraso }, { k: "hojeSemana", n: "Hoje/esta semana", c: CORES.ambar }, { k: "proximas", n: "Próximas", c: CORES.secundaria }] as const;
  return <>
    <LegendaTexto itens={segs.map((s) => ({ cor: s.c, label: s.n }))} />
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 29)}><BarChart data={data} layout="vertical" margin={{ left: 16 }} barCategoryGap={6}><CartesianGrid horizontal={false} stroke={CORES.borda} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: CORES.texto }} axisLine={false} tickLine={false} /><YAxis dataKey="nome" type="category" width={120} tick={{ fontSize: 11, fill: CORES.texto }} axisLine={false} tickLine={false} /><Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "hsl(var(--surface2))" }} />
      {segs.map((s) => <Bar key={s.k} dataKey={s.k} name={s.n} stackId="a" fill={s.c} onClick={(d) => onClick(d.nome)} cursor="pointer">{data.map((d) => <Cell key={d.nome} fillOpacity={op(ativo, d.nome)} stroke={ativo === d.nome ? "hsl(var(--gold))" : undefined} strokeWidth={ativo === d.nome ? 1 : 0} aria-pressed={ativo === d.nome} />)}</Bar>)}
    </BarChart></ResponsiveContainer></>;
}
function Donut({ data, onClick, ativo }: { data: { nome: string; total: number }[]; onClick: (nome: string) => void; ativo?: string | null }) {
  const total = data.reduce((s, d) => s + d.total, 0);
  return <div className="grid items-center gap-4 sm:grid-cols-[220px_1fr]">
    <div className="relative h-[220px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="total" nameKey="nome" innerRadius={70} outerRadius={96} paddingAngle={1} stroke="none" onClick={(d) => onClick(d.nome)}>{data.map((d, i) => <Cell key={d.nome} fill={PALETA_NEUTRA[i % PALETA_NEUTRA.length]} fillOpacity={op(ativo, d.nome)} cursor="pointer" aria-pressed={ativo === d.nome} />)}</Pie><Tooltip contentStyle={chartTooltipStyle} /></PieChart></ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-semibold tabular-nums">{total}</span><span className="text-[11px] text-muted-foreground">demandas</span></div></div>
    <ul className="space-y-1">{data.map((d, i) => <li key={d.nome}><button type="button" aria-pressed={ativo === d.nome} onClick={() => onClick(d.nome)} className={cn("flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted", ativo === d.nome && "bg-[hsl(var(--goldbg))] shadow-[inset_0_-2px_0_hsl(var(--gold))]", ativo && ativo !== d.nome && "opacity-45")}><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: PALETA_NEUTRA[i % PALETA_NEUTRA.length] }} />{d.nome}</span><span className="tabular-nums text-muted-foreground">{d.total}</span></button></li>)}</ul>
  </div>;
}
function SimpleBars({ data, onClick, ativo }: { data: { nome: string; total: number; key?: FaixaPrazo }[]; onClick?: (key: FaixaPrazo) => void; ativo?: string | null }) {
  const cor = (k?: FaixaPrazo) => k === "atrasadas" ? CORES.atraso : k === "esta_semana" || k === "hoje" ? CORES.ambar : k === "proxima_semana" ? CORES.secundaria : k === "depois" ? CORES.cinza : CORES.secundaria;
  return <ResponsiveContainer width="100%" height={240}><BarChart data={data}><CartesianGrid vertical={false} stroke={CORES.borda} /><XAxis dataKey="nome" tick={{ fontSize: 10, fill: CORES.texto }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: CORES.texto }} axisLine={false} tickLine={false} /><Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "hsl(var(--surface2))" }} /><Bar dataKey="total" name="Demandas" radius={[3, 3, 0, 0]}>{data.map((d, i) => <Cell key={d.nome} fill={d.key ? cor(d.key) : i === data.length - 1 ? CORES.atraso : CORES.secundaria} fillOpacity={op(ativo, d.key ?? "")} stroke={ativo && ativo === d.key ? "hsl(var(--gold))" : undefined} cursor={onClick ? "pointer" : undefined} aria-pressed={!!ativo && ativo === d.key} onClick={() => d.key && onClick?.(d.key)} />)}</Bar></BarChart></ResponsiveContainer>;
}
const fmtData = (iso: string | null) => iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(iso)) : "—";