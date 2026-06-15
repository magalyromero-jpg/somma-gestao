import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, isPast, isToday, parseISO, startOfWeek, differenceInDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, AlertTriangle, Clock, Flame, ListTodo, ChevronRight, CheckCircle2, Timer, Users } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";

interface TarefaRow {
  familia_bitrix_id: number | null;
  familia_titulo: string | null;
  status: string;
  prioridade: string;
  prazo: string | null;
  criado_em: string | null;
  concluido_em: string | null;
  responsavel_nome: string | null;
  alterado_em: string | null;
  marcadores: string[] | null;
}

interface FamiliaResumo {
  id: number;
  titulo: string;
  responsavel_nome: string | null;
  ultima_atividade: string | null;
  total_abertas: number;
  atrasadas: number;
  alta_prioridade: number;
  hoje: number;
  responsaveis: Set<string>;
  tempos_resolucao: number[];
}

interface Totais {
  total_abertas: number;
  total_atrasadas: number;
  concluidas_semana: number;
  total_alta_prioridade: number;
  tempo_medio_resolucao: number | null;
}

const TIPOS_PIE = [
  "Operacional",
  "Gestão Patrimonial",
  "Acompanhamento",
  "Analítico",
  "Planejamento Patrimonial",
  "Gestão de Contas",
];

// Paleta oficial Somma
const COR_ABERTO = "#4D6571"; // azul médio
const COR_ATRASADA = "#CC8B15"; // dourado/alerta
const COR_CONCLUIDA = "#007374"; // verde-azulado
const COR_ALTA = "#2E3E44"; // escuro
const PIE_COLORS = ["#4D6571", "#6F8E9A", "#007374", "#CC8B15", "#2E3E44", "#4B646F", "#373C3C"];

