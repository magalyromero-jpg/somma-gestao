import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, isPast, isToday, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  RefreshCw,
  Clock,
  ListTodo,
  Timer,
  Users,
  ChevronRight,
  ArrowUpDown,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";
import { cn } from "@/lib/utils";

interface TarefaRow {
  bitrix_id: number | null;
  titulo: string | null;
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

interface ConcluidaRow {
  criado_em: string | null;
  concluido_em: string | null;
  familia_titulo: string | null;
  familia_bitrix_id: number | null;
}

// Paleta oficial Somma
const SOMMA = ["#4D6571", "#2E3E44", "#6F8E9A", "#007374", "#CC8B15", "#4B646F", "#373C3C"];

// Tipos de demanda operacionais
const TIPOS_DEMANDA = [
  "Operacional",
  "Analítico",
  "Acompanhamento",
  "Gestão Patrimonial",
  "Planejamento Patrimonial",
  "Gestão de Contas",
];
const TIPOS_SET = new Set(TIPOS_DEMANDA);

const TAGS_EXCLUIR = new Set([
  "Operacional", "Analítico", "Acompanhamento", "Gestão Patrimonial",
  "Planejamento Patrimonial", "Gestão de Contas", "Due Diligence Prévio",
  "Negócios", "Análise/Proposta", "Gestão de Patrimônio",
]);


function isAtrasada(t: { prazo: string | null; status: string }): boolean {
  if (t.status === "completed" || !t.prazo) return false;
  const p = parseISO(t.prazo);
  return isPast(p) && !isToday(p);
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

type SortKey = "cliente" | "abertas" | "atrasadas" | "tipo" | "tempo" | "atividade" | "responsavel";
type SortDir = "asc" | "desc";

interface PerfilRow {
  familia_bitrix_id: number;
  responsavel_imoveis: string | null;
}

interface ClienteResumo {
  id: number | null;
  titulo: string;
  abertas: number;
  atrasadas: number;
  tipoPredominante: string;
  tempoMedio: number | null;
  ultimaAtividade: string | null;
  responsavelImoveis: string | null;
}

export default function OperacionalBitrix() {
  const navigate = useNavigate();
  const [abertas, setAbertas] = useState<TarefaRow[]>([]);
  const [concluidas, setConcluidas] = useState<ConcluidaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [perfis, setPerfis] = useState<PerfilRow[]>([]);

  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null);
  const [responsavelSelecionado, setResponsavelSelecionado] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("atrasadas");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [r1, r2, r3] = await Promise.all([
        supabase.from("bitrix_tarefas").select("*").neq("status", "completed"),
        supabase
          .from("bitrix_tarefas")
          .select("criado_em,concluido_em,familia_titulo,familia_bitrix_id")
          .eq("status", "completed")
          .not("criado_em", "is", null)
          .not("concluido_em", "is", null),
        supabase.from("clientes_perfil").select("familia_bitrix_id, responsavel_imoveis"),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      setAbertas((r1.data ?? []) as TarefaRow[]);
      setConcluidas((r2.data ?? []) as ConcluidaRow[]);
      setPerfis((r3.data ?? []) as PerfilRow[]);
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

  // Tipo de uma tarefa (primeiro tipo de demanda presente nos marcadores)
  const tipoDaTarefa = useCallback((t: TarefaRow): string | null => {
    const marc = t.marcadores ?? [];
    return TIPOS_DEMANDA.find((tp) => marc.includes(tp)) ?? null;
  }, []);

  // ---- Tempo médio de resolução por cliente (concluídas) ----
  const tempoPorCliente = useMemo(() => {
    const map = new Map<number, number[]>();
    let global: number[] = [];
    for (const c of concluidas) {
      if (!c.criado_em || !c.concluido_em) continue;
      const d = differenceInDays(parseISO(c.concluido_em), parseISO(c.criado_em));
      if (d < 0) continue;
      global.push(d);
      if (c.familia_bitrix_id != null) {
        const arr = map.get(c.familia_bitrix_id) ?? [];
        arr.push(d);
        map.set(c.familia_bitrix_id, arr);
      }
    }
    const media = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : null;
    const porCliente = new Map<number, number | null>();
    for (const [id, arr] of map) porCliente.set(id, media(arr));
    return { porCliente, global: media(global) };
  }, [concluidas]);

  const perfilPorId = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of perfis) {
      if (p.familia_bitrix_id && p.responsavel_imoveis) {
        map.set(p.familia_bitrix_id, p.responsavel_imoveis);
      }
    }
    return map;
  }, [perfis]);

