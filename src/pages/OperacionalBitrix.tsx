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
  Hourglass,
  CalendarClock,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KpiCard } from "@/components/KpiCard";
import { cn } from "@/lib/utils";
import {
  STATUS_CARREGAR,
  STATUS_PADRAO,
  STATUS_LABEL,
  isAtrasada,
  media,
  fetchAll,
} from "@/lib/tarefas";

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
  link_bitrix: string | null;
}

interface ConcluidaRow {
  criado_em: string | null;
  concluido_em: string | null;
  prazo: string | null;
  responsavel_nome: string | null;
  familia_titulo: string | null;
  familia_bitrix_id: number | null;
}

const COLS_ABERTAS =
  "bitrix_id,titulo,familia_bitrix_id,familia_titulo,status,prioridade,prazo,criado_em,concluido_em,responsavel_nome,alterado_em,marcadores,link_bitrix";
const COLS_CONCLUIDAS = "criado_em,concluido_em,prazo,responsavel_nome,familia_titulo,familia_bitrix_id";

const SEM_RESP = "Sem responsável";
const nomeResp = (t: { responsavel_nome: string | null }) => t.responsavel_nome ?? SEM_RESP;
const fmtDias = (n: number | null) => (n != null ? `${n} d` : "—");

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

function FiltroResponsaveis({
  opcoes,
  selecionados,
  onChange,
}: {
  opcoes: { nome: string; abertas: number; atrasadas: number }[];
  selecionados: string[];
  onChange: (v: string[]) => void;
}) {
  const [busca, setBusca] = useState("");
  const lista = opcoes.filter((o) => o.nome.toLowerCase().includes(busca.toLowerCase()));
  const toggle = (nome: string) =>
    onChange(selecionados.includes(nome) ? selecionados.filter((n) => n !== nome) : [...selecionados, nome]);
  const rotulo =
    selecionados.length === 0
      ? "Todas as pessoas"
      : selecionados.length === 1
        ? selecionados[0]
        : `${selecionados.length} pessoas`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 max-w-[240px]">
          <Users className="h-4 w-4 mr-2 shrink-0" />
          <span className="truncate">{rotulo}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pessoa…"
          className="h-8 text-sm"
        />
        <div className="max-h-64 overflow-y-auto mt-2 space-y-0.5">
          {lista.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">Ninguém encontrado.</p>}
          {lista.map((o) => (
            <label
              key={o.nome}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
            >
              <Checkbox checked={selecionados.includes(o.nome)} onCheckedChange={() => toggle(o.nome)} />
              <span className="flex-1 truncate">{o.nome}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{o.abertas}</span>
              {o.atrasadas > 0 && <span className="text-xs text-red-600 font-medium tabular-nums">{o.atrasadas}</span>}
            </label>
          ))}
        </div>
        {selecionados.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs" onClick={() => onChange([])}>
            Limpar seleção
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function OperacionalBitrix() {
  const navigate = useNavigate();
  const [abertas, setAbertas] = useState<TarefaRow[]>([]);
  const [concluidas, setConcluidas] = useState<ConcluidaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [perfis, setPerfis] = useState<PerfilRow[]>([]);

  // Filtros globais (valem para KPIs, gráficos, listas e tabela)
  const [statusSel, setStatusSel] = useState<string[]>(STATUS_PADRAO);
  const [responsaveisSel, setResponsaveisSel] = useState<string[]>([]);
  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null);
  const [verTodasAtrasadas, setVerTodasAtrasadas] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("atrasadas");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [ab, co, r3] = await Promise.all([
        // Só status ativos: concluídas, recusadas e excluídas nunca entram em "abertas"
        fetchAll<TarefaRow>((a, b) =>
          supabase
            .from("bitrix_tarefas")
            .select(COLS_ABERTAS)
            .in("status", [...STATUS_CARREGAR])
            .order("bitrix_id")
            .range(a, b) as unknown as PromiseLike<{ data: TarefaRow[] | null; error: unknown }>,
        ),
        fetchAll<ConcluidaRow>((a, b) =>
          supabase
            .from("bitrix_tarefas")
            .select(COLS_CONCLUIDAS)
            .eq("status", "completed")
            .not("criado_em", "is", null)
            .not("concluido_em", "is", null)
            .order("bitrix_id")
            .range(a, b) as unknown as PromiseLike<{ data: ConcluidaRow[] | null; error: unknown }>,
        ),
        supabase.from("clientes_perfil").select("familia_bitrix_id, responsavel_imoveis"),
      ]);
      setAbertas(ab);
      setConcluidas(co);
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

  // ---- Recortes com filtros (cada bloco ignora o próprio filtro, para não "sumir" com as opções) ----
  const porStatus = useMemo(() => abertas.filter((t) => statusSel.includes(t.status)), [abertas, statusSel]);

  const baseSemResp = useMemo(
    () => (tipoSelecionado ? porStatus.filter((t) => tipoDaTarefa(t) === tipoSelecionado) : porStatus),
    [porStatus, tipoSelecionado, tipoDaTarefa],
  );

  const baseSemTipo = useMemo(
    () => (responsaveisSel.length ? porStatus.filter((t) => responsaveisSel.includes(nomeResp(t))) : porStatus),
    [porStatus, responsaveisSel],
  );

  // Tarefas em aberto com TODOS os filtros aplicados → KPIs, lista de atrasadas, tabela
  const abertasF = useMemo(
    () => (responsaveisSel.length ? baseSemResp.filter((t) => responsaveisSel.includes(nomeResp(t))) : baseSemResp),
    [baseSemResp, responsaveisSel],
  );

  const concluidasF = useMemo(
    () => (responsaveisSel.length ? concluidas.filter((c) => responsaveisSel.includes(nomeResp(c))) : concluidas),
    [concluidas, responsaveisSel],
  );

  // ---- Tempo de finalização (criação → conclusão) das concluídas ----
  const tempoConcluidas = useMemo(() => {
    const porCliente = new Map<number, number[]>();
    const todas: number[] = [];
    const noPrazo: number[] = [];
    const comAtraso: number[] = [];
    for (const c of concluidasF) {
      if (!c.criado_em || !c.concluido_em) continue;
      const fim = parseISO(c.concluido_em);
      const d = differenceInDays(fim, parseISO(c.criado_em));
      if (d < 0) continue;
      todas.push(d);
      if (c.prazo) (fim > parseISO(c.prazo) ? comAtraso : noPrazo).push(d);
      if (c.familia_bitrix_id != null) {
        const arr = porCliente.get(c.familia_bitrix_id) ?? [];
        arr.push(d);
        porCliente.set(c.familia_bitrix_id, arr);
      }
    }
    const mediaPorCliente = new Map<number, number | null>();
    for (const [id, arr] of porCliente) mediaPorCliente.set(id, media(arr));
    return {
      porCliente: mediaPorCliente,
      global: media(todas),
      noPrazo: media(noPrazo),
      comAtraso: media(comAtraso),
      qtdComAtraso: comAtraso.length,
      qtdTotal: todas.length,
    };
  }, [concluidasF]);

  const perfilPorId = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of perfis) {
      if (p.familia_bitrix_id && p.responsavel_imoveis) {
        map.set(p.familia_bitrix_id, p.responsavel_imoveis);
      }
    }
    return map;
  }, [perfis]);

  // ---- Atrasadas (lista + métricas) ----
  const atrasadas = useMemo(() => {
    const agora = new Date();
    return abertasF
      .filter(isAtrasada)
      .map((t) => ({
        ...t,
        diasAtraso: differenceInDays(agora, parseISO(t.prazo as string)),
        idadeDias: t.criado_em ? differenceInDays(agora, parseISO(t.criado_em)) : null,
      }))
      .sort((a, b) => b.diasAtraso - a.diasAtraso);
  }, [abertasF]);

  const metricasAtraso = useMemo(
    () => ({
      qtd: atrasadas.length,
      pct: abertasF.length ? Math.round((atrasadas.length / abertasF.length) * 100) : 0,
      idadeMedia: media(atrasadas.map((t) => t.idadeDias).filter((n): n is number => n != null)),
      atrasoMedio: media(atrasadas.map((t) => t.diasAtraso)),
    }),
    [atrasadas, abertasF],
  );

  // ---- KPIs ----
  const totalClientes = useMemo(() => new Set(abertasF.map((t) => t.familia_titulo)).size, [abertasF]);

  // ---- Por tipo de demanda ----
  const porTipo = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tp of TIPOS_DEMANDA) counts[tp] = 0;
    for (const t of baseSemTipo) {
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
  }, [baseSemTipo, tipoDaTarefa]);

  // ---- Por responsável ----
  const porResponsavel = useMemo(() => {
    const map = new Map<string, { abertas: number; atrasadas: number }>();
    for (const t of baseSemResp) {
      const nome = nomeResp(t);
      const cur = map.get(nome) ?? { abertas: 0, atrasadas: 0 };
      cur.abertas++;
      if (isAtrasada(t)) cur.atrasadas++;
      map.set(nome, cur);
    }
    return Array.from(map.entries())
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.atrasadas - a.atrasadas || b.abertas - a.abertas);
  }, [baseSemResp]);

  // Opções do filtro de pessoas (mantém pessoas já selecionadas mesmo sem tarefas no recorte atual)
  const opcoesResponsaveis = useMemo(() => {
    const nomes = new Set(porResponsavel.map((r) => r.nome));
    const extras = responsaveisSel
      .filter((n) => !nomes.has(n))
      .map((nome) => ({ nome, abertas: 0, atrasadas: 0 }));
    return [...porResponsavel, ...extras];
  }, [porResponsavel, responsaveisSel]);

  const toggleResponsavel = (nome: string) =>
    setResponsaveisSel((cur) => (cur.includes(nome) ? cur.filter((n) => n !== nome) : [...cur, nome]));

  // ---- Detalhe das pessoas selecionadas ----
  const detalheResponsavel = useMemo(() => {
    if (!responsaveisSel.length) return null;
    const grupos = abertasF.reduce((acc, t) => {
      const chave = t.familia_titulo ?? "Sem família";
      if (!acc[chave]) acc[chave] = { nome: chave, familia_bitrix_id: t.familia_bitrix_id, tarefas: [] };
      acc[chave].tarefas.push(t);
      return acc;
    }, {} as Record<string, { nome: string; familia_bitrix_id: number | null; tarefas: TarefaRow[] }>);
    return {
      nome: responsaveisSel.length === 1 ? responsaveisSel[0] : `${responsaveisSel.length} pessoas`,
      total: abertasF.length,
      grupos: Object.values(grupos).sort((a, b) => b.tarefas.length - a.tarefas.length),
    };
  }, [abertasF, responsaveisSel]);

  // ---- Resumo por cliente (tabela) ----
  const clientes: ClienteResumo[] = useMemo(() => {
    const map = new Map<string, ClienteResumo & { tipoCount: Record<string, number> }>();
    for (const t of abertasF) {
      const chaveTitulo = t.familia_titulo ?? "Sem cliente";
      if (TAGS_EXCLUIR.has(chaveTitulo)) continue;
      const key = `nome:${chaveTitulo}`;
      let c = map.get(key);
      if (!c) {
        c = {
          id: t.familia_bitrix_id,
          titulo: chaveTitulo,
          abertas: 0,
          atrasadas: 0,
          tipoPredominante: "—",
          tempoMedio: null,
          ultimaAtividade: null,
          responsavelImoveis: null,
          tipoCount: {},
        };
        map.set(key, c);
      }
      c.abertas++;
      if (c.id == null && t.familia_bitrix_id != null) {
        c.id = t.familia_bitrix_id;
      }
      if (isAtrasada(t)) c.atrasadas++;
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
      const responsavelImoveis = c.id != null ? (perfilPorId.get(c.id) ?? null) : null;
      const tempoMedio = c.id != null ? (tempoConcluidas.porCliente.get(c.id) ?? null) : null;
      return { ...c, tipoPredominante: entries.length ? entries[0][0] : "—", responsavelImoveis, tempoMedio };
    });
  }, [abertasF, tempoConcluidas, perfilPorId]);

  const clientesOrdenados = useMemo(() => {
    const arr = [...clientes];
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
  }, [clientes, sortKey, sortDir]);

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

  const statusPadrao =
    statusSel.length === STATUS_PADRAO.length && STATUS_PADRAO.every((s) => statusSel.includes(s));
  const filtroAtivo = !!tipoSelecionado || responsaveisSel.length > 0 || !statusPadrao;

  const limparFiltros = () => {
    setStatusSel(STATUS_PADRAO);
    setResponsaveisSel([]);
    setTipoSelecionado(null);
  };

  const toggleStatus = (s: string) =>
    setStatusSel((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const atrasadasVisiveis = verTodasAtrasadas ? atrasadas : atrasadas.slice(0, 15);

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

      {/* Barra de filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FiltroResponsaveis
          opcoes={opcoesResponsaveis}
          selecionados={responsaveisSel}
          onChange={setResponsaveisSel}
        />
        <span className="mx-1 h-5 w-px bg-border" />
        {Object.entries(STATUS_LABEL).map(([s, label]) => {
          const ativo = statusSel.includes(s);
          return (
            <Button
              key={s}
              size="sm"
              variant={ativo ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => toggleStatus(s)}
            >
              {label}
            </Button>
          );
        })}
        {filtroAtivo && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={limparFiltros}>
            <X className="h-3 w-3 mr-1" /> Limpar filtros
          </Button>
        )}
      </div>

      {/* Linha 1 — KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {loading ? (
          [1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : (
          <>
            <KpiCard
              label="Em aberto"
              value={String(abertasF.length)}
              icon={<ListTodo className="h-4 w-4" />}
              hint={`${totalClientes} cliente${totalClientes === 1 ? "" : "s"} com tarefas`}
            />
            <KpiCard
              label="Atrasadas"
              value={String(metricasAtraso.qtd)}
              icon={<Clock className="h-4 w-4" />}
              hint={`${metricasAtraso.pct}% das em aberto · prazo vencido`}
            />
            <KpiCard
              label="Idade média das atrasadas"
              value={fmtDias(metricasAtraso.idadeMedia)}
              icon={<Hourglass className="h-4 w-4" />}
              hint="Da criação até hoje"
            />
            <KpiCard
              label="Atraso médio"
              value={fmtDias(metricasAtraso.atrasoMedio)}
              icon={<CalendarClock className="h-4 w-4" />}
              hint="Dias além do prazo"
            />
            <KpiCard
              label="Tempo médio de finalização"
              value={fmtDias(tempoConcluidas.global)}
              icon={<Timer className="h-4 w-4" />}
              hint={`Criação → conclusão · ${tempoConcluidas.qtdTotal} concluídas`}
            />
            <KpiCard
              label="Concluídas com atraso"
              value={fmtDias(tempoConcluidas.comAtraso)}
              icon={<Timer className="h-4 w-4" />}
              hint={`${tempoConcluidas.qtdComAtraso} tarefas · no prazo: ${fmtDias(tempoConcluidas.noPrazo)}`}
            />
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
                    className={cn("w-full text-left group", tipoSelecionado && !ativo && "opacity-50")}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={cn("font-medium", ativo ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                        {d.tipo}
                      </span>
                      <span className="tabular-nums font-semibold text-foreground">{d.total}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${d.pct}%`, backgroundColor: d.cor }} />
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Bloco direito — por responsável (multi-seleção) */}
          <Card className="shadow-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Por responsável</CardTitle>
              {responsaveisSel.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setResponsaveisSel([])}>
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-2">
              <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
                {porResponsavel.map((r, i) => {
                  const ativo = responsaveisSel.includes(r.nome);
                  return (
                    <button
                      key={r.nome}
                      onClick={() => toggleResponsavel(r.nome)}
                      className={cn(
                        "w-full flex items-center gap-3 py-2 px-1 text-left hover:bg-muted/50 rounded-md transition-colors",
                        ativo && "bg-muted",
                        responsaveisSel.length > 0 && !ativo && "opacity-50",
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

      {/* Tarefas atrasadas */}
      {!loading && (
        <Card className="shadow-card mb-6">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Tarefas atrasadas <span className="text-muted-foreground font-normal">· {atrasadas.length}</span>
            </CardTitle>
            {atrasadas.length > 15 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setVerTodasAtrasadas((v) => !v)}>
                {verTodasAtrasadas ? "Ver menos" : `Ver todas (${atrasadas.length})`}
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Tarefa</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 font-medium">Responsável</th>
                  <th className="px-3 py-2 font-medium">Criada</th>
                  <th className="px-3 py-2 font-medium">Prazo</th>
                  <th className="px-3 py-2 font-medium text-right">Atraso</th>
                  <th className="px-3 py-2 font-medium text-right">Idade</th>
                </tr>
              </thead>
              <tbody>
                {atrasadas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma tarefa atrasada com os filtros atuais.
                    </td>
                  </tr>
                )}
                {atrasadasVisiveis.map((t) => (
                  <tr key={t.bitrix_id ?? t.titulo} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 max-w-[340px]">
                      {t.link_bitrix ? (
                        <a
                          href={t.link_bitrix}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          <span className="truncate">{t.titulo}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                        </a>
                      ) : (
                        <span className="truncate">{t.titulo}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{t.familia_titulo ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{nomeResp(t)}</td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">
                      {t.criado_em ? format(parseISO(t.criado_em), "dd/MM/yy", { locale: ptBR }) : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">
                      {format(parseISO(t.prazo as string), "dd/MM/yy", { locale: ptBR })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-600 font-semibold">{t.diasAtraso} d</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtDias(t.idadeDias)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Painel das pessoas selecionadas */}
      {!loading && detalheResponsavel && (
        <Card className="shadow-card mb-6">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              {detalheResponsavel.nome} · {detalheResponsavel.total} tarefa{detalheResponsavel.total > 1 ? "s" : ""} em aberto
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setResponsaveisSel([])}>
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

      {/* Tabela de clientes */}
      {!loading && (
        <Card className="shadow-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Clientes {filtroAtivo && <span className="text-muted-foreground font-normal">· filtrado</span>}
            </CardTitle>
            {filtroAtivo && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={limparFiltros}>
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
                            const found = abertasF.find((t) => t.familia_titulo === c.titulo && t.familia_bitrix_id != null);
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
                    <td className="px-3 py-2 text-muted-foreground">{c.responsavelImoveis ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtDias(c.tempoMedio)}</td>
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