export default function OperacionalBitrix() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState<TarefaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from("bitrix_tarefas")
        .select(
          "familia_bitrix_id, familia_titulo, status, prioridade, prazo, criado_em, concluido_em, responsavel_nome, alterado_em, marcadores",
        );
      if (error) throw error;
      setRaw((data ?? []) as TarefaRow[]);
      setLastSync(new Date());
    } catch (err: any) {
      setErro(err.message ?? "Erro ao buscar dados do Bitrix");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const responsaveis = useMemo(() => {
    const set = new Set<string>();
    for (const t of raw) if (t.responsavel_nome) set.add(t.responsavel_nome);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [raw]);

  const filtered = useMemo(() => {
    if (selecionados.length === 0) return raw;
    return raw.filter((t) => t.responsavel_nome && selecionados.includes(t.responsavel_nome));
  }, [raw, selecionados]);

  const toggleResponsavel = (nome: string) =>
    setSelecionados((cur) => (cur.includes(nome) ? cur.filter((n) => n !== nome) : [...cur, nome]));

  const totais: Totais = useMemo(() => {
    const inicioSemana = startOfWeek(new Date(), { weekStartsOn: 1 });
    let abertas = 0,
      atrasadas = 0,
      concluidasSemana = 0,
      alta = 0;
    const tempos: number[] = [];
    for (const t of filtered) {
      const aberta = t.status !== "completed";
      const prazo = t.prazo ? parseISO(t.prazo) : null;
      if (aberta) abertas++;
      if (aberta && prazo && isPast(prazo) && !isToday(prazo)) atrasadas++;
      if (aberta && t.prioridade === "high") alta++;
      if (t.status === "completed" && t.concluido_em) {
        const c = parseISO(t.concluido_em);
        if (c >= inicioSemana) concluidasSemana++;
        if (t.criado_em) {
          const d = differenceInDays(parseISO(t.concluido_em), parseISO(t.criado_em));
          if (d >= 0) tempos.push(d);
        }
      }
    }
    return {
      total_abertas: abertas,
      total_atrasadas: atrasadas,
      concluidas_semana: concluidasSemana,
      total_alta_prioridade: alta,
      tempo_medio_resolucao: tempos.length
        ? Math.round(tempos.reduce((s, d) => s + d, 0) / tempos.length)
        : null,
    };
  }, [filtered]);

  const familias = useMemo(() => {
    const mapa = new Map<number, FamiliaResumo>();
    for (const t of filtered) {
      if (t.familia_bitrix_id == null) continue;
      const id = t.familia_bitrix_id;
      const prazo = t.prazo ? parseISO(t.prazo) : null;
      const alterado = t.alterado_em ? parseISO(t.alterado_em) : null;
      const aberta = t.status !== "completed";
      const atrasada = aberta && prazo ? isPast(prazo) && !isToday(prazo) : false;
      const alta = aberta && t.prioridade === "high";
      const venceHoje = aberta && prazo ? isToday(prazo) : false;

      let f = mapa.get(id);
      if (!f) {
        f = {
          id,
          titulo: t.familia_titulo ?? String(id),
          responsavel_nome: t.responsavel_nome ?? null,
          ultima_atividade: alterado ? t.alterado_em : null,
          total_abertas: 0,
          atrasadas: 0,
          alta_prioridade: 0,
          hoje: 0,
          responsaveis: new Set<string>(),
          tempos_resolucao: [],
        };
        mapa.set(id, f);
      }
      if (t.status === "completed" && t.criado_em && t.concluido_em) {
        const d = differenceInDays(parseISO(t.concluido_em), parseISO(t.criado_em));
        if (d >= 0) f.tempos_resolucao.push(d);
      }
      if (t.responsavel_nome) f.responsaveis.add(t.responsavel_nome);
      if (aberta) f.total_abertas++;
      if (atrasada) f.atrasadas++;
      if (alta) f.alta_prioridade++;
      if (venceHoje) f.hoje++;
      if (alterado) {
        const cur = f.ultima_atividade ? parseISO(f.ultima_atividade) : null;
        if (!cur || alterado > cur) f.ultima_atividade = t.alterado_em;
      }
      if (t.responsavel_nome && !f.responsavel_nome) f.responsavel_nome = t.responsavel_nome;
    }
    return Array.from(mapa.values()).sort((a, b) => a.titulo.localeCompare(b.titulo));
  }, [filtered]);

  // ---- Dados dos gráficos ----
  const chartFamilias = useMemo(
    () =>
      familias
        .map((f) => ({
          nome: f.titulo,
          atrasadas: f.atrasadas,
          no_prazo: Math.max(0, f.total_abertas - f.atrasadas),
          abertas: f.total_abertas,
          tempo_medio: f.tempos_resolucao.length
            ? Math.round(f.tempos_resolucao.reduce((s, d) => s + d, 0) / f.tempos_resolucao.length)
            : null,
        }))
        .filter((f) => f.abertas > 0)
        .sort((a, b) => b.abertas - a.abertas)
        .slice(0, 12),
    [familias],
  );

  const chartMeses = useMemo(() => {
    const now = new Date();
    const keys: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      keys.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM/yy", { locale: ptBR }) });
    }
    const map: Record<string, { criadas: number; concluidas: number }> = {};
    for (const k of keys) map[k.key] = { criadas: 0, concluidas: 0 };
    for (const t of filtered) {
      if (t.criado_em) {
        const k = format(parseISO(t.criado_em), "yyyy-MM");
        if (map[k]) map[k].criadas++;
      }
      if (t.concluido_em) {
        const k = format(parseISO(t.concluido_em), "yyyy-MM");
        if (map[k]) map[k].concluidas++;
      }
    }
    return keys.map((k) => ({ mes: k.label, criadas: map[k.key].criadas, concluidas: map[k.key].concluidas }));
  }, [filtered]);

  const chartTipos = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of filtered) {
      if (t.status === "completed") continue;
      const marc = t.marcadores ?? [];
      const tipo = TIPOS_PIE.find((tp) => marc.includes(tp)) ?? "Outros";
      counts[tipo] = (counts[tipo] ?? 0) + 1;
    }
    const ordem = [...TIPOS_PIE, "Outros"];
    return ordem
      .map((tipo) => ({ tipo, total: counts[tipo] ?? 0 }))
      .filter((r) => r.total > 0);
  }, [filtered]);

  const chartResponsaveis = useMemo(() => {
    const map: Record<string, { abertas: number; atrasadas: number }> = {};
    for (const t of filtered) {
      if (t.status === "completed") continue;
      const nome = t.responsavel_nome ?? "Sem responsável";
      map[nome] = map[nome] ?? { abertas: 0, atrasadas: 0 };
      map[nome].abertas++;
      const prazo = t.prazo ? parseISO(t.prazo) : null;
      if (prazo && isPast(prazo) && !isToday(prazo)) map[nome].atrasadas++;
    }
    return Object.entries(map)
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.abertas - a.abertas)
      .slice(0, 12);
  }, [filtered]);

  const familiasFiltradas = familias;

  return (
    <>
      <PageHeader
        title="Operacional"
        subtitle="Tarefas das famílias sincronizadas do Bitrix"
        actions={
          <div className="flex items-center gap-3">
            {lastSync && (
              <span className="text-xs text-muted-foreground">Sync {format(lastSync, "HH:mm")}</span>
            )}
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {loading ? (
          [1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : (
          <>
            <KpiCard label="Em aberto" value={String(totais.total_abertas)} icon={<ListTodo className="h-4 w-4" />} hint="Todas as famílias" />
            <KpiCard label="Atrasadas" value={String(totais.total_atrasadas)} icon={<Clock className="h-4 w-4" />} hint="Com prazo vencido" />
            <KpiCard label="Concluídas esta semana" value={String(totais.concluidas_semana)} icon={<CheckCircle2 className="h-4 w-4" />} hint="Desde segunda-feira" />
            <KpiCard label="Alta prioridade" value={String(totais.total_alta_prioridade)} icon={<Flame className="h-4 w-4" />} hint="Marcadas como urgentes" />
            <KpiCard label="Tempo médio resolução" value={totais.tempo_medio_resolucao != null ? `${totais.tempo_medio_resolucao} d` : "—"} icon={<Timer className="h-4 w-4" />} hint="Concluídas, criação → conclusão" />
          </>
        )}
      </div>

      {/* Filtro multi-seleção de responsáveis */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="justify-start">
              <Users className="h-4 w-4 mr-2" />
              {selecionados.length === 0
                ? "Todos os responsáveis"
                : `${selecionados.length} responsáve${selecionados.length > 1 ? "is" : "l"}`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
              {responsaveis.map((r) => (
                <label key={r} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
                  <Checkbox checked={selecionados.includes(r)} onCheckedChange={() => toggleResponsavel(r)} />
                  <span className="truncate">{r}</span>
                </label>
              ))}
            </div>
            {selecionados.length > 0 && (
              <div className="border-t border-border p-2">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelecionados([])}>
                  Limpar seleção
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Gráficos estratégicos */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tarefas em aberto por família</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartFamilias} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11 }} />
                  <RTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as any;
                      return (
                        <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-xl">
                          <p className="font-medium mb-1">{d.nome}</p>
                          <p>Em aberto: {d.abertas}</p>
                          <p>Atrasadas: {d.atrasadas}</p>
                          <p>Tempo médio: {d.tempo_medio != null ? `${d.tempo_medio} d` : "—"}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="no_prazo" stackId="a" fill="#f59e0b" name="No prazo" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="atrasadas" stackId="a" fill="#ef4444" name="Atrasadas" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Volume mensal (últimos 6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartMeses} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="criadas" fill="#3b82f6" name="Criadas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="concluidas" fill="#22c55e" name="Concluídas" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Distribuição por tipo (em aberto)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={chartTipos}
                    dataKey="total"
                    nameKey="tipo"
                    cx="40%"
                    cy="50%"
                    outerRadius={90}
                  >
                    {chartTipos.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value, entry: any) => {
                      const total = chartTipos.reduce((s, t) => s + t.total, 0);
                      const pct = total ? Math.round((entry.payload.total / total) * 100) : 0;
                      return `${value} (${pct}%)`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Carga por responsável</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartResponsaveis} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="abertas" fill="#f59e0b" name="Em aberto" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="atrasadas" fill="#ef4444" name="Atrasadas" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {erro && (
        <Card className="border-destructive/40 mb-4">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <p className="text-sm text-destructive">{erro}</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : familiasFiltradas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Nenhum cliente encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {familiasFiltradas.map((f) => (
            <button key={f.id} onClick={() => navigate(`/operacional/${f.id}`)} className="w-full text-left">
              <Card className="shadow-card border-border/70 hover:border-foreground/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                      {f.titulo.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground truncate">{f.titulo}</span>
                        {f.atrasadas > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {f.atrasadas} atrasada{f.atrasadas > 1 ? "s" : ""}
                          </Badge>
                        )}
                        {f.hoje > 0 && (
                          <Badge className="text-xs bg-orange-500 text-white hover:bg-orange-500">
                            {f.hoje} hoje
                          </Badge>
                        )}
                        {f.alta_prioridade > 0 && (
                          <Badge className="text-xs bg-amber-400 text-amber-950 hover:bg-amber-400">
                            <Flame className="h-3 w-3 mr-1" />
                            {f.alta_prioridade}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {f.responsavel_nome && <span>{f.responsavel_nome}</span>}
                        {f.ultima_atividade && (
                          <span>Última atividade {format(new Date(f.ultima_atividade), "dd/MM", { locale: ptBR })}</span>
                        )}
                        {f.tempos_resolucao.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            Tempo médio{" "}
                            {Math.round(
                              f.tempos_resolucao.reduce((s, d) => s + d, 0) / f.tempos_resolucao.length,
                            )}{" "}
                            d
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-lg font-semibold text-foreground">{f.total_abertas}</div>
                        <div className="text-xs text-muted-foreground">em aberto</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
