import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MultiFiltro } from "@/components/operacional/MultiFiltro";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/tarefas";
import { SnapshotDia, TarefaOperacional, emAndamento, familiaDaTarefa, fmtMes, mesesHistorico, responsavelDaTarefa } from "@/lib/operacional";
import { AvisoHistorico } from "@/components/operacional/Shared";
import { Espelho, FiltrosEspelho } from "@/components/operacional/Espelho";
import { Familias } from "@/components/operacional/Familias";
import { PainelFamilia } from "@/components/operacional/PainelFamilia";
import { TempoCarga } from "@/components/operacional/TempoCarga";
import { RelatoriosSemanais } from "@/components/operacional/RelatoriosSemanais";

const COLUNAS = "bitrix_id,titulo,familia_titulo,status,prioridade,prazo,criado_em,concluido_em,alterado_em,responsavel_nome,marcadores,link_bitrix,synced_at";
const FILTROS_INICIAIS: FiltrosEspelho = { busca: "", soPrioridade: false, prazo: null, tipo: null, responsavel: null };

async function buscarTarefas() {
  return fetchAll<TarefaOperacional>((from, to) =>
    supabase.from("bitrix_tarefas").select(COLUNAS).in("status", ["pending", "in_progress", "completed"]).order("bitrix_id").range(from, to) as unknown as PromiseLike<{ data: TarefaOperacional[] | null; error: unknown }>,
  );
}

async function buscarSnapshots() {
  return fetchAll<SnapshotDia>((from, to) =>
    supabase.from("operacional_snapshot_diario").select("data,familia_titulo,em_andamento,atrasadas").order("data").range(from, to) as unknown as PromiseLike<{ data: SnapshotDia[] | null; error: unknown }>,
  );
}