  // ---- KPIs ----
  const kpis = useMemo(() => {
    const totalAbertas = abertas.length;
    const totalAtrasadas = abertas.filter(isAtrasada).length;
    const clientesAtivos = new Set(abertas.map((t) => t.familia_titulo)).size;
    return {
      totalAbertas,
      totalAtrasadas,
      tempoMedio: tempoPorCliente.global,
      totalClientes: clientesAtivos,
    };
  }, [abertas, tempoPorCliente]);

  // ---- Por tipo de demanda ----
  const porTipo = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tp of TIPOS_DEMANDA) counts[tp] = 0;
    for (const t of abertas) {
      const tp = tipoDaTarefa(t);
      if (tp) counts[tp]++;
    }
    const max = Math.max(1, ...Object.values(counts));
    return TIPOS_DEMANDA.map((tp, i) => ({
      tipo: tp,
      total: counts[tp],
      pct: (counts[tp] / max) * 100,
      cor: SOMMA[i % SOMMA.length],
    }));
  }, [abertas, tipoDaTarefa]);

  // ---- Por responsável ----
  const porResponsavel = useMemo(() => {
    const map = new Map<string, { abertas: number; atrasadas: number }>();
    for (const t of abertas) {
      const nome = t.responsavel_nome ?? "Sem responsável";
      const cur = map.get(nome) ?? { abertas: 0, atrasadas: 0 };
      cur.abertas++;
      if (isAtrasada(t)) cur.atrasadas++;
      map.set(nome, cur);
    }
    return Array.from(map.entries())
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.abertas - a.abertas);
  }, [abertas]);

  // ---- Detalhe do responsável selecionado ----
  const detalheResponsavel = useMemo(() => {
    if (!responsavelSelecionado) return null;
    const tarefas = abertas.filter((t) => (t.responsavel_nome ?? "Sem responsável") === responsavelSelecionado);
    const grupos = tarefas.reduce((acc, t) => {
      const chave = t.familia_titulo ?? "Sem família";
      if (!acc[chave]) acc[chave] = { nome: chave, familia_bitrix_id: t.familia_bitrix_id, tarefas: [] };
      acc[chave].tarefas.push(t);
      return acc;
    }, {} as Record<string, { nome: string; familia_bitrix_id: number | null; tarefas: TarefaRow[] }>);
    return {
      nome: responsavelSelecionado,
      total: tarefas.length,
      grupos: Object.values(grupos).sort((a, b) => b.tarefas.length - a.tarefas.length),
    };
  }, [abertas, responsavelSelecionado]);

  // ---- Resumo por cliente (tabela) ----
  const clientes: ClienteResumo[] = useMemo(() => {
    const map = new Map<string, ClienteResumo & { tipoCount: Record<string, number> }>();
    for (const t of abertas) {
      const chaveTitulo = t.familia_titulo ?? "Sem cliente";
      if (TAGS_EXCLUIR.has(chaveTitulo)) continue;
      const key = t.familia_bitrix_id != null ? `id:${t.familia_bitrix_id}` : `nome:${chaveTitulo}`;
      let c = map.get(key);
      if (!c) {
        c = {
          id: t.familia_bitrix_id,
          titulo: chaveTitulo,
          abertas: 0,
          atrasadas: 0,
          tipoPredominante: "—",
          tempoMedio: t.familia_bitrix_id != null ? tempoPorCliente.porCliente.get(t.familia_bitrix_id) ?? null : null,
          ultimaAtividade: null,
          responsavelImoveis: t.familia_bitrix_id != null ? (perfilPorId.get(t.familia_bitrix_id) ?? null) : null,
          tipoCount: {},
        };
        map.set(key, c);
      }
      c.abertas++;
      if (isAtrasada(t)) c.atrasadas++;
      // tipo predominante: expande marcadores excluindo nome do cliente e não-operacionais
      for (const m of t.marcadores ?? []) {
        if (m === c.titulo) continue;
        if (!TIPOS_SET.has(m)) continue;
        c.tipoCount[m] = (c.tipoCount[m] ?? 0) + 1;
      }
      const alterado = t.alterado_em ?? t.criado_em;
      if (alterado) {
        if (!c.ultimaAtividade || parseISO(alterado) > parseISO(c.ultimaAtividade)) c.ultimaAtividade = alterado;
      }
    }
    return Array.from(map.values()).map((c) => {
      const entries = Object.entries(c.tipoCount).sort((a, b) => b[1] - a[1]);
      return { ...c, tipoPredominante: entries.length ? entries[0][0] : "—" };
    });
  }, [abertas, tempoPorCliente, perfilPorId]);

  // ---- Filtragem da tabela ----
  const clientesFiltrados = useMemo(() => {
    let lista = clientes;
    if (tipoSelecionado) {
      const idsComTipo = new Set<string>();
      for (const t of abertas) {
        if (tipoDaTarefa(t) === tipoSelecionado) {
          const chaveTitulo = t.familia_titulo ?? "Sem cliente";
          idsComTipo.add(t.familia_bitrix_id != null ? `id:${t.familia_bitrix_id}` : `nome:${chaveTitulo}`);
        }
      }
      lista = lista.filter((c) =>
        idsComTipo.has(c.id != null ? `id:${c.id}` : `nome:${c.titulo}`),
      );
    }
    if (responsavelSelecionado) {
      const idsComResp = new Set<string>();
      for (const t of abertas) {
        if ((t.responsavel_nome ?? "Sem responsável") === responsavelSelecionado) {
          const chaveTitulo = t.familia_titulo ?? "Sem cliente";
          idsComResp.add(t.familia_bitrix_id != null ? `id:${t.familia_bitrix_id}` : `nome:${chaveTitulo}`);
        }
      }
      lista = lista.filter((c) =>
        idsComResp.has(c.id != null ? `id:${c.id}` : `nome:${c.titulo}`),
      );
    }
    return lista;
  }, [clientes, tipoSelecionado, responsavelSelecionado, abertas, tipoDaTarefa]);

  const clientesOrdenados = useMemo(() => {
    const arr = [...clientesFiltrados];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "cliente":
          cmp = a.titulo.localeCompare(b.titulo);
          break;
        case "abertas":
          cmp = a.abertas - b.abertas;
          break;
        case "atrasadas":
          cmp = a.atrasadas - b.atrasadas || a.abertas - b.abertas;
          break;
        case "tipo":
          cmp = a.tipoPredominante.localeCompare(b.tipoPredominante);
          break;
        case "tempo":
          cmp = (a.tempoMedio ?? -1) - (b.tempoMedio ?? -1);
          break;
        case "atividade":
          cmp = (a.ultimaAtividade ?? "").localeCompare(b.ultimaAtividade ?? "");
          break;
        case "responsavel":
          cmp = a.responsavelImoveis?.localeCompare(b.responsavelImoveis ?? "") ?? 0;
          break;
      }
      return cmp * dir;
    });
    return arr;
  }, [clientesFiltrados, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "cliente" || key === "tipo" ? "asc" : "desc");
    }
  };

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th
      className={cn(
        "px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground cursor-pointer select-none hover:text-foreground",
        className,
      )}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={cn("h-3 w-3", sortKey === k ? "text-foreground" : "opacity-30")} />
      </span>
    </th>
  );

  const filtroAtivo = tipoSelecionado || responsavelSelecionado;

  return (
    <>
      <PageHeader
        title="Operacional"
        subtitle="Visão estratégica das tarefas sincronizadas do Bitrix"
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

      {erro && <p className="mb-4 text-sm text-red-500">{erro}</p>}

      {/* Linha 1 — KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : (
          <>
            <KpiCard label="Em aberto" value={String(kpis.totalAbertas)} icon={<ListTodo className="h-4 w-4" />} hint="Total de tarefas ativas" />
            <KpiCard label="Atrasadas" value={String(kpis.totalAtrasadas)} icon={<Clock className="h-4 w-4" />} hint="Com prazo vencido" />
            <KpiCard label="Tempo médio resolução" value={kpis.tempoMedio != null ? `${kpis.tempoMedio} d` : "—"} icon={<Timer className="h-4 w-4" />} hint="Criação → conclusão" />
            <KpiCard label="Clientes ativos" value={String(kpis.totalClientes)} icon={<Users className="h-4 w-4" />} hint="Com tarefas em aberto" />
          </>
        )}
      </div>

      {/* Linha 2 — dois blocos */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Bloco esquerdo — por tipo de demanda */}
          <Card className="shadow-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Por tipo de demanda</CardTitle>
              {tipoSelecionado && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setTipoSelecionado(null)}>
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {porTipo.map((d) => {
                const ativo = tipoSelecionado === d.tipo;
                return (
                  <button
                    key={d.tipo}
                    onClick={() => setTipoSelecionado((c) => (c === d.tipo ? null : d.tipo))}
                    className={cn(
                      "w-full text-left group",
                      tipoSelecionado && !ativo && "opacity-50",
                    )}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={cn("font-medium", ativo ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                        {d.tipo}
                      </span>
                      <span className="tabular-nums font-semibold text-foreground">{d.total}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${d.pct}%`, backgroundColor: d.cor }}
                      />
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Bloco direito — por responsável */}
          <Card className="shadow-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Por responsável</CardTitle>
              {responsavelSelecionado && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setResponsavelSelecionado(null)}>
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-2">
              <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
                {porResponsavel.map((r, i) => {
                  const ativo = responsavelSelecionado === r.nome;
                  return (
                    <button
                      key={r.nome}
                      onClick={() => setResponsavelSelecionado((c) => (c === r.nome ? null : r.nome))}
                      className={cn(
                        "w-full flex items-center gap-3 py-2 px-1 text-left hover:bg-muted/50 rounded-md transition-colors",
                        ativo && "bg-muted",
                        responsavelSelecionado && !ativo && "opacity-50",
                      )}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                        style={{ backgroundColor: SOMMA[i % SOMMA.length] }}
                      >
                        {iniciais(r.nome)}
                      </span>
                      <span className="flex-1 truncate text-sm">{r.nome}</span>
                      <Badge variant="secondary" className="tabular-nums">{r.abertas}</Badge>
                      {r.atrasadas > 0 && (
                        <Badge className="tabular-nums bg-red-600 text-white hover:bg-red-600">{r.atrasadas}</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Painel do responsável selecionado */}
      {!loading && detalheResponsavel && (
        <Card className="shadow-card mb-6">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              {detalheResponsavel.nome} · {detalheResponsavel.total} tarefa{detalheResponsavel.total > 1 ? "s" : ""} em aberto
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setResponsavelSelecionado(null)}>
              <X className="h-3 w-3 mr-1" /> Fechar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {detalheResponsavel.grupos.map((g) => (
              <div key={g.nome}>
                <button
                  className="flex items-center gap-1 text-sm font-semibold text-foreground hover:underline disabled:no-underline"
                  disabled={g.familia_bitrix_id == null}
                  onClick={() => g.familia_bitrix_id != null && navigate(`/operacional/${g.familia_bitrix_id}`)}
                >
                  {g.nome} <span className="text-muted-foreground font-normal">({g.tarefas.length})</span>
                  {g.familia_bitrix_id != null && <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <ul className="mt-1 ml-1 space-y-1">
                  {g.tarefas.map((t) => (
                    <li key={t.bitrix_id ?? t.titulo} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isAtrasada(t) ? "bg-red-500" : "bg-muted-foreground/40")} />
                      <span className="truncate">{t.titulo}</span>
                      {t.prazo && (
                        <span className={cn("ml-auto shrink-0 tabular-nums", isAtrasada(t) && "text-red-500")}>
                          {format(parseISO(t.prazo), "dd/MM", { locale: ptBR })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Linha 3 — Tabela de clientes */}
      {!loading && (
        <Card className="shadow-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Clientes {filtroAtivo && <span className="text-muted-foreground font-normal">· filtrado</span>}
            </CardTitle>
            {filtroAtivo && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setTipoSelecionado(null);
                  setResponsavelSelecionado(null);
                }}
              >
                <X className="h-3 w-3 mr-1" /> Limpar filtros
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th k="cliente">Cliente</Th>
                  <Th k="abertas" className="text-right">Em aberto</Th>
                  <Th k="atrasadas" className="text-right">Atrasadas</Th>
                  <Th k="tipo">Tipo predominante</Th>
                  <Th k="responsavel">Resp. Imóveis</Th>
                  <Th k="tempo" className="text-right">Tempo médio</Th>
                  <Th k="atividade">Última atividade</Th>
                </tr>
              </thead>
              <tbody>
                {clientesOrdenados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
                {clientesOrdenados.map((c) => (
                  <tr key={c.id != null ? `id:${c.id}` : `nome:${c.titulo}`} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <button
                        className="font-medium text-foreground hover:underline text-left"
                        onClick={() => {
                          if (c.id != null) {
                            navigate(`/operacional/${c.id}`);
                          } else {
                            const found = abertas.find(t => t.familia_titulo === c.titulo && t.familia_bitrix_id != null);
                            if (found?.familia_bitrix_id) navigate(`/operacional/${found.familia_bitrix_id}`);
                          }
                        }}
                      >
                        {c.titulo}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.abertas}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", c.atrasadas > 0 && "text-red-600 font-semibold")}>
                      {c.atrasadas}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.tipoPredominante}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {c.responsavelImoveis ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {c.tempoMedio != null ? `${c.tempoMedio} d` : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">
                      {c.ultimaAtividade ? format(parseISO(c.ultimaAtividade), "dd/MM/yy", { locale: ptBR }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
