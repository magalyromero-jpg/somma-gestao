import { useMemo } from "react";
import { ExternalLink, Flame, Search, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bloco, CORES, FaixaNumeros, chartTooltipStyle, fmtDias, tableClasses } from "./Shared";
import { FAIXAS_IDADE, FAIXAS_PRAZO, FaixaPrazo, TarefaOperacional, emAndamento, faixaIdade, faixaPrazo, familiaDaTarefa, idadeDias, prioridade, responsavelDaTarefa, tipoDaTarefa } from "@/lib/operacional";
import { cn } from "@/lib/utils";

export interface FiltrosEspelho {
  busca: string;
  soPrioridade: boolean;
  prazo: FaixaPrazo | null;
  tipo: string | null;
  responsavel: string | null;
}

export function Espelho({ tarefas, semPrazo, filtros, onFiltros, onFamilia }: { tarefas: TarefaOperacional[]; semPrazo: number; filtros: FiltrosEspelho; onFiltros: (f: FiltrosEspelho) => void; onFamilia: (nome: string) => void }) {
  const fila = useMemo(() => tarefas.filter(emAndamento), [tarefas]);
  const filtradas = useMemo(() => {
    const q = filtros.busca.trim().toLocaleLowerCase("pt-BR");
    return fila.filter((t) => {
      if (filtros.soPrioridade && !prioridade(t)) return false;
      if (filtros.prazo && faixaPrazo(t) !== filtros.prazo) return false;
      if (filtros.tipo && tipoDaTarefa(t) !== filtros.tipo) return false;
      if (filtros.responsavel && responsavelDaTarefa(t) !== filtros.responsavel) return false;
      return !q || [t.titulo, familiaDaTarefa(t), tipoDaTarefa(t), responsavelDaTarefa(t)].some((v) => v?.toLocaleLowerCase("pt-BR").includes(q));
    });
  }, [fila, filtros]);

  const contPrazo = (p: FaixaPrazo) => filtradas.filter((t) => faixaPrazo(t) === p).length;
  const atrasadas = contPrazo("atrasadas");
  const antiga = [...filtradas].filter((t) => idadeDias(t) != null).sort((a, b) => (idadeDias(b) ?? 0) - (idadeDias(a) ?? 0))[0];
  const filtrosAtivos = [filtros.prazo && FAIXAS_PRAZO.find((f) => f.key === filtros.prazo)?.label, filtros.tipo, filtros.responsavel, filtros.soPrioridade && "Prioridade"].filter(Boolean) as string[];
  const reset = () => onFiltros({ busca: "", soPrioridade: false, prazo: null, tipo: null, responsavel: null });

  const porFamilia = agrega(filtradas, familiaDaTarefa).slice(0, 14);
  const porResponsavel = agrega(filtradas, responsavelDaTarefa).slice(0, 10);
  const porTipo = conta(filtradas, tipoDaTarefa);
  const porPrazo = FAIXAS_PRAZO.map((f) => ({ nome: f.label, total: contPrazo(f.key), key: f.key }));
  const porIdade = FAIXAS_IDADE.map((f) => ({ nome: f.label, total: filtradas.filter((t) => faixaIdade(idadeDias(t)) === f.key).length }));
  const antigas = [...filtradas].sort((a, b) => (idadeDias(b) ?? -1) - (idadeDias(a) ?? -1)).slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filtros.busca} onChange={(e) => onFiltros({ ...filtros, busca: e.target.value })} placeholder="Buscar demanda, família, tipo ou responsável" className="h-9 pl-9" />
        </div>
        <Button size="sm" variant={filtros.soPrioridade ? "default" : "outline"} onClick={() => onFiltros({ ...filtros, soPrioridade: !filtros.soPrioridade })}>
          <Flame className="h-4 w-4" /> Só prioridade
        </Button>
        {filtrosAtivos.map((f) => <Badge key={f} variant="outline" className="h-7 bg-card">{f}</Badge>)}
        {(filtrosAtivos.length > 0 || filtros.busca) && <Button size="sm" variant="ghost" onClick={reset}><X className="h-4 w-4" />Limpar filtros</Button>}
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
        <Bloco titulo="Por tipo"><Donut data={porTipo} onClick={(nome) => onFiltros({ ...filtros, tipo: filtros.tipo === nome ? null : nome })} /></Bloco>
        <Bloco titulo="Por responsável"><StackedHorizontal data={porResponsavel} onClick={(nome) => onFiltros({ ...filtros, responsavel: filtros.responsavel === nome ? null : nome })} /></Bloco>
        <Bloco titulo="Por prazo"><SimpleBars data={porPrazo} onClick={(key) => onFiltros({ ...filtros, prazo: filtros.prazo === key ? null : key })} /></Bloco>
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
function StackedHorizontal({ data, onClick }: { data: { nome: string; atrasadas: number; hojeSemana: number; proximas: number }[]; onClick: (nome: string) => void }) {
  return <ResponsiveContainer width="100%" height={Math.max(240, data.length * 29)}><BarChart data={data} layout="vertical" margin={{ left: 16 }}><CartesianGrid horizontal={false} stroke={CORES.borda} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} /><YAxis dataKey="nome" type="category" width={120} tick={{ fontSize: 10 }} /><Tooltip contentStyle={chartTooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="atrasadas" name="Atrasadas" stackId="a" fill={CORES.atraso} onClick={(d) => onClick(d.nome)} cursor="pointer" /><Bar dataKey="hojeSemana" name="Hoje/semana" stackId="a" fill={CORES.ouro} onClick={(d) => onClick(d.nome)} cursor="pointer" /><Bar dataKey="proximas" name="Próximas" stackId="a" fill={CORES.secundaria} onClick={(d) => onClick(d.nome)} cursor="pointer" /></BarChart></ResponsiveContainer>;
}
function Donut({ data, onClick }: { data: { nome: string; total: number }[]; onClick: (nome: string) => void }) {
  const cores = [CORES.marca, CORES.ouro, CORES.secundaria, "hsl(var(--info))", "hsl(var(--success))", CORES.texto, CORES.borda];
  return <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data} dataKey="total" nameKey="nome" innerRadius={58} outerRadius={88} paddingAngle={2} onClick={(d) => onClick(d.nome)}>{data.map((d, i) => <Cell key={d.nome} fill={cores[i % cores.length]} cursor="pointer" />)}</Pie><Tooltip contentStyle={chartTooltipStyle} /><Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer>;
}
function SimpleBars({ data, onClick }: { data: { nome: string; total: number; key?: FaixaPrazo }[]; onClick?: (key: FaixaPrazo) => void }) {
  return <ResponsiveContainer width="100%" height={240}><BarChart data={data}><CartesianGrid vertical={false} stroke={CORES.borda} /><XAxis dataKey="nome" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip contentStyle={chartTooltipStyle} /><Bar dataKey="total" name="Demandas" fill={CORES.marca}>{data.map((d) => <Cell key={d.nome} fill={d.key === "atrasadas" ? CORES.atraso : d.key === "esta_semana" || d.key === "hoje" ? CORES.ouro : CORES.marca} cursor={onClick ? "pointer" : undefined} onClick={() => d.key && onClick?.(d.key)} />)}</Bar></BarChart></ResponsiveContainer>;
}
const fmtData = (iso: string | null) => iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(iso)) : "—";