export default function Operacional() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const familia = params.get("familia");
  const [mes, setMes] = useState(mesesHistorico()[0]);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [sincronizando, setSincronizando] = useState(false);
  const { data = [], isLoading, error } = useQuery({ queryKey: ["operacional-tarefas"], queryFn: buscarTarefas, staleTime: 5 * 60 * 1000 });
  const { data: snapshots = [] } = useQuery({ queryKey: ["operacional-snapshots"], queryFn: buscarSnapshots, staleTime: 5 * 60 * 1000 });
  const [pessoas, setPessoas] = useState<string[]>([]);
  const [familiasSel, setFamiliasSel] = useState<string[]>([]);
  const semPrazo = data.filter((t) => !t.prazo).length;
  const comPrazo = useMemo(() => data.filter((t) => !!t.prazo), [data]);
  const tarefas = useMemo(() => comPrazo.filter((t) => (!pessoas.length || pessoas.includes(responsavelDaTarefa(t))) && (!familiasSel.length || familiasSel.includes(familiaDaTarefa(t)))), [comPrazo, pessoas, familiasSel]);
  const opcoes = (chave: (t: TarefaOperacional) => string) => { const m = new Map<string, number>(); comPrazo.filter(emAndamento).forEach((t) => m.set(chave(t), (m.get(chave(t)) ?? 0) + 1)); return [...m].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR")); };
  const opcoesPessoas = useMemo(() => opcoes(responsavelDaTarefa), [comPrazo]);
  const opcoesFamilias = useMemo(() => opcoes(familiaDaTarefa), [comPrazo]);
  const limparTudo = () => { setPessoas([]); setFamiliasSel([]); setFiltros(FILTROS_INICIAIS); };
  const ultimaSync = useMemo(() => data.map((t) => t.synced_at).filter(Boolean).sort().pop() ?? null, [data]);

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const { data: resposta, error: syncError } = await supabase.functions.invoke("bitrix-sync", { body: { modo: "completo" } });
      if (syncError) throw syncError;
      await queryClient.invalidateQueries({ queryKey: ["operacional-tarefas"] });
      await queryClient.invalidateQueries({ queryKey: ["operacional-snapshots"] });
      toast({ title: resposta?.parcial ? "Sincronização parcial, rode novamente" : "Sincronização concluída", description: resposta?.segundos != null ? `Duração: ${resposta.segundos} segundos.` : undefined });
    } catch (e) {
      toast({ title: "Não foi possível sincronizar", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
    } finally { setSincronizando(false); }
  };
  const abrirFamilia = (nome: string) => setParams({ familia: nome });

  return <div className="op-theme space-y-4">
    <PageHeader title="Operacional" subtitle={ultimaSync ? `Última sincronização: ${fmtSync(ultimaSync)}` : "Dados operacionais do Bitrix"} actions={<Button size="sm" onClick={sincronizar} disabled={sincronizando}><RefreshCw className={sincronizando ? "animate-spin" : ""}/>{sincronizando ? "Sincronizando…" : "Sincronizar agora"}</Button>} />
    {error && <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4"/>Não foi possível carregar os dados.</div>}
    {!isLoading && <div className="flex flex-wrap items-center gap-2">
      <MultiFiltro id="pessoas" opcoes={opcoesPessoas} selecionados={pessoas} onChange={setPessoas} todos="Todas as pessoas" plural="pessoas"/>
      {!familia && <MultiFiltro id="familias" opcoes={opcoesFamilias} selecionados={familiasSel} onChange={setFamiliasSel} todos="Todas as famílias" plural="famílias"/>}
      {[...pessoas.map((p) => ({ l: p, r: () => setPessoas(pessoas.filter((x) => x !== p)) })), ...(familia ? [] : familiasSel.map((f) => ({ l: f, r: () => setFamiliasSel(familiasSel.filter((x) => x !== f)) })))].map((c) => <Badge key={c.l} variant="outline" className="h-7 gap-1 bg-card">{c.l}<button type="button" aria-label={`Remover ${c.l}`} onClick={c.r}><X className="h-3 w-3"/></button></Badge>)}
      {(pessoas.length > 0 || familiasSel.length > 0) && <Button size="sm" variant="ghost" onClick={limparTudo}><X className="h-4 w-4"/>Limpar filtros</Button>}
    </div>}
    {isLoading ?  <div className="space-y-3"><Skeleton className="h-12 w-full"/><Skeleton className="h-20 w-full"/><Skeleton className="h-72 w-full"/></div> : familia ? <><AvisoHistorico/><PainelFamilia nome={familia} tarefas={tarefas} mes={mes} snapshots={snapshots} onVoltar={()=>setParams({})}/></> : <Tabs defaultValue="espelho" className="space-y-4">
      <div className="flex flex-col gap-3 border-b pb-3 lg:flex-row lg:items-center lg:justify-between">
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-transparent p-0 lg:w-auto">
          <TabsTrigger value="espelho" className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none">Espelho das demandas</TabsTrigger>
          <TabsTrigger value="familias" className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none">Famílias</TabsTrigger>
          <TabsTrigger value="tempo" className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none">Tempo e carga</TabsTrigger>
          <TabsTrigger value="relatorios" className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-gold data-[state=active]:bg-transparent data-[state=active]:shadow-none">Relatórios semanais</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Mês de referência</span><Select value={mes} onValueChange={setMes}><SelectTrigger className="h-8 w-44"><SelectValue/></SelectTrigger><SelectContent>{mesesHistorico().map(m=><SelectItem key={m} value={m}>{fmtMes(m)}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <AvisoHistorico/>
      <TabsContent value="espelho"><Espelho tarefas={tarefas} semPrazo={semPrazo} filtros={filtros} onFiltros={setFiltros} onFamilia={abrirFamilia} onLimparTudo={limparTudo}/></TabsContent>
      <TabsContent value="familias"><Familias tarefas={tarefas} mes={mes} snapshots={snapshots} onFamilia={abrirFamilia}/></TabsContent>
      <TabsContent value="tempo"><TempoCarga tarefas={tarefas} mes={mes} semPrazo={semPrazo}/></TabsContent>
      <TabsContent value="relatorios"><RelatoriosSemanais tarefas={tarefas} mes={mes}/></TabsContent>
    </Tabs>}
  </div>;
}

const fmtSync = (iso:string) => new Intl.DateTimeFormat("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit", timeZone:"America/Sao_Paulo" }).format(new Date(iso));