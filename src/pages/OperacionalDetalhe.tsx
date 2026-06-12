import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  User,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface Tarefa {
  id: string;
  bitrix_id: number;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  responsavel_nome: string | null;
  prazo: string | null;
  criado_em: string | null;
  concluido_em: string | null;
  marcadores: string[] | null;
  link_bitrix: string | null;
}

interface Comentario {
  ID: string;
  POST_MESSAGE: string;
  AUTHOR_NAME: string;
  POST_DATE: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  awaiting_control: "Aguard. controle",
  completed: "Concluída",
  deferred: "Adiada",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  awaiting_control: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  deferred: "bg-gray-100 text-gray-600",
};

const TIPOS = [
  "Operacional",
  "Gestão Patrimonial",
  "Acompanhamento",
  "Analítico",
  "Planejamento Patrimonial",
  "Gestão de Contas",
  "Due Diligence Prévio",
  "Negócios",
];

function TarefaRow({ tarefa }: { tarefa: Tarefa }) {
  const [expanded, setExpanded] = useState(false);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loadingComentarios, setLoadingComentarios] = useState(false);

  async function toggleExpand() {
    if (!expanded && comentarios.length === 0) {
      setLoadingComentarios(true);
      try {
        const { data } = await supabase.functions.invoke("bitrix-proxy", {
          body: { action: "comentarios_tarefa", task_id: tarefa.bitrix_id },
        });
        setComentarios(data?.comentarios ?? []);
      } catch {
        // silently ignore
      } finally {
        setLoadingComentarios(false);
      }
    }
    setExpanded((v) => !v);
  }

  const prazoDate = tarefa.prazo ? new Date(tarefa.prazo) : null;
  const atrasado = prazoDate && isPast(prazoDate) && !isToday(prazoDate);
  const hoje = prazoDate && isToday(prazoDate);

  return (
    <Card className="border-border/70">
      <button
        onClick={toggleExpand}
        className="w-full text-left p-4 flex items-center gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground truncate">{tarefa.titulo}</span>
            <Badge className={`text-xs ${STATUS_COLOR[tarefa.status] ?? "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABEL[tarefa.status] ?? tarefa.status}
            </Badge>
            {tarefa.prioridade === "high" && (
              <Badge className="text-xs bg-red-100 text-red-800">Alta</Badge>
            )}
            {tarefa.status === "completed" && tarefa.concluido_em ? (
              <span className="text-xs text-green-600 font-medium">
                {format(new Date(tarefa.concluido_em), "dd/MM/yy", { locale: ptBR })}
              </span>
            ) : (
              prazoDate && (
                <span className={`text-xs ${atrasado ? "text-destructive font-medium" : hoje ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                  {atrasado ? "Atrasada" : hoje ? "Hoje" : format(prazoDate, "dd/MM", { locale: ptBR })}
                </span>
              )
            )}
          </div>

          {tarefa.responsavel_nome && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {tarefa.responsavel_nome}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tarefa.link_bitrix && (
            <a
              href={tarefa.link_bitrix}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0 border-t border-border/50">
          {tarefa.descricao && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap py-3">
              {tarefa.descricao}
            </p>
          )}

          <div className="mt-2">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1 mb-2">
              <MessageSquare className="h-3 w-3" />
              Comentários
            </h4>
            {loadingComentarios && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Carregando...
              </div>
            )}
            {!loadingComentarios && comentarios.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem comentários</p>
            )}
            {comentarios.map((c) => (
              <div key={c.ID} className="py-2 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{c.AUTHOR_NAME}</span>
                  <span>{format(new Date(c.POST_DATE), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{c.POST_MESSAGE}</p>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

type AbaKey = "aberto" | "concluidas" | "tipo" | "visao";

export default function OperacionalDetalhe() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [titulo, setTitulo] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [filtro, setFiltro] = useState<"todas" | "pending" | "in_progress" | "high">("todas");
  const [aba, setAba] = useState<AbaKey>("aberto");

  const carregar = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setErro(null);
    try {
      const familiaId = parseInt(taskId);

      const { data: nomeData } = await supabase
        .from("bitrix_tarefas")
        .select("familia_titulo")
        .eq("familia_bitrix_id", familiaId)
        .limit(1)
        .single();
      setTitulo(nomeData?.familia_titulo ?? taskId);

      const { data, error } = await supabase
        .from("bitrix_tarefas")
        .select("*")
        .eq("familia_bitrix_id", familiaId);
      if (error) throw error;

      setTarefas((data ?? []) as unknown as Tarefa[]);
      setLastSync(new Date());
    } catch (err: any) {
      setErro(err.message ?? "Erro ao buscar tarefas");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ---------- Derivados ----------
  const abertas = tarefas
    .filter((t) => t.status !== "completed")
    .sort((a, b) => {
      if (!a.prazo) return 1;
      if (!b.prazo) return -1;
      return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
    });

  const concluidas = tarefas
    .filter((t) => t.status === "completed")
    .sort((a, b) => {
      const da = a.concluido_em ? new Date(a.concluido_em).getTime() : 0;
      const db = b.concluido_em ? new Date(b.concluido_em).getTime() : 0;
      return db - da;
    });

  const tarefasFiltradas = abertas.filter((t) => {
    if (filtro === "high") return t.prioridade === "high";
    if (filtro === "todas") return true;
    return t.status === filtro;
  });

  const counts = {
    total: abertas.length,
    pendentes: tarefas.filter((t) => t.status === "pending").length,
    andamento: tarefas.filter((t) => t.status === "in_progress").length,
    alta: abertas.filter((t) => t.prioridade === "high").length,
    atrasadas: abertas.filter(
      (t) => t.prazo && isPast(new Date(t.prazo)) && !isToday(new Date(t.prazo))
    ).length,
  };

  const concluidasPorMes = concluidas.reduce((acc: Record<string, Tarefa[]>, t) => {
    const mes = t.concluido_em
      ? format(new Date(t.concluido_em), "MMMM yyyy", { locale: ptBR })
      : "Sem data";
    if (!acc[mes]) acc[mes] = [];
    acc[mes].push(t);
    return acc;
  }, {});

  // Aba "Por tipo"
  const porTipo = TIPOS.map((tipo) => {
    const doTipo = tarefas.filter((t) => (t.marcadores ?? []).includes(tipo));
    return {
      tipo,
      total: doTipo.length,
      abertas: doTipo.filter((t) => t.status !== "completed").length,
      concluidas: doTipo.filter((t) => t.status === "completed").length,
    };
  }).filter((r) => r.total > 0);

  // Aba "Visão geral" — por mês de criação
  const porMesVisao = (() => {
    const map: Record<string, { criadas: number; concluidas: number; aberto: number }> = {};
    const chave = (d: string) => format(new Date(d), "yyyy-MM");
    for (const t of tarefas) {
      if (t.criado_em) {
        const k = chave(t.criado_em);
        map[k] = map[k] ?? { criadas: 0, concluidas: 0, aberto: 0 };
        map[k].criadas += 1;
        if (t.status === "completed") map[k].concluidas += 1;
        else map[k].aberto += 1;
      }
    }
    return Object.entries(map)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([k, v]) => ({
        mes: format(new Date(`${k}-01T00:00:00`), "MMMM yyyy", { locale: ptBR }),
        ...v,
      }));
  })();

  return (
    <>
      <PageHeader
        title={titulo || taskId || "Detalhe"}
        subtitle="Demandas sincronizadas do Bitrix24"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/operacional")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            {lastSync && (
              <span className="text-xs text-muted-foreground">
                Sync {format(lastSync, "HH:mm")}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => carregar()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Em aberto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Atrasadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{counts.atrasadas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Em andamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts.andamento}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Alta prioridade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts.alta}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="mb-6 border-b border-border">
        <div className="flex items-center gap-1">
          {(
            [
              { key: "aberto" as const, label: "Em aberto" },
              { key: "concluidas" as const, label: "Concluídas" },
              { key: "tipo" as const, label: "Por tipo" },
              { key: "visao" as const, label: "Visão geral" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setAba(t.key)}
              className={`text-sm px-4 py-2 -mb-px border-b-2 transition-colors ${
                aba === t.key
                  ? "border-foreground text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <Card className="border-destructive/40 mb-4">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <p className="text-sm text-destructive">{erro}</p>
          </CardContent>
        </Card>
      )}

      {/* Aba 1 — Em aberto */}
      {aba === "aberto" && (
        <>
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { key: "todas" as const, label: `Todas (${counts.total})` },
                  { key: "pending" as const, label: `Pendentes (${counts.pendentes})` },
                  { key: "in_progress" as const, label: `Em andamento (${counts.andamento})` },
                  { key: "high" as const, label: `Alta prioridade (${counts.alta})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    filtro === f.key
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:border-foreground/50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {loading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
            {!loading && !erro && tarefasFiltradas.length === 0 && (
              <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma tarefa encontrada.</p>
            )}
            {!loading && tarefasFiltradas.map((t) => <TarefaRow key={t.id ?? t.bitrix_id} tarefa={t} />)}
          </div>
        </>
      )}

      {/* Aba 2 — Concluídas */}
      {aba === "concluidas" && (
        <div className="space-y-6">
          {loading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          {!loading && concluidas.length === 0 && (
            <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma tarefa concluída.</p>
          )}
          {!loading &&
            Object.entries(concluidasPorMes).map(([mes, lista]) => (
              <div key={mes}>
                <h3 className="text-sm font-semibold text-foreground capitalize mb-2">
                  {mes} <span className="text-muted-foreground font-normal">({lista.length})</span>
                </h3>
                <div className="space-y-3">
                  {lista.map((t) => (
                    <TarefaRow key={t.id ?? t.bitrix_id} tarefa={t} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Aba 3 — Por tipo */}
      {aba === "tipo" && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : porTipo.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Nenhum marcador encontrado.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-right">Em aberto</th>
                    <th className="px-4 py-3 font-medium text-right">Concluídas</th>
                  </tr>
                </thead>
                <tbody>
                  {porTipo.map((r) => (
                    <tr key={r.tipo} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-foreground">{r.tipo}</td>
                      <td className="px-4 py-3 text-right font-medium">{r.total}</td>
                      <td className="px-4 py-3 text-right">{r.abertas}</td>
                      <td className="px-4 py-3 text-right">{r.concluidas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aba 4 — Visão geral */}
      {aba === "visao" && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : porMesVisao.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Sem dados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Mês</th>
                    <th className="px-4 py-3 font-medium text-right">Criadas</th>
                    <th className="px-4 py-3 font-medium text-right">Concluídas</th>
                    <th className="px-4 py-3 font-medium text-right">Em aberto</th>
                  </tr>
                </thead>
                <tbody>
                  {porMesVisao.map((r) => (
                    <tr key={r.mes} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-foreground capitalize">{r.mes}</td>
                      <td className="px-4 py-3 text-right font-medium">{r.criadas}</td>
                      <td className="px-4 py-3 text-right text-green-600">{r.concluidas}</td>
                      <td className="px-4 py-3 text-right">{r.aberto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
