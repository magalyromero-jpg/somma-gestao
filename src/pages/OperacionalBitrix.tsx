import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, isPast, isToday, parseISO, startOfWeek, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, AlertTriangle, Clock, Flame, ListTodo, ChevronRight, CheckCircle2, Timer } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function OperacionalBitrix() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState<TarefaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [responsavel, setResponsavel] = useState<string>("todos");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from("bitrix_tarefas")
        .select("familia_bitrix_id, familia_titulo, status, prioridade, prazo, criado_em, concluido_em, responsavel_nome, alterado_em");
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

  const totais: Totais = useMemo(() => {
    const inicioSemana = startOfWeek(new Date(), { weekStartsOn: 1 });
    const filtrada = responsavel === "todos" ? raw : raw.filter((t) => t.responsavel_nome === responsavel);
    let abertas = 0,
      atrasadas = 0,
      concluidasSemana = 0,
      alta = 0;
    const tempos: number[] = [];
    for (const t of filtrada) {
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
  }, [raw, responsavel]);

  const familias = useMemo(() => {
    const mapa = new Map<number, FamiliaResumo>();
    for (const t of raw) {
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
  }, [raw]);

  const familiasFiltradas = familias.filter(
    (f) => responsavel === "todos" || f.responsaveis.has(responsavel),
  );

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : (
          <>
            <KpiCard label="Em aberto" value={String(totais.total_abertas)} icon={<ListTodo className="h-4 w-4" />} hint="Todas as famílias" />
            <KpiCard label="Atrasadas" value={String(totais.total_atrasadas)} icon={<Clock className="h-4 w-4" />} hint="Com prazo vencido" />
            <KpiCard label="Concluídas esta semana" value={String(totais.concluidas_semana)} icon={<CheckCircle2 className="h-4 w-4" />} hint="Desde segunda-feira" />
            <KpiCard label="Alta prioridade" value={String(totais.total_alta_prioridade)} icon={<Flame className="h-4 w-4" />} hint="Marcadas como urgentes" />
          </>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <Select value={responsavel} onValueChange={setResponsavel}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder="Filtrar por responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os responsáveis</SelectItem>
            {responsaveis.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
