import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw, AlertTriangle, Clock, Flame, ListTodo, ChevronRight, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";

interface FamiliaResumo {
  id: string; titulo: string; responsavel_nome: string | null;
  ultima_atividade: string | null; total_abertas: number;
  atrasadas: number; alta_prioridade: number; hoje: number;
}
interface Totais {
  total_familias: number; total_abertas: number;
  total_atrasadas: number; total_alta_prioridade: number; total_hoje: number;
}

export default function OperacionalBitrix() {
  const navigate = useNavigate();
  const [familias, setFamilias] = useState<FamiliaResumo[]>([]);
  const [totais, setTotais] = useState<Totais | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todas" | "atrasadas" | "hoje" | "alta">("todas");

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("bitrix-proxy", {
        body: { action: "dashboard_bitrix" },
      });
      if (error) throw error;
      setFamilias(data.familias ?? []);
      setTotais(data.totais ?? null);
      setLastSync(new Date());
    } catch (err: any) {
      setErro(err.message ?? "Erro ao buscar dados do Bitrix");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const familiasFiltradas = familias.filter(f => {
    if (filtro === "atrasadas") return f.atrasadas > 0;
    if (filtro === "hoje") return f.hoje > 0;
    if (filtro === "alta") return f.alta_prioridade > 0;
    return f.total_abertas > 0;
  });

  return (
    <>
      <PageHeader title="Operacional" subtitle="Visão em tempo real das demandas por cliente — Bitrix24" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {loading ? [1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />) : totais ? (
          <>
            <KpiCard label="Demandas em aberto" value={String(totais.total_abertas)} icon={<ListTodo className="h-4 w-4" />} hint={`${totais.total_familias} clientes ativos`} />
            <KpiCard label="Atrasadas" value={String(totais.total_atrasadas)} icon={<Clock className="h-4 w-4" />} hint="Com prazo vencido" />
            <KpiCard label="Vencem hoje" value={String(totais.total_hoje)} icon={<AlertTriangle className="h-4 w-4" />} hint="Prazo até hoje" />
            <KpiCard label="Alta prioridade" value={String(totais.total_alta_prioridade)} icon={<Flame className="h-4 w-4" />} hint="Marcadas como urgentes" />
          </>
        ) : null}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          {([
            { key: "todas", label: "Com demandas" },
            { key: "atrasadas", label: "Atrasadas" },
            { key: "hoje", label: "Vencem hoje" },
            { key: "alta", label: "Alta prioridade" },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filtro === f.key ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/50"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {lastSync && <span className="text-xs text-muted-foreground">Sync {format(lastSync, "HH:mm")}</span>}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={carregar} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 p-4 bg-red-50 rounded-lg mb-4">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : familiasFiltradas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Nenhum cliente encontrado para este filtro.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {familiasFiltradas.map(f => (
            <button key={f.id} onClick={() => navigate(`/operacional/${f.id}`)} className="w-full text-left">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-sm font-medium text-muted-foreground">
                      {f.titulo.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{f.titulo}</span>
                        {f.atrasadas > 0 && <Badge className="bg-red-100 text-red-700 border-0 text-xs">{f.atrasadas} atrasada{f.atrasadas > 1 ? "s" : ""}</Badge>}
                        {f.hoje > 0 && f.atrasadas === 0 && <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">{f.hoje} hoje</Badge>}
                        {f.alta_prioridade > 0 && <Badge className="bg-amber-100 text-amber-800 border-0 text-xs"><Flame className="w-2.5 h-2.5 mr-0.5" />{f.alta_prioridade}</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {f.responsavel_nome && <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{f.responsavel_nome}</span>}
                        {f.ultima_atividade && <span className="text-xs text-muted-foreground">Última atividade {format(new Date(f.ultima_atividade), "dd/MM", { locale: ptBR })}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-center hidden sm:block">
                        <div className="text-lg font-semibold leading-none">{f.total_abertas}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">em aberto</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
