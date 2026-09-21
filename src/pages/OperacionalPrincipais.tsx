import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowUpDown,
  CalendarClock,
  Clock,
  ExternalLink,
  Hourglass,
  RefreshCw,
  Search,
  TrendingUp,
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
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, fetchAll, isAtrasada, media } from "@/lib/tarefas";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import {
  type PeriodoPreset,
  type PeriodoRange,
  concluidaNoPeriodo,
  rangeDoPreset,
} from "@/lib/periodo";

const SOMMA = { escuro: "#2E3E44", medio: "#4D6571", ouro: "#CC8B15", vermelho: "#DC2626" };

const STATUS_QUERY = ["pending", "in_progress", "awaiting_control", "deferred", "completed"];
const STATUS_FILTRO = ["pending", "in_progress", "awaiting_control", "deferred"];
const STATUS_PADRAO = ["pending", "in_progress"];

const COLS =
  "bitrix_id,bitrix_parent_id,titulo,familia_titulo,status,prazo,criado_em,concluido_em,alterado_em,responsavel_nome,link_bitrix";

const SEM_RESP = "Sem responsável";
const fmtDias = (n: number | null) => (n != null ? `${n} d` : "—");

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
  subs: Row[];
  total: number;
  abertas: number;
  aguardando: number;
  adiadas: number;
  concluidas: number;
  concluidasLista: Row[];
  atrasadas: number;
  progresso: number;
  tempoMedio: number | null;
  idadeMediaAtrasadas: number | null;
  ultimaAtividade: string | null;
}

type SortKey =
  | "nome"
  | "total"
  | "abertas"
  | "atrasadas"
  | "aguardando"
  | "concluidasPeriodo"
  | "progresso"
  | "tempo"
  | "atividade";
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

