import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { isPast, isToday, parseISO, startOfWeek } from "date-fns";
import { RefreshCw, AlertTriangle, Clock, Flame, ListTodo, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";

interface Tarefa {
  bitrix_id: number;
  familia_bitrix_id: number;
  familia_titulo: string | null;
  status: string | null;
  prioridade: string | null;
  responsavel_nome: string | null;
  prazo: string | null;
  concluido_em: string | null;
  marcadores: string[] | null;
}

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

export default function DashboardOperacional() {
  const navigate = useNavigate();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [responsavelFiltro, setResponsavelFiltro] = useState<string>("todos");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from("bitrix_tarefas")
        .select(
          "bitrix_id, familia_bitrix_id, familia_titulo, status, prioridade, responsavel_nome, prazo, concluido_em, marcadores",
        );
      if (error) throw error;
      setTarefas((data ?? []) as Tarefa[]);
    } catch (err: any) {
      setErro(err.message ?? "Erro ao buscar tarefas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const inicioSemana = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);

  // Helpers
  const isAberta = (t: Tarefa) => t.status !== "completed";
  const isAtrasada = (t: Tarefa) => {
    if (!isAberta(t) || !t.prazo) return false;
    const p = parseISO(t.prazo);
    return isPast(p) && !isToday(p);
  };
  const isAlta = (t: Tarefa) => isAberta(t) && t.prioridade === "high";
  const isConcluidaSemana = (t: Tarefa) => {
    if (!t.concluido_em) return false;
    return parseISO(t.concluido_em) >= inicioSemana;
  };

  const responsaveis = useMemo(() => {
    const set = new Set<string>();
    tarefas.forEach((t) => {
      if (t.responsavel_nome) set.add(t.responsavel_nome);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tarefas]);

  const tarefasFiltradas = useMemo(() => {
    if (responsavelFiltro === "todos") return tarefas;
    return tarefas.filter((t) => t.responsavel_nome === responsavelFiltro);
  }, [tarefas, responsavelFiltro]);

  // KPIs
  const kpis = useMemo(() => {
    return {
      emAberto: tarefasFiltradas.filter(isAberta).length,
      concluidasSemana: tarefasFiltradas.filter(isConcluidaSemana).length,
      atrasadas: tarefasFiltradas.filter(isAtrasada).length,
      altaPrioridade: tarefasFiltradas.filter(isAlta).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefasFiltradas, inicioSemana]);

  // Seção 1 — Por responsável
  const porResponsavel = useMemo(() => {
    const mapa = new Map<
      string,
      { nome: string; emAberto: number; atrasadas: number; concluidasSemana: number; alta: number }
    >();
    for (const t of tarefasFiltradas) {
      const nome = t.responsavel_nome ?? "Sem responsável";
      let r = mapa.get(nome);
      if (!r) {
        r = { nome, emAberto: 0, atrasadas: 0, concluidasSemana: 0, alta: 0 };
        mapa.set(nome, r);
      }
      if (isAberta(t)) r.emAberto++;
      if (isAtrasada(t)) r.atrasadas++;
      if (isConcluidaSemana(t)) r.concluidasSemana++;
      if (isAlta(t)) r.alta++;
    }
    return Array.from(mapa.values()).sort((a, b) => b.emAberto - a.emAberto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefasFiltradas, inicioSemana]);

  // Seção 2 — Por tipo de tarefa
  const porTipo = useMemo(() => {
    const mapa = new Map<string, { tipo: string; total: number; abertas: number; concluidas: number }>();
    TIPOS.forEach((tipo) => mapa.set(tipo, { tipo, total: 0, abertas: 0, concluidas: 0 }));
    for (const t of tarefasFiltradas) {
      const marcs = t.marcadores ?? [];
      for (const m of marcs) {
        const r = mapa.get(m);
        if (!r) continue;
        r.total++;
        if (isAberta(t)) r.abertas++;
        if (t.status === "completed") r.concluidas++;
      }
    }
    return Array.from(mapa.values()).filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  }, [tarefasFiltradas]);

  // Seção 3 — Por família
  const porFamilia = useMemo(() => {
    const mapa = new Map<
      number,
      {
        id: number;
        titulo: string;
        emAberto: number;
        atrasadas: number;
        concluidas: number;
        total: number;
      }
    >();
    for (const t of tarefasFiltradas) {
      const id = t.familia_bitrix_id;
      let f = mapa.get(id);
      if (!f) {
        f = {
          id,
          titulo: t.familia_titulo ?? String(id),
          emAberto: 0,
          atrasadas: 0,
          concluidas: 0,
          total: 0,
        };
        mapa.set(id, f);
      }
      f.total++;
      if (isAberta(t)) f.emAberto++;
      if (isAtrasada(t)) f.atrasadas++;
      if (t.status === "completed") f.concluidas++;
    }
    return Array.from(mapa.values()).sort((a, b) => b.emAberto - a.emAberto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefasFiltradas, inicioSemana]);

  return (
    <>
      <PageHeader
        title="Dashboard Operacional"
        subtitle="Resumo geral das tarefas das famílias"
        actions={
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtrar por responsável</span>
        <Select value={responsavelFiltro} onValueChange={setResponsavelFiltro}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Todos os responsáveis" />
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : (
          <>
            <KpiCard
              label="Total em aberto"
              value={String(kpis.emAberto)}
              icon={<ListTodo className="h-4 w-4" />}
              hint="Tarefas não concluídas"
            />
            <KpiCard
              label="Concluídas na semana"
              value={String(kpis.concluidasSemana)}
              icon={<CheckCircle2 className="h-4 w-4" />}
              hint="Desde segunda-feira"
            />
            <KpiCard
              label="Atrasadas"
              value={String(kpis.atrasadas)}
              icon={<Clock className="h-4 w-4" />}
              hint="Com prazo vencido"
            />
            <KpiCard
              label="Alta prioridade"
              value={String(kpis.altaPrioridade)}
              icon={<Flame className="h-4 w-4" />}
              hint="Em aberto urgentes"
            />
          </>
        )}
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
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Seção 1 — Por responsável */}
          <Card className="shadow-card border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Por responsável</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Em aberto</TableHead>
                    <TableHead className="text-right">Atrasadas</TableHead>
                    <TableHead className="text-right">Concluídas (semana)</TableHead>
                    <TableHead className="text-right">Alta prioridade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porResponsavel.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        Nenhum dado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    porResponsavel.map((r) => (
                      <TableRow key={r.nome}>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        <TableCell className="text-right">{r.emAberto}</TableCell>
                        <TableCell className="text-right text-destructive">
                          {r.atrasadas || "—"}
                        </TableCell>
                        <TableCell className="text-right">{r.concluidasSemana || "—"}</TableCell>
                        <TableCell className="text-right">{r.alta || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Seção 2 — Por tipo de tarefa */}
          <Card className="shadow-card border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Por tipo de tarefa</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Abertas</TableHead>
                    <TableHead className="text-right">Concluídas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porTipo.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        Nenhum dado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    porTipo.map((r) => (
                      <TableRow key={r.tipo}>
                        <TableCell className="font-medium">{r.tipo}</TableCell>
                        <TableCell className="text-right">{r.total}</TableCell>
                        <TableCell className="text-right">{r.abertas || "—"}</TableCell>
                        <TableCell className="text-right">{r.concluidas || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Seção 3 — Por família */}
          <Card className="shadow-card border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Por família</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Família</TableHead>
                    <TableHead className="text-right">Em aberto</TableHead>
                    <TableHead className="text-right">Atrasadas</TableHead>
                    <TableHead className="text-right">Concluídas</TableHead>
                    <TableHead className="text-right">Total histórico</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porFamilia.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        Nenhum dado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    porFamilia.map((f) => (
                      <TableRow
                        key={f.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/operacional/${f.id}`)}
                      >
                        <TableCell className="font-medium">{f.titulo}</TableCell>
                        <TableCell className="text-right">{f.emAberto}</TableCell>
                        <TableCell className="text-right text-destructive">
                          {f.atrasadas || "—"}
                        </TableCell>
                        <TableCell className="text-right">{f.concluidas || "—"}</TableCell>
                        <TableCell className="text-right">{f.total}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
