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
  Clock,
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
  bitrix_task_id: number;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  responsavel_nome: string | null;
  prazo: string | null;
  marcadores: any;
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

function TarefaRow({ tarefa }: { tarefa: Tarefa }) {
  const [expanded, setExpanded] = useState(false);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loadingComentarios, setLoadingComentarios] = useState(false);

  async function toggleExpand() {
    if (!expanded && comentarios.length === 0) {
      setLoadingComentarios(true);
      try {
        const { data } = await supabase.functions.invoke("bitrix-proxy", {
          body: { action: "comentarios_tarefa", task_id: tarefa.bitrix_task_id },
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
            {prazoDate && (
              <span className={`text-xs ${atrasado ? "text-destructive font-medium" : hoje ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                {atrasado ? "Atrasada" : hoje ? "Hoje" : format(prazoDate, "dd/MM", { locale: ptBR })}
              </span>
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

interface TarefaConcluida {
  bitrix_task_id: number;
  titulo: string;
  status: string;
  prioridade: string;
  responsavel_nome: string | null;
  prazo: string | null;
  data_conclusao: string | null;
  link_bitrix: string | null;
}

export default function OperacionalDetalhe() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [titulo, setTitulo] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [filtro, setFiltro] = useState<"todas" | "pending" | "in_progress" | "high">("todas");
  const [aba, setAba] = useState<"aberto" | "concluidas" | "visao">("aberto");

  const [concluidas, setConcluidas] = useState<TarefaConcluida[]>([]);
  const [loadingConcluidas, setLoadingConcluidas] = useState(false);
  const [erroConcluidas, setErroConcluidas] = useState<string | null>(null);
  const [concluidasCarregadas, setConcluidasCarregadas] = useState(false);


  const carregar = useCallback(
    async (force = false) => {
      if (!taskId) return;
      setLoading(true);
      setErro(null);
      try {
        const { data, error } = await supabase.functions.invoke("bitrix-proxy", {
          body: {
            action: "tarefas_por_familia",
            familia_id: taskId,
            bitrix_task_id: parseInt(taskId),
            forceRefresh: force,
          },
        });
        if (error) throw error;
        setTarefas(data.tarefas ?? []);
        setLastSync(new Date());
      } catch (err: any) {
        setErro(err.message ?? "Erro ao buscar tarefas");
      } finally {
        setLoading(false);
      }
    },
    [taskId]
  );

  useEffect(() => {
    if (taskId) {
      fetch(
        `https://sommainvestimentos.bitrix24.com.br/rest/1884/39jl8dqtycci1ff0/tasks.task.get.json?taskId=${taskId}`
      )
        .then((r) => r.json())
        .then((d) => setTitulo(d?.result?.task?.title ?? taskId));
    }
    carregar();
  }, [taskId, carregar]);

  const tarefasFiltradas = tarefas.filter((t) => {
    if (filtro === "high") return t.prioridade === "high" && t.status !== "completed";
    if (filtro === "todas") return t.status !== "completed";
    return t.status === filtro;
  });

  const counts = {
    total: tarefas.filter((t) => t.status !== "completed").length,
    pendentes: tarefas.filter((t) => t.status === "pending").length,
    andamento: tarefas.filter((t) => t.status === "in_progress").length,
    alta: tarefas.filter((t) => t.prioridade === "high" && t.status !== "completed").length,
    atrasadas: tarefas.filter(
      (t) => t.prazo && isPast(new Date(t.prazo)) && !isToday(new Date(t.prazo)) && t.status !== "completed"
    ).length,
  };

  return (
    <>
      <PageHeader
        title={titulo || taskId || "Detalhe"}
        subtitle="Demandas em aberto no Bitrix24"
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
            <Button variant="outline" size="sm" onClick={() => carregar(true)} disabled={loading}>
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

      {erro && (
        <Card className="border-destructive/40 mb-4">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <p className="text-sm text-destructive">{erro}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {loading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        {!loading && erro && <p className="text-sm text-destructive">{erro}</p>}
        {!loading && !erro && tarefasFiltradas.length === 0 && (
          <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma tarefa encontrada.</p>
        )}
        {!loading && tarefasFiltradas.map((t) => <TarefaRow key={t.id} tarefa={t} />)}
      </div>
    </>
  );
}
