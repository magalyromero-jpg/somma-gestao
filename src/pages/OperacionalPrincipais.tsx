import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarClock,
  CalendarRange,
  Check,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Hourglass,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { OperacionalTabs } from "@/components/OperacionalTabs";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, fetchAll, isAtrasada, media } from "@/lib/tarefas";
import {
  PERIODO_LABEL,
  PERIODO_OPCOES,
  type PeriodoPreset,
  type PeriodoRange,
  addDias,
  concluidaNoPeriodo,
  dateParaYmd,
  fimMes,
  hojeSP,
  inicioSemana,
  labelRange,
  rangeDoPreset,
  ymdParaDate,
} from "@/lib/periodo";

const SOMMA = { escuro: "#2E3E44", medio: "#4D6571", ouro: "#CC8B15", vermelho: "#DC2626" };

const STATUS_QUERY = ["pending", "in_progress", "awaiting_control", "deferred", "completed"];
const STATUS_FILTRO = ["pending", "in_progress", "awaiting_control", "deferred"];
const STATUS_PADRAO = ["pending", "in_progress"];

const COLS =
  "bitrix_id,bitrix_parent_id,titulo,familia_titulo,status,prazo,criado_em,concluido_em,alterado_em,responsavel_nome,link_bitrix";

const SEM_RESP = "Sem responsável";
const fmtDias = (n: number | null) => (n != null ? `${n} d` : "—");

type PrazoFiltro = "todos" | "atrasadas" | "hoje" | "semana" | "mes" | "sem_prazo";
const PRAZO_LABEL: Record<PrazoFiltro, string> = {
  todos: "Todos",
  atrasadas: "Atrasadas",
  hoje: "Vence hoje",
  semana: "Esta semana",
  mes: "Este mês",
  sem_prazo: "Sem prazo",
};

