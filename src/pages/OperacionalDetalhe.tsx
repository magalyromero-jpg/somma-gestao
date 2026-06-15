import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, isPast, isToday, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  User,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Mail,
  Phone,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
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
  "Análise/Proposta",
];


function AbertaRow({ tarefa }: { tarefa: Tarefa }) {
  const [expanded, setExpanded] = useState(false);
  const prazoDate = tarefa.prazo ? new Date(tarefa.prazo) : null;
  const atrasado = prazoDate && isPast(prazoDate) && !isToday(prazoDate);
  const hoje = prazoDate && isToday(prazoDate);
  const diasAberto = tarefa.criado_em ? differenceInDays(new Date(), new Date(tarefa.criado_em)) : null;

  return (
    <Card className="border-border/70">
      <button onClick={() => setExpanded((v) => !v)} className="w-full text-left p-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground truncate">{tarefa.titulo}</span>
            <Badge className={`text-xs ${STATUS_COLOR[tarefa.status] ?? "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABEL[tarefa.status] ?? tarefa.status}
            </Badge>
            {tarefa.prioridade === "high" && <Badge className="text-xs bg-red-100 text-red-800">Alta</Badge>}
            {prazoDate && (
              <span className={`text-xs ${atrasado ? "text-destructive font-medium" : hoje ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                {atrasado ? "Atrasada" : hoje ? "Hoje" : format(prazoDate, "dd/MM", { locale: ptBR })}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {tarefa.responsavel_nome && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {tarefa.responsavel_nome}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {diasAberto != null
                ? `Aberta há ${diasAberto} dia${diasAberto !== 1 ? "s" : ""}`
                : "Data desconhecida"}
            </span>
          </div>
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
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0 border-t border-border/50">
          {tarefa.descricao ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap py-3">{tarefa.descricao}</p>
          ) : (
            <p className="text-sm text-muted-foreground py-3">Sem descrição.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

type AbaKey = "aberto" | "concluidas" | "mes" | "tipo" | "perfil";

interface Integrante {
  id: string;
  familia_bitrix_id: number;
  nome: string;
  relacao: string | null;
  email: string | null;
  telefone: string | null;
  observacao: string | null;
}

const RELACOES = [
  "Titular",
  "Cônjuge",
  "Filho/a",
  "Sócio/a",
  "Assessor Jurídico",
  "Contador",
  "Outro",
];

const emptyIntegrante = () => ({
  nome: "",
  relacao: "Titular",
  email: "",
  telefone: "",
  observacao: "",
});

function PerfilTab({ taskId, titulo }: { taskId: string; titulo: string }) {
  const { toast } = useToast();
  const familiaId = parseInt(taskId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState({
    area_planejamento: false,
    area_gestao_contas: false,
    area_investimentos: false,
    area_imoveis: false,
  });
  const [observacaoGeral, setObservacaoGeral] = useState("");
  const [integrantes, setIntegrantes] = useState<Integrante[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyIntegrante());
  const [adicionando, setAdicionando] = useState(false);

  const carregar = useCallback(async () => {
    if (!Number.isFinite(familiaId)) return;
    setLoading(true);
    try {
      const [{ data: perfil }, { data: ints }] = await Promise.all([
        supabase
          .from("clientes_perfil")
          .select("*")
          .eq("familia_bitrix_id", familiaId)
          .maybeSingle(),
        supabase
          .from("clientes_integrantes")
          .select("*")
          .eq("familia_bitrix_id", familiaId)
          .order("created_at", { ascending: true }),
      ]);
      if (perfil) {
        setAreas({
          area_planejamento: !!perfil.area_planejamento,
          area_gestao_contas: !!perfil.area_gestao_contas,
          area_investimentos: !!perfil.area_investimentos,
          area_imoveis: !!perfil.area_imoveis,
        });
        setObservacaoGeral(perfil.observacao_geral ?? "");
      }
      setIntegrantes((ints ?? []) as Integrante[]);
    } catch (err: any) {
      toast({ title: "Erro ao carregar perfil", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [familiaId, toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvarPerfil = useCallback(
    async (next?: Partial<typeof areas>, obs?: string) => {
      setSaving(true);
      try {
        const { error } = await supabase.from("clientes_perfil").upsert(
          {
            familia_bitrix_id: familiaId,
            familia_titulo: titulo || taskId,
            ...areas,
            ...next,
            observacao_geral: obs !== undefined ? obs : observacaoGeral,
          },
          { onConflict: "familia_bitrix_id" },
        );
        if (error) throw error;
        toast({ title: "Perfil salvo" });
      } catch (err: any) {
        toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
      } finally {
        setSaving(false);
      }
    },
    [familiaId, titulo, taskId, areas, observacaoGeral, toast],
  );

  const toggleArea = (key: keyof typeof areas) => {
    const next = { ...areas, [key]: !areas[key] };
    setAreas(next);
    salvarPerfil(next);
  };

  const salvarIntegrante = useCallback(async () => {
    if (!form.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        familia_bitrix_id: familiaId,
        nome: form.nome.trim(),
        relacao: form.relacao || null,
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        observacao: form.observacao.trim() || null,
      };
      if (editId) {
        const { error } = await supabase.from("clientes_integrantes").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clientes_integrantes").insert(payload);
        if (error) throw error;
      }
      setForm(emptyIntegrante());
      setEditId(null);
      setAdicionando(false);
      await carregar();
      toast({ title: "Integrante salvo" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar integrante", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [form, editId, familiaId, carregar, toast]);

  const editarIntegrante = (i: Integrante) => {
    setEditId(i.id);
    setAdicionando(true);
    setForm({
      nome: i.nome,
      relacao: i.relacao ?? "Outro",
      email: i.email ?? "",
      telefone: i.telefone ?? "",
      observacao: i.observacao ?? "",
    });
  };

  const excluirIntegrante = async (id: string) => {
    try {
      const { error } = await supabase.from("clientes_integrantes").delete().eq("id", id);
      if (error) throw error;
      await carregar();
      toast({ title: "Integrante removido" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Seção 1 — Áreas de serviço */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Áreas de serviço</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              { key: "area_planejamento" as const, label: "Planejamento Patrimonial" },
              { key: "area_gestao_contas" as const, label: "Gestão de Contas" },
              { key: "area_investimentos" as const, label: "Gestão de Investimentos" },
              { key: "area_imoveis" as const, label: "Gestão de Imóveis" },
            ]
          ).map((a) => (
            <label key={a.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={areas[a.key]} onCheckedChange={() => toggleArea(a.key)} disabled={saving} />
              {a.label}
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Seção 2 — Observação geral */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Observação geral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={observacaoGeral}
            onChange={(e) => setObservacaoGeral(e.target.value)}
            placeholder="Anotações gerais sobre o cliente..."
            rows={4}
          />
          <Button size="sm" onClick={() => salvarPerfil(undefined, observacaoGeral)} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </CardContent>
      </Card>

      {/* Seção 3 — Integrantes da família */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Integrantes da família</CardTitle>
          {!adicionando && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditId(null);
                setForm(emptyIntegrante());
                setAdicionando(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar integrante
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {integrantes.length === 0 && !adicionando && (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum integrante cadastrado.</p>
          )}

          {integrantes.map((i) => (
            <Card key={i.id} className="border-border/70">
              <div className="p-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground truncate">{i.nome}</span>
                    {i.relacao && <Badge variant="secondary" className="text-xs">{i.relacao}</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {i.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {i.email}
                      </span>
                    )}
                    {i.telefone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {i.telefone}
                      </span>
                    )}
                  </div>
                  {i.observacao && (
                    <button
                      onClick={() => setExpandido(expandido === i.id ? null : i.id)}
                      className="mt-2 text-xs text-primary flex items-center gap-1"
                    >
                      {expandido === i.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      Observação
                    </button>
                  )}
                  {expandido === i.id && i.observacao && (
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{i.observacao}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => editarIntegrante(i)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => excluirIntegrante(i.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {adicionando && (
            <Card className="border-primary/40">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome *</Label>
                    <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Relação</Label>
                    <Select value={form.relacao} onValueChange={(v) => setForm((f) => ({ ...f, relacao: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RELACOES.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">E-mail</Label>
                    <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefone</Label>
                    <Input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Observação</Label>
                  <Textarea value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} rows={3} />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={salvarIntegrante} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {editId ? "Salvar alterações" : "Adicionar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAdicionando(false);
                      setEditId(null);
                      setForm(emptyIntegrante());
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OperacionalDetalhe() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [titulo, setTitulo] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaKey>("aberto");

  const carregar = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setErro(null);
    try {
      const familiaId = parseInt(taskId);
      const { data, error } = await supabase
        .from("bitrix_tarefas")
        .select("*")
        .eq("familia_bitrix_id", familiaId);
      if (error) throw error;
      const lista = (data ?? []) as unknown as Tarefa[];
      setTarefas(lista);
      setTitulo((lista[0] as any)?.familia_titulo ?? taskId);
    } catch (err: any) {
      setErro(err.message ?? "Erro ao buscar tarefas");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const atualizarSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("bitrix-sync", { body: {} });
      if (error) throw error;
      toast({ title: "Sincronização concluída", description: "Tarefas atualizadas do Bitrix." });
      await carregar();
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message ?? "Falha ao sincronizar.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }, [carregar, toast]);

  const abertas = useMemo(
    () =>
      tarefas
        .filter((t) => t.status !== "completed")
        .sort((a, b) => {
          if (!a.prazo) return 1;
          if (!b.prazo) return -1;
          return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
        }),
    [tarefas],
  );

  const concluidas = useMemo(
    () =>
      tarefas
        .filter((t) => t.status === "completed")
        .sort((a, b) => {
          const da = a.concluido_em ? new Date(a.concluido_em).getTime() : 0;
          const db = b.concluido_em ? new Date(b.concluido_em).getTime() : 0;
          return db - da;
        }),
    [tarefas],
  );

  const kpis = useMemo(() => {
    const atrasadas = abertas.filter((t) => t.prazo && isPast(new Date(t.prazo)) && !isToday(new Date(t.prazo))).length;
    const dias = concluidas
      .filter((t) => t.criado_em && t.concluido_em)
      .map((t) => differenceInDays(new Date(t.concluido_em!), new Date(t.criado_em!)))
      .filter((d) => d >= 0);
    const tempoMedio = dias.length ? Math.round(dias.reduce((s, d) => s + d, 0) / dias.length) : null;
    return {
      abertas: abertas.length,
      atrasadas,
      concluidas: concluidas.length,
      tempoMedio,
    };
  }, [abertas, concluidas]);

  const concluidasPorMes = useMemo(() => {
    return concluidas.reduce((acc: Record<string, Tarefa[]>, t) => {
      const mes = t.concluido_em ? format(new Date(t.concluido_em), "MMMM yyyy", { locale: ptBR }) : "Sem data";
      (acc[mes] = acc[mes] ?? []).push(t);
      return acc;
    }, {});
  }, [concluidas]);

  const porMes = useMemo(() => {
    const map: Record<string, { criadas: number; concluidas: number }> = {};
    for (const t of tarefas) {
      if (t.criado_em) {
        const k = format(new Date(t.criado_em), "yyyy-MM");
        map[k] = map[k] ?? { criadas: 0, concluidas: 0 };
        map[k].criadas += 1;
      }
      if (t.concluido_em) {
        const k = format(new Date(t.concluido_em), "yyyy-MM");
        map[k] = map[k] ?? { criadas: 0, concluidas: 0 };
        map[k].concluidas += 1;
      }
    }
    return Object.entries(map)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([k, v]) => ({
        mes: format(new Date(`${k}-01T00:00:00`), "MMMM yyyy", { locale: ptBR }),
        criadas: v.criadas,
        concluidas: v.concluidas,
        aberto: Math.max(0, v.criadas - v.concluidas),
      }));
  }, [tarefas]);

  const porTipo = useMemo(
    () =>
      TIPOS.map((tipo) => {
        const doTipo = tarefas.filter((t) => (t.marcadores ?? []).includes(tipo));
        return {
          tipo,
          total: doTipo.length,
          abertas: doTipo.filter((t) => t.status !== "completed").length,
          concluidas: doTipo.filter((t) => t.status === "completed").length,
        };
      }).filter((r) => r.total > 0),
    [tarefas],
  );

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
            <Button variant="outline" size="sm" onClick={atualizarSync} disabled={syncing || loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              Atualizar sync
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
                <div className="text-2xl font-bold">{kpis.abertas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Atrasadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{kpis.atrasadas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas (total)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.concluidas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tempo médio de conclusão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.tempoMedio != null ? `${kpis.tempoMedio} d` : "—"}</div>
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
              { key: "mes" as const, label: "Por mês" },
              { key: "tipo" as const, label: "Por tipo" },
              { key: "perfil" as const, label: "Perfil" },
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

      {/* Aba — Em aberto */}
      {aba === "aberto" && (
        <div className="space-y-3">
          {loading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          {!loading && !erro && abertas.length === 0 && (
            <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma tarefa em aberto.</p>
          )}
          {!loading && abertas.map((t) => <AbertaRow key={t.id ?? t.bitrix_id} tarefa={t} />)}
        </div>
      )}

      {/* Aba — Concluídas */}
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
                <div className="space-y-2">
                  {lista.map((t) => {
                    const levou =
                      t.criado_em && t.concluido_em
                        ? differenceInDays(new Date(t.concluido_em), new Date(t.criado_em))
                        : null;
                    return (
                      <Card key={t.id ?? t.bitrix_id} className="border-border/70">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-foreground block truncate">{t.titulo}</span>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {t.responsavel_nome && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {t.responsavel_nome}
                                </span>
                              )}
                              {t.concluido_em && (
                                <span>Concluída {format(new Date(t.concluido_em), "dd/MM/yy", { locale: ptBR })}</span>
                              )}
                              {levou != null && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Levou {levou} dia{levou !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                          {t.link_bitrix && (
                            <a
                              href={t.link_bitrix}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md hover:bg-muted shrink-0"
                            >
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </a>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Aba — Por mês */}
      {aba === "mes" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Criadas vs. Concluídas por mês</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 rounded" />)}</div>
            ) : porMes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Sem dados por mês.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={[...porMes].reverse()} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(0, 3)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="criadas" fill="#3b82f6" name="Criadas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="concluidas" fill="#22c55e" name="Concluídas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="aberto" fill="#f59e0b" name="Em aberto no período" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aba — Por tipo */}
      {aba === "tipo" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tarefas por tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 rounded" />)}</div>
            ) : porTipo.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Nenhum tipo encontrado.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(280, porTipo.length * 48)}>
                <BarChart data={porTipo} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="tipo" width={150} tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="abertas" stackId="a" fill="#f59e0b" name="Abertas" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="concluidas" stackId="a" fill="#22c55e" name="Concluídas" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
