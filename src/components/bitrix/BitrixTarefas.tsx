import { useState } from "react";
import { format, isPast, isToday, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, ExternalLink, ChevronDown, ChevronUp, Clock, AlertTriangle, User, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBitrixTarefas, fetchComentariosTarefa, type BitrixTarefa, type BitrixComentario } from "./useBitrixTarefas";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", in_progress: "Em andamento", awaiting_control: "Aguardando controle", completed: "Concluída", deferred: "Adiada",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800", in_progress: "bg-blue-100 text-blue-800",
  awaiting_control: "bg-purple-100 text-purple-800", completed: "bg-green-100 text-green-800", deferred: "bg-gray-100 text-gray-600",
};

function PrazoBadge({ prazo }: { prazo: string | null }) {
  if (!prazo) return null;
  const date = new Date(prazo);
  const atrasado = isPast(date) && !isToday(date);
  const hoje = isToday(date);
  const dias = differenceInDays(date, new Date());
  return (
    <Badge variant="outline" className={`text-xs font-normal ${atrasado ? "border-red-300 text-red-600" : hoje ? "border-amber-300 text-amber-600" : "border-border text-muted-foreground"}`}>
      <Clock size={12} className="mr-1" />
      {atrasado ? `Atrasado ${Math.abs(dias)}d` : hoje ? "Hoje" : format(date, "dd/MM", { locale: ptBR })}
    </Badge>
  );
}

function PrioridadeDot({ prioridade }: { prioridade: BitrixTarefa["prioridade"] }) {
  const color = prioridade === "high" ? "bg-red-500" : prioridade === "average" ? "bg-amber-400" : "bg-gray-300";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function TarefaRow({ tarefa }: { tarefa: BitrixTarefa }) {
  const [expanded, setExpanded] = useState(false);
  const [comentarios, setComentarios] = useState<BitrixComentario[]>([]);
  const [loadingComentarios, setLoadingComentarios] = useState(false);

  async function toggleExpand() {
    if (!expanded && comentarios.length === 0) {
      setLoadingComentarios(true);
      try { setComentarios(await fetchComentariosTarefa(tarefa.bitrix_task_id)); }
      catch { } finally { setLoadingComentarios(false); }
    }
    setExpanded(v => !v);
  }

  return (
    <div
      className="border-b border-border last:border-0 rounded-lg hover:bg-accent/30 transition-colors cursor-pointer"
      onClick={toggleExpand}
    >
      <div className="flex items-center justify-between p-3 gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <PrioridadeDot prioridade={tarefa.prioridade} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium truncate">{tarefa.titulo}</span>
              <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLOR[tarefa.status]}`}>
                {STATUS_LABEL[tarefa.status]}
              </Badge>
              <PrazoBadge prazo={tarefa.prazo} />
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {tarefa.responsavel_nome && <span className="flex items-center gap-1"><User size={12} />{tarefa.responsavel_nome}</span>}
              {tarefa.marcadores.length > 0 && <span className="text-muted-foreground/70">{tarefa.marcadores.slice(1).join(" · ")}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {tarefa.link_bitrix && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); window.open(tarefa.link_bitrix!, "_blank"); }}>
              <ExternalLink size={16} />
            </Button>
          )}
          {expanded ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-dashed border-border pt-2">
          {tarefa.descricao && <div className="text-sm text-muted-foreground whitespace-pre-line mb-3">{tarefa.descricao}</div>}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2">
            <MessageSquare size={14} /> Comentários
          </div>
          {loadingComentarios && <Skeleton className="h-16 w-full" />}
          {!loadingComentarios && comentarios.length === 0 && <p className="text-xs text-muted-foreground italic">Sem comentários</p>}
          {comentarios.map(c => (
            <div key={c.ID} className="flex gap-2 mb-2 last:mb-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-foreground">{c.AUTHOR_NAME}</span>
                  <span className="text-muted-foreground">{format(new Date(c.POST_DATE), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                </div>
                <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">{c.POST_MESSAGE}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Filtro = "todas" | "pending" | "in_progress" | "high";

export function BitrixTarefas({ familiaId, marcador, familiaName }: { familiaId: string; marcador: string | null | undefined; familiaName?: string }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const { tarefas, loading, error, lastSync, refetch } = useBitrixTarefas(familiaId, marcador ?? undefined);

  if (!marcador) return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground">
        <p>Configure o marcador Bitrix desta família em Configurações → Integração Bitrix.</p>
      </CardContent>
    </Card>
  );

  const tarefasFiltradas = tarefas.filter(t => {
    if (filtro === "todas") return t.status !== "completed";
    if (filtro === "high") return t.prioridade === "high" && t.status !== "completed";
    return t.status === filtro;
  });
  const counts = {
    total: tarefas.filter(t => t.status !== "completed").length,
    pendentes: tarefas.filter(t => t.status === "pending").length,
    andamento: tarefas.filter(t => t.status === "in_progress").length,
    alta: tarefas.filter(t => t.prioridade === "high" && t.status !== "completed").length,
    atrasadas: tarefas.filter(t => t.prazo && isPast(new Date(t.prazo)) && !isToday(new Date(t.prazo)) && t.status !== "completed").length,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Tarefas Bitrix
            {counts.total > 0 && <Badge variant="secondary">{counts.total}</Badge>}
            {counts.atrasadas > 0 && <Badge variant="destructive">{counts.atrasadas} atrasada{counts.atrasadas > 1 ? "s" : ""}</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastSync && <span className="text-xs text-muted-foreground">Sync {format(lastSync, "HH:mm")}</span>}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()} disabled={loading}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          {(["todas", "pending", "in_progress", "high"] as Filtro[]).map(f => (
            <button key={f} onClick={() => setFiltro(f)} className={`text-xs px-3 py-1 rounded-full border transition-colors ${filtro === f ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/50"}`}>
              {f === "todas" ? `Todas (${counts.total})` : f === "pending" ? `Pendentes (${counts.pendentes})` : f === "in_progress" ? `Em andamento (${counts.andamento})` : `Alta prioridade (${counts.alta})`}
            </button>
          ))}
        </div>
      </CardContent>
      <CardContent className="pt-0">
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full mb-2" />)}
        {!loading && error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && tarefasFiltradas.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa encontrada.</p>}
        {!loading && tarefasFiltradas.map(t => <TarefaRow key={t.id} tarefa={t} />)}
      </CardContent>
    </Card>
  );
}