/** Data de calendário (São Paulo) de um instante ISO. */
function ymdSP(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

interface Row {
  bitrix_id: number | null;
  bitrix_parent_id: number | null;
  titulo: string | null;
  familia_titulo: string | null;
  status: string;
  prazo: string | null;
  criado_em: string | null;
  concluido_em: string | null;
  alterado_em: string | null;
  responsavel_nome: string | null;
  link_bitrix: string | null;
}

interface Principal {
  id: number;
  nome: string;
  abertasLista: Row[];
  aguardandoLista: Row[];
  atrasadasLista: Row[];
  concluidasLista: Row[];
  emAberto: number;
  atrasadas: number;
  venceSemana: number;
  semPrazo: number;
  aguardando: number;
  adiadas: number;
  concluidas: number;
  pessoas: number;
  idadeMediaAtrasadas: number | null;
  tempoMedio: number | null;
  ultimaAtividade: string | null;
}

type SortKey =
  | "nome"
  | "emAberto"
  | "atrasadas"
  | "venceSemana"
  | "semPrazo"
  | "aguardando"
  | "idade"
  | "pessoas"
  | "atividade"
  | "concluidasPeriodo";
type SortDir = "asc" | "desc";

function FiltroPessoas({
  opcoes,
  selecionados,
  onChange,
}: {
  opcoes: string[];
  selecionados: string[];
  onChange: (v: string[]) => void;
}) {
  const [busca, setBusca] = useState("");
  const lista = opcoes.filter((o) => o.toLowerCase().includes(busca.toLowerCase()));
  const toggle = (n: string) =>
    onChange(selecionados.includes(n) ? selecionados.filter((x) => x !== n) : [...selecionados, n]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="mr-2 h-4 w-4" />
          Pessoas
          {selecionados.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selecionados.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <Input
          placeholder="Buscar pessoa..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="mb-2 h-8"
        />
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {lista.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
              <Checkbox checked={selecionados.includes(o)} onCheckedChange={() => toggle(o)} />
              <span className="truncate">{o}</span>
            </label>
          ))}
          {lista.length === 0 && <p className="text-sm text-muted-foreground">Nada encontrado</p>}
        </div>
        {selecionados.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => onChange([])}>
            <X className="mr-2 h-3 w-3" />
            Limpar
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Seletor discreto de período de conclusão. */
function SeletorConcluidas({
  preset,
  custom,
  range,
  onChange,
}: {
  preset: PeriodoPreset;
  custom: PeriodoRange | null;
  range: PeriodoRange | null;
  onChange: (preset: PeriodoPreset, custom: PeriodoRange | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState<DateRange | undefined>(
    custom ? { from: ymdParaDate(custom.inicio), to: ymdParaDate(custom.fim) } : undefined,
  );

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>Concluídas em:</span>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
            <CalendarRange className="mr-1.5 h-3.5 w-3.5" />
            {PERIODO_LABEL[preset]}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="end">
          <div className="flex flex-col">
            {PERIODO_OPCOES.map((p) => (
              <button
                key={p}
                onClick={() => {
                  if (p === "personalizado") {
                    onChange(p, custom);
                    return;
                  }
                  onChange(p, null);
                  setAberto(false);
                }}
                className={cn(
                  "flex items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                  preset === p && "font-medium",
                )}
              >
                {PERIODO_LABEL[p]}
                {preset === p && <Check className="ml-4 h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
          {preset === "personalizado" && (
            <div className="mt-2 border-t pt-2">
              <Calendar
                mode="range"
                selected={sel}
                onSelect={(r) => {
                  setSel(r);
                  if (r?.from && r?.to) {
                    onChange("personalizado", { inicio: dateParaYmd(r.from), fim: dateParaYmd(r.to) });
                    setAberto(false);
                  }
                }}
                numberOfMonths={1}
                className={cn("p-3 pointer-events-auto")}
              />
            </div>
          )}
        </PopoverContent>
      </Popover>
      <span className="hidden sm:inline">{labelRange(range)}</span>
    </div>
  );
}

export default function OperacionalPrincipais() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const [pessoasSel, setPessoasSel] = useState<string[]>([]);
  const [statusSel, setStatusSel] = useState<string[]>(STATUS_PADRAO);
  const [busca, setBusca] = useState("");
  const [prazoFiltro, setPrazoFiltro] = useState<PrazoFiltro>("todos");
  const [mostrarSemAbertas, setMostrarSemAbertas] = useState(false);
  const [principalSel, setPrincipalSel] = useState<number | null>(null);
  const [expandida, setExpandida] = useState<number | null>(null);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoPreset>("mes");
  const [custom, setCustom] = useState<PeriodoRange | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("atrasadas");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const range = useMemo(() => rangeDoPreset(periodo, custom), [periodo, custom]);

  const hoje = hojeSP();
  const fimSemana = useMemo(() => addDias(inicioSemana(hoje), 6), [hoje]);
  const fimDoMes = useMemo(() => fimMes(hoje), [hoje]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await fetchAll<Row>((from, to) =>
        supabase
          .from("bitrix_tarefas")
          .select(COLS)
          .not("bitrix_parent_id", "is", null)
          .in("status", STATUS_QUERY)
          .order("bitrix_id")
          .range(from, to),
      );
      setRows(data);
      setLastSync(new Date());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar tarefas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const titulosPorId = useMemo(() => {
    const m = new Map<number, string>();
    rows.forEach((r) => {
      if (r.bitrix_id != null && r.titulo) m.set(r.bitrix_id, r.titulo);
    });
    return m;
  }, [rows]);

  const opcoesPessoas = useMemo(
    () => Array.from(new Set(rows.map((r) => r.responsavel_nome ?? SEM_RESP))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  /** Classificação de prazo de uma tarefa em aberto. */
  const classePrazo = useCallback(
    (t: Row): "atrasada" | "hoje" | "semana" | "futura" | "sem_prazo" => {
      const p = ymdSP(t.prazo);
      if (!p) return "sem_prazo";
      if (p < hoje && isAtrasada(t)) return "atrasada";
      if (p === hoje) return "hoje";
      if (p <= fimSemana) return "semana";
      return "futura";
    },
    [hoje, fimSemana],
  );

  const passaPrazo = useCallback(
    (t: Row) => {
      if (prazoFiltro === "todos") return true;
      const c = classePrazo(t);
      const p = ymdSP(t.prazo);
      switch (prazoFiltro) {
        case "atrasadas":
          return c === "atrasada";
        case "hoje":
          return c === "hoje";
        case "semana":
          return c === "hoje" || c === "semana";
        case "mes":
          return !!p && p >= hoje && p <= fimDoMes;
        case "sem_prazo":
          return c === "sem_prazo";
      }
    },
    [prazoFiltro, classePrazo, hoje, fimDoMes],
  );

  const principais = useMemo<Principal[]>(() => {
    const grupos = new Map<number, Row[]>();
    for (const r of rows) {
      const pid = r.bitrix_parent_id;
      if (pid == null) continue;
      if (r.bitrix_id === pid) continue;
      if (pessoasSel.length && !pessoasSel.includes(r.responsavel_nome ?? SEM_RESP)) continue;
      const arr = grupos.get(pid);
      if (arr) arr.push(r);
      else grupos.set(pid, [r]);
    }

    const agora = new Date();
    const out: Principal[] = [];

    grupos.forEach((subs, id) => {
      let nome = titulosPorId.get(id) ?? null;
      if (!nome) {
        const cont = new Map<string, number>();
        subs.forEach((s) => {
          if (s.familia_titulo) cont.set(s.familia_titulo, (cont.get(s.familia_titulo) ?? 0) + 1);
        });
        const top = [...cont.entries()].sort((a, b) => b[1] - a[1])[0];
        nome = top ? top[0] : `Principal #${id}`;
      }

      // Situação ATUAL (nunca depende do período de conclusão)
      const atuais = subs.filter(
        (s) => s.status !== "completed" && statusSel.includes(s.status) && passaPrazo(s),
      );
      const abertasLista = atuais.filter((s) => s.status === "pending" || s.status === "in_progress");
      const aguardandoLista = atuais.filter((s) => s.status === "awaiting_control");
      const adiadas = atuais.filter((s) => s.status === "deferred").length;
      const atrasadasLista = abertasLista.filter((s) => classePrazo(s) === "atrasada");
      const venceSemana = abertasLista.filter((s) => {
        const c = classePrazo(s);
        return c === "hoje" || c === "semana";
      }).length;
      const semPrazo = abertasLista.filter((s) => classePrazo(s) === "sem_prazo").length;

      const concluidasLista = subs.filter((s) => concluidaNoPeriodo(s, range));

      const tempos = concluidasLista
        .filter((s) => s.criado_em && s.concluido_em)
        .map((s) => differenceInDays(parseISO(s.concluido_em!), parseISO(s.criado_em!)))
        .filter((n) => n >= 0);

      const idades = atrasadasLista
        .filter((s) => s.criado_em)
        .map((s) => differenceInDays(agora, parseISO(s.criado_em!)))
        .filter((n) => n >= 0);

      const ultima =
        [...atuais, ...concluidasLista]
          .map((s) => s.alterado_em)
          .filter((d): d is string => !!d)
          .sort()
          .pop() ?? null;

      out.push({
        id,
        nome,
        abertasLista,
        aguardandoLista,
        atrasadasLista,
        concluidasLista,
        emAberto: abertasLista.length,
        atrasadas: atrasadasLista.length,
        venceSemana,
        semPrazo,
        aguardando: aguardandoLista.length,
        adiadas,
        concluidas: concluidasLista.length,
        pessoas: new Set(abertasLista.map((s) => s.responsavel_nome ?? SEM_RESP)).size,
        idadeMediaAtrasadas: media(idades),
        tempoMedio: media(tempos),
        ultimaAtividade: ultima,
      });
    });

    return out.filter((p) => p.emAberto + p.aguardando + p.adiadas + p.concluidas > 0);
  }, [rows, pessoasSel, statusSel, titulosPorId, range, passaPrazo, classePrazo]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return principais.filter(
      (p) => (!q || p.nome.toLowerCase().includes(q)) && (mostrarSemAbertas || p.emAberto > 0),
    );
  }, [principais, busca, mostrarSemAbertas]);

  const kpis = useMemo(() => {
    const emAberto = filtradas.reduce((s, p) => s + p.emAberto, 0);
    const atrasadas = filtradas.reduce((s, p) => s + p.atrasadas, 0);
    const venceSemana = filtradas.reduce((s, p) => s + p.venceSemana, 0);
    const semPrazo = filtradas.reduce((s, p) => s + p.semPrazo, 0);
    const aguardando = filtradas.reduce((s, p) => s + p.aguardando, 0);
    const concl = filtradas.reduce((s, p) => s + p.concluidas, 0);
    const tempos: number[] = [];
    filtradas.forEach((p) =>
      p.concluidasLista.forEach((s) => {
        if (!s.criado_em || !s.concluido_em) return;
        const d = differenceInDays(parseISO(s.concluido_em), parseISO(s.criado_em));
        if (d >= 0) tempos.push(d);
      }),
    );
    return {
      emAberto,
      atrasadas,
      pctAtrasadas: emAberto ? Math.round((atrasadas / emAberto) * 100) : 0,
      venceSemana,
      semPrazo,
      aguardando,
      concl,
      tempoMedio: media(tempos),
    };
  }, [filtradas]);

  const dadosGrafico = useMemo(
    () =>
      [...filtradas]
        .filter((p) => p.emAberto > 0)
        .sort((a, b) => b.emAberto - a.emAberto)
        .slice(0, 15)
        .map((p) => ({
          id: p.id,
          nome: p.nome.length > 32 ? `${p.nome.slice(0, 32)}…` : p.nome,
          Atrasadas: p.atrasadas,
          "Vencem esta semana": p.venceSemana,
          "Em aberto no prazo": Math.max(0, p.emAberto - p.atrasadas - p.venceSemana - p.semPrazo),
          "Sem prazo": p.semPrazo,
        })),
    [filtradas],
  );

  const ordenadas = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (p: Principal) => {
      switch (sortKey) {
        case "nome": return p.nome.toLowerCase();
        case "emAberto": return p.emAberto;
        case "atrasadas": return p.atrasadas;
        case "venceSemana": return p.venceSemana;
        case "semPrazo": return p.semPrazo;
        case "aguardando": return p.aguardando;
        case "idade": return p.idadeMediaAtrasadas ?? -1;
        case "pessoas": return p.pessoas;
        case "atividade": return p.ultimaAtividade ?? "";
        case "concluidasPeriodo": return p.concluidas;
      }
    };
    const base = principalSel != null ? filtradas.filter((p) => p.id === principalSel) : filtradas;
    return [...base].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === "string" || typeof vb === "string")
        return String(va).localeCompare(String(vb)) * dir;
      const d = (Number(va) - Number(vb)) * dir;
      if (d !== 0) return d;
      return sortKey === "atrasadas" ? b.emAberto - a.emAberto : 0;
    });
  }, [filtradas, sortKey, sortDir, principalSel]);

  const sort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "nome" ? "asc" : "desc");
    }
  };

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-3 py-2 text-left font-medium", className)}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => sort(k)}>
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </th>
  );

  const toggleStatus = (s: string) =>
    setStatusSel((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const diasAtraso = (t: Row) => {
    const p = ymdSP(t.prazo);
    if (!p) return null;
    return differenceInDays(new Date(`${hoje}T12:00:00Z`), new Date(`${p}T12:00:00Z`));
  };

  return (
    <>
      <PageHeader
        title="Operacional"
        subtitle="Tarefas principais e suas subtarefas sincronizadas do Bitrix"
        actions={
          <div className="flex items-center gap-3">
            {lastSync && <span className="text-xs text-muted-foreground">Sync {format(lastSync, "HH:mm")}</span>}
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        }
      />

      <OperacionalTabs />

      {erro && <p className="mb-4 text-sm text-red-500">{erro}</p>}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FiltroPessoas opcoes={opcoesPessoas} selecionados={pessoasSel} onChange={setPessoasSel} />
        <div className="flex flex-wrap items-center gap-1">
          {STATUS_FILTRO.map((s) => (
            <Badge
              key={s}
              variant={statusSel.includes(s) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleStatus(s)}
            >
              {STATUS_LABEL[s] ?? s}
            </Badge>
          ))}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={prazoFiltro === "todos" ? "outline" : "default"} size="sm">
              <CalendarClock className="mr-2 h-4 w-4" />
              Prazo: {PRAZO_LABEL[prazoFiltro]}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="flex flex-col">
              {(Object.keys(PRAZO_LABEL) as PrazoFiltro[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPrazoFiltro(p)}
                  className={cn(
                    "flex items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                    prazoFiltro === p && "font-medium",
                  )}
                >
                  {PRAZO_LABEL[p]}
                  {prazoFiltro === p && <Check className="ml-4 h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar tarefa principal..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 w-64 pl-7"
          />
        </div>
        <Button
          variant={mostrarSemAbertas ? "default" : "outline"}
          size="sm"
          onClick={() => setMostrarSemAbertas((v) => !v)}
        >
          Mostrar sem tarefas em aberto
        </Button>
        {principalSel != null && (
          <Button variant="ghost" size="sm" onClick={() => setPrincipalSel(null)}>
            <X className="mr-2 h-3 w-3" />
            Limpar seleção do gráfico
          </Button>
        )}
        <div className="ml-auto">
          <SeletorConcluidas
            preset={periodo}
            custom={custom}
            range={range}
            onChange={(p, c) => {
              setPeriodo(p);
              setCustom(c);
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="mb-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Em aberto" value={String(kpis.emAberto)} icon={<Hourglass className="h-4 w-4" />} hint="Pendente + em andamento" />
            <Card className="shadow-card border-red-300/70">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs font-medium uppercase tracking-wider text-red-600">Atrasadas</div>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-red-600">
                  {kpis.atrasadas}
                  <span className="ml-2 text-sm font-medium">{kpis.pctAtrasadas}%</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">sobre as em aberto</div>
              </CardContent>
            </Card>
            <KpiCard label="Vencem esta semana" value={String(kpis.venceSemana)} icon={<CalendarClock className="h-4 w-4" />} hint="Hoje até domingo" />
            <KpiCard label="Sem prazo" value={String(kpis.semPrazo)} icon={<HelpCircle className="h-4 w-4" />} />
          </div>

          {/* Linha secundária */}
          <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-border/60 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            <span>
              Aguardando controle: <span className="font-medium text-foreground">{kpis.aguardando}</span>
            </span>
            <span>
              Concluídas no período: <span className="font-medium text-foreground">{kpis.concl}</span>
            </span>
            <span>
              Tempo médio de finalização: <span className="font-medium text-foreground">{fmtDias(kpis.tempoMedio)}</span>
            </span>
          </div>

          {/* Gráfico */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 15 principais por tarefas em aberto</CardTitle>
            </CardHeader>
            <CardContent>
              {dadosGrafico.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sem dados para os filtros atuais</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(280, dadosGrafico.length * 34)}>
                  <BarChart data={dadosGrafico} layout="vertical" margin={{ left: 12, right: 16 }}>
                    <CartesianGrid horizontal={false} strokeOpacity={0.15} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nome" width={220} tick={{ fontSize: 11 }} />
                    <RTooltip />
                    {[
                      { k: "Atrasadas", c: SOMMA.vermelho },
                      { k: "Vencem esta semana", c: SOMMA.ouro },
                      { k: "Em aberto no prazo", c: SOMMA.escuro },
                      { k: "Sem prazo", c: SOMMA.medio },
                    ].map(({ k, c }) => (
                      <Bar key={k} dataKey={k} stackId="a" fill={c} cursor="pointer">
                        {dadosGrafico.map((d) => (
                          <Cell key={d.id} onClick={() => setPrincipalSel(d.id)} />
                        ))}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Tabela */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Tarefas principais <span className="text-muted-foreground">({ordenadas.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <Th k="nome">Principal</Th>
                    <Th k="emAberto">Em aberto</Th>
                    <Th k="atrasadas">Atrasadas</Th>
                    <Th k="venceSemana">Vencem na semana</Th>
                    <Th k="semPrazo">Sem prazo</Th>
                    <Th k="aguardando">Aguard. controle</Th>
                    <Th k="idade">Idade média das atrasadas</Th>
                    <Th k="pessoas">Pessoas</Th>
                    <Th k="atividade">Última atividade</Th>
                    <Th k="concluidasPeriodo" className="text-muted-foreground/70">
                      Concluídas no período
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {ordenadas.map((p) => (
                    <Fragment key={p.id}>
                      <tr
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                        onClick={() => {
                          setExpandida((cur) => (cur === p.id ? null : p.id));
                          setVerConcluidas(false);
                        }}
                      >
                        <td className="max-w-[320px] truncate px-3 py-2 font-medium">{p.nome}</td>
                        <td className="px-3 py-2 font-medium">{p.emAberto}</td>
                        <td className="px-3 py-2">
                          {p.atrasadas > 0 ? (
                            <span className="font-semibold text-red-600">{p.atrasadas}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">{p.venceSemana || "—"}</td>
                        <td className="px-3 py-2">{p.semPrazo || "—"}</td>
                        <td className="px-3 py-2">{p.aguardando || "—"}</td>
                        <td className="px-3 py-2">{fmtDias(p.idadeMediaAtrasadas)}</td>
                        <td className="px-3 py-2">{p.pessoas}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.ultimaAtividade
                            ? format(parseISO(p.ultimaAtividade), "dd/MM/yy", { locale: ptBR })
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground/70">{p.concluidas || "—"}</td>
                      </tr>
                      {expandida === p.id && (
                        <tr className="border-b bg-muted/30">
                          <td colSpan={10} className="px-3 py-3">
                            <div className="space-y-1">
                              {[...p.abertasLista, ...p.aguardandoLista]
                                .sort((a, b) => Number(isAtrasada(b)) - Number(isAtrasada(a)))
                                .map((s) => (
                                  <div
                                    key={s.bitrix_id ?? Math.random()}
                                    className="flex flex-wrap items-center gap-2 rounded border bg-background px-2 py-1.5 text-xs"
                                  >
                                    {isAtrasada(s) && (
                                      <Badge className="bg-red-600 text-white hover:bg-red-600">
                                        Atrasada {diasAtraso(s) != null ? `${diasAtraso(s)} d` : ""}
                                      </Badge>
                                    )}
                                    <span className="flex-1 truncate">{s.titulo ?? "Sem título"}</span>
                                    <Badge variant="outline">{STATUS_LABEL[s.status] ?? s.status}</Badge>
                                    <span className="text-muted-foreground">
                                      {s.prazo
                                        ? format(parseISO(s.prazo), "dd/MM/yy", { locale: ptBR })
                                        : "sem prazo"}
                                    </span>
                                    <span className="text-muted-foreground">{s.responsavel_nome ?? SEM_RESP}</span>
                                    {s.link_bitrix && (
                                      <a
                                        href={s.link_bitrix}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 text-primary hover:underline"
                                      >
                                        Bitrix <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                ))}
                              {p.abertasLista.length + p.aguardandoLista.length === 0 && (
                                <p className="text-xs text-muted-foreground">Nenhuma tarefa em aberto</p>
                              )}
                            </div>

                            {p.concluidasLista.length > 0 && (
                              <div className="mt-3 border-t pt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVerConcluidas((v) => !v);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", verConcluidas && "rotate-180")} />
                                  Concluídas no período ({p.concluidasLista.length})
                                </button>
                                {verConcluidas && (
                                  <div className="mt-2 space-y-1">
                                    {p.concluidasLista.map((s) => (
                                      <div
                                        key={s.bitrix_id ?? Math.random()}
                                        className="flex flex-wrap items-center gap-2 rounded border bg-background/60 px-2 py-1.5 text-xs text-muted-foreground"
                                      >
                                        <span className="flex-1 truncate">{s.titulo ?? "Sem título"}</span>
                                        <span>
                                          {s.concluido_em
                                            ? format(parseISO(s.concluido_em), "dd/MM/yy", { locale: ptBR })
                                            : "—"}
                                        </span>
                                        <span>{s.responsavel_nome ?? SEM_RESP}</span>
                                        {s.link_bitrix && (
                                          <a
                                            href={s.link_bitrix}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="inline-flex items-center gap-1 text-primary hover:underline"
                                          >
                                            Bitrix <ExternalLink className="h-3 w-3" />
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {ordenadas.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">
                        Nenhuma tarefa principal para os filtros atuais
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