export default function OperacionalPrincipais() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const [pessoas, setPessoas] = useState<string[]>([]);
  const [statusSel, setStatusSel] = useState<string[]>(STATUS_PADRAO);
  const [busca, setBusca] = useState("");
  const [soAtrasadas, setSoAtrasadas] = useState(false);
  const [principalSel, setPrincipalSel] = useState<number | null>(null);
  const [expandida, setExpandida] = useState<number | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoPreset>("mes");
  const [custom, setCustom] = useState<PeriodoRange | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("atrasadas");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const range = useMemo(() => rangeDoPreset(periodo, custom), [periodo, custom]);

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

  const principais = useMemo<Principal[]>(() => {
    const grupos = new Map<number, Row[]>();
    for (const r of rows) {
      const pid = r.bitrix_parent_id;
      if (pid == null) continue;
      if (r.bitrix_id === pid) continue; // não conta a própria principal
      if (pessoas.length && !pessoas.includes(r.responsavel_nome ?? SEM_RESP)) continue;
      const arr = grupos.get(pid);
      if (arr) arr.push(r);
      else grupos.set(pid, [r]);
    }

    const hoje = new Date();
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

      // Situação ATUAL (não depende do período)
      const atuais = subs.filter((s) => s.status !== "completed" && statusSel.includes(s.status));
      // Concluídas dentro do período escolhido
      const concluidasLista = subs.filter((s) => concluidaNoPeriodo(s, range));

      const visiveis = [...atuais, ...concluidasLista];
      const abertas = atuais.filter((s) => s.status === "pending" || s.status === "in_progress").length;
      const aguardando = atuais.filter((s) => s.status === "awaiting_control").length;
      const adiadas = atuais.filter((s) => s.status === "deferred").length;
      const concluidas = concluidasLista.length;
      const listaAtrasadas = atuais.filter(isAtrasada);
      const base = abertas + aguardando + adiadas + concluidas;

      const tempos = concluidasLista
        .filter((s) => s.criado_em && s.concluido_em)
        .map((s) => differenceInDays(parseISO(s.concluido_em!), parseISO(s.criado_em!)))
        .filter((n) => n >= 0);

      const idades = listaAtrasadas
        .filter((s) => s.criado_em)
        .map((s) => differenceInDays(hoje, parseISO(s.criado_em!)))
        .filter((n) => n >= 0);

      const ultima = visiveis
        .map((s) => s.alterado_em)
        .filter((d): d is string => !!d)
        .sort()
        .pop() ?? null;

      out.push({
        id,
        nome,
        subs: visiveis,
        total: visiveis.length,
        abertas,
        aguardando,
        adiadas,
        concluidas,
        concluidasLista,
        atrasadas: listaAtrasadas.length,
        progresso: base ? Math.round((concluidas / base) * 100) : 0,
        tempoMedio: media(tempos),
        idadeMediaAtrasadas: media(idades),
        ultimaAtividade: ultima,
      });
    });

    // Principais sem tarefas em aberto (atuais) e sem concluídas no período saem da visão
    return out.filter((p) => p.abertas + p.aguardando + p.adiadas + p.concluidas > 0);
  }, [rows, pessoas, statusSel, titulosPorId, range]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return principais.filter(
      (p) => (!q || p.nome.toLowerCase().includes(q)) && (!soAtrasadas || p.atrasadas > 0),
    );
  }, [principais, busca, soAtrasadas]);

  const kpis = useMemo(() => {
    const subAbertas = filtradas.reduce((s, p) => s + p.abertas, 0);
    const atrasadas = filtradas.reduce((s, p) => s + p.atrasadas, 0);
    const concl = filtradas.reduce((s, p) => s + p.concluidas, 0);
    const tempos: number[] = [];
    filtradas.forEach((p) =>
      p.concluidasLista.forEach((s) => {
        if (!s.criado_em || !s.concluido_em) return;
        const d = differenceInDays(parseISO(s.concluido_em), parseISO(s.criado_em));
        if (d >= 0) tempos.push(d);
      }),
    );
    return { subAbertas, atrasadas, concl, tempoMedio: media(tempos) };
  }, [filtradas]);

  const dadosGrafico = useMemo(
    () =>
      [...filtradas]
        .sort((a, b) => b.abertas - a.abertas)
        .slice(0, 15)
        .map((p) => ({
          id: p.id,
          nome: p.nome.length > 32 ? `${p.nome.slice(0, 32)}…` : p.nome,
          "Concluídas no período": p.concluidas,
          "Em aberto": Math.max(0, p.abertas - p.atrasadas),
          "Aguard. controle": p.aguardando,
          Atrasadas: p.atrasadas,
        })),
    [filtradas],
  );

  const ordenadas = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (p: Principal) => {
      switch (sortKey) {
        case "nome": return p.nome.toLowerCase();
        case "total": return p.total;
        case "abertas": return p.abertas;
        case "atrasadas": return p.atrasadas;
        case "aguardando": return p.aguardando;
        case "concluidasPeriodo": return p.concluidas;
        case "progresso": return p.progresso;
        case "tempo": return p.tempoMedio ?? -1;
        case "atividade": return p.ultimaAtividade ?? "";
      }
    };
    const base = principalSel != null ? filtradas.filter((p) => p.id === principalSel) : filtradas;
    return [...base].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === "string" || typeof vb === "string")
        return String(va).localeCompare(String(vb)) * dir;
      return (Number(va) - Number(vb)) * dir;
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
        <FiltroPeriodo
          preset={periodo}
          custom={custom}
          range={range}
          onChange={(p, c) => {
            setPeriodo(p);
            setCustom(c);
          }}
        />
        <FiltroPessoas opcoes={opcoesPessoas} selecionados={pessoas} onChange={setPessoas} />
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
          variant={soAtrasadas ? "default" : "outline"}
          size="sm"
          onClick={() => setSoAtrasadas((v) => !v)}
        >
          <Clock className="mr-2 h-4 w-4" />
          Só com atrasadas
        </Button>
        {principalSel != null && (
          <Button variant="ghost" size="sm" onClick={() => setPrincipalSel(null)}>
            <X className="mr-2 h-3 w-3" />
            Limpar seleção do gráfico
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Concluídas no período" value={String(kpis.concl)} icon={<TrendingUp className="h-4 w-4" />} />
            <KpiCard
              label="Tempo médio de finalização"
              value={fmtDias(kpis.tempoMedio)}
              icon={<Clock className="h-4 w-4" />}
              hint="Criação → conclusão, no período"
            />
            <KpiCard label="Subtarefas em aberto" value={String(kpis.subAbertas)} icon={<Hourglass className="h-4 w-4" />} />
            <KpiCard label="Atrasadas" value={String(kpis.atrasadas)} icon={<CalendarClock className="h-4 w-4" />} />
          </div>

          {/* Gráfico */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 15 principais por subtarefas em aberto</CardTitle>
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
                      { k: "Concluídas no período", c: SOMMA.medio },
                      { k: "Em aberto", c: SOMMA.escuro },
                      { k: "Aguard. controle", c: SOMMA.ouro },
                      { k: "Atrasadas", c: SOMMA.vermelho },
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
                    <Th k="total">Total</Th>
                    <Th k="abertas">Abertas</Th>
                    <Th k="atrasadas">Atrasadas</Th>
                    <Th k="aguardando">Aguard. controle</Th>
                    <Th k="concluidasPeriodo">Concluídas no período</Th>
                    <Th k="progresso">Entrega no período</Th>
                    <Th k="tempo">Tempo médio</Th>
                    <Th k="atividade">Última atividade</Th>
                  </tr>
                </thead>
                <tbody>
                  {ordenadas.map((p) => (
                    <Fragment key={p.id}>
                      <tr
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                        onClick={() => setExpandida((cur) => (cur === p.id ? null : p.id))}
                      >
                        <td className="max-w-[320px] truncate px-3 py-2 font-medium">{p.nome}</td>
                        <td className="px-3 py-2">{p.total}</td>
                        <td className="px-3 py-2">{p.abertas}</td>
                        <td className="px-3 py-2">
                          {p.atrasadas > 0 ? (
                            <span className="font-semibold text-red-600">{p.atrasadas}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">{p.aguardando}</td>
                        <td className="px-3 py-2">{p.concluidas}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${p.progresso}%`, background: SOMMA.medio }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{p.progresso}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">{fmtDias(p.tempoMedio)}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.ultimaAtividade
                            ? format(parseISO(p.ultimaAtividade), "dd/MM/yy", { locale: ptBR })
                            : "—"}
                        </td>
                      </tr>
                      {expandida === p.id && (
                        <tr className="border-b bg-muted/30">
                          <td colSpan={9} className="px-3 py-3">
                            {p.idadeMediaAtrasadas != null && (
                              <p className="mb-2 text-xs text-muted-foreground">
                                Idade média das atrasadas: {fmtDias(p.idadeMediaAtrasadas)}
                              </p>
                            )}
                            <div className="space-y-1">
                              {[...p.subs]
                                .sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed"))
                                .sort((a, b) => Number(isAtrasada(b)) - Number(isAtrasada(a)))
                                .map((s) => (
                                  <div
                                    key={s.bitrix_id ?? Math.random()}
                                    className="flex flex-wrap items-center gap-2 rounded border bg-background px-2 py-1.5 text-xs"
                                  >
                                    {isAtrasada(s) && (
                                      <Badge className="bg-red-600 text-white hover:bg-red-600">Atrasada</Badge>
                                    )}
                                    <span className="flex-1 truncate">{s.titulo ?? "Sem título"}</span>
                                                    <Badge variant="outline">
                                      {s.status === "completed" ? "Concluída" : STATUS_LABEL[s.status] ?? s.status}
                                    </Badge>
                                    <span className="text-muted-foreground">
                                      {s.status === "completed"
                                        ? s.concluido_em
                                          ? `Concluída ${format(parseISO(s.concluido_em), "dd/MM/yy", { locale: ptBR })}`
                                          : "Concluída"
                                        : s.prazo
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
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {ordenadas.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
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
