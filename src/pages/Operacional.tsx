import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/tarefas";
import { TarefaOperacional, fmtMes, mesesHistorico } from "@/lib/operacional";
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

export default function Operacional() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const familia = params.get("familia");
  const [mes, setMes] = useState(mesesHistorico()[0]);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [sincronizando, setSincronizando] = useState(false);
  const { data = [], isLoading, error } = useQuery({ queryKey: ["operacional-tarefas"], queryFn: buscarTarefas, staleTime: 5 * 60 * 1000 });
  const semPrazo = data.filter((t) => !t.prazo).length;
  const tarefas = useMemo(() => data.filter((t) => !!t.prazo), [data]);
  const ultimaSync = useMemo(() => data.map((t) => t.synced_at).filter(Boolean).sort().pop() ?? null, [data]);

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const { data: resposta, error: syncError } = await supabase.functions.invoke("bitrix-sync", { body: { modo: "completo" } });
      if (syncError) throw syncError;
      await queryClient.invalidateQueries({ queryKey: ["operacional-tarefas"] });
      toast({ title: resposta?.parcial ? "Sincronização parcial, rode novamente" : "Sincronização concluída", description: resposta?.segundos != null ? `Duração: ${resposta.segundos} segundos.` : undefined });
    } catch (e) {
      toast({ title: "Não foi possível sincronizar", description: e instanceof Error ? e.message : "Tente novamente.", variant: "destructive" });
    } finally { setSincronizando(false); }
  };
  const abrirFamilia = (nome: string) => setParams({ familia: nome });

  return <div className="space-y-4">
    <PageHeader title="Operacional" subtitle={ultimaSync ? `Última sincronização: ${fmtSync(ultimaSync)}` : "Dados operacionais do Bitrix"} actions={<Button size="sm" onClick={sincronizar} disabled={sincronizando}><RefreshCw className={sincronizando ? "animate-spin" : ""}/>{sincronizando ? "Sincronizando…" : "Sincronizar agora"}</Button>} />
    {error && <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4"/>Não foi possível carregar os dados.</div>}
    {isLoading ? <div className="space-y-3"><Skeleton className="h-12 w-full"/><Skeleton className="h-20 w-full"/><Skeleton className="h-72 w-full"/></div> : familia ? <><AvisoHistorico/><PainelFamilia nome={familia} tarefas={tarefas} mes={mes} onVoltar={()=>setParams({})}/></> : <Tabs defaultValue="espelho" className="space-y-4">
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
      <TabsContent value="espelho"><Espelho tarefas={tarefas} semPrazo={semPrazo} filtros={filtros} onFiltros={setFiltros} onFamilia={abrirFamilia}/></TabsContent>
      <TabsContent value="familias"><Familias tarefas={tarefas} mes={mes} onFamilia={abrirFamilia}/></TabsContent>
      <TabsContent value="tempo"><TempoCarga tarefas={tarefas} mes={mes} semPrazo={semPrazo}/></TabsContent>
      <TabsContent value="relatorios"><RelatoriosSemanais tarefas={tarefas} mes={mes}/></TabsContent>
    </Tabs>}
  </div>;
}

const fmtSync = (iso:string) => new Intl.DateTimeFormat("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit", timeZone:"America/Sao_Paulo" }).format(new Date(iso));