import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, isPast, isToday, parseISO, isSameDay } from "date-fns";
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
  id: number;
  titulo: string;
  responsavel_nome: string | null;
  ultima_atividade: string | null;
  total_abertas: number;
  atrasadas: number;
  alta_prioridade: number;
  hoje: number;
}

interface Totais {
  total_familias: number;
  total_abertas: number;
  total_atrasadas: number;
  total_alta_prioridade: number;
  total_hoje: number;
}

type Filtro = "todas" | "atrasadas" | "hoje" | "alta";

export default function OperacionalBitrix() {
  const navigate = useNavigate();
  const [familias, setFamilias] = useState<FamiliaResumo[]>([]);
  const [totais, setTotais] = useState<Totais | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const now = new Date();

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase
        .from("bitrix_tarefas")
        .select("familia_bitrix_id, familia_titulo, status, prioridade, prazo, responsavel_nome, alterado_em");

      if (error) throw error;

      const raw = data ?? [];

      const mapa = new Map<number, FamiliaResumo>();

      for (const t of raw) {
        const id = t.familia_bitrix_id as number;
        const prazo = t.prazo ? parseISO(t.prazo as string) : null;
        const alterado = t.alterado_em ? parseISO(t.alterado_em as string) : null;
        const aberta = t.status !== "completed";
        const atrasada = aberta && prazo ? isPast(prazo) && !isToday(prazo) : false;
        const alta = aberta && t.prioridade === "high";
        const venceHoje = aberta && prazo ? isToday(prazo) : false;

        let f = mapa.get(id);
        if (!f) {
          f = {
            id,
            titulo: (t.familia_titulo as string) ?? String(id),
            responsavel_nome: (t.responsavel_nome as string | null) ?? null,
            ultima_atividade: alterado ? (t.alterado_em as string) : null,
            total_abertas: 0,
            atrasadas: 0,
            alta_prioridade: 0,
            hoje: 0,
          };
          mapa.set(id, f);
        }

        if (aberta) f.total_abertas++;
        if (atrasada) f.atrasadas++;
        if (alta) f.alta_prioridade++;
        if (venceHoje) f.hoje++;

        if (alterado) {
          const currentUltima = f.ultima_atividade ? parseISO(f.ultima_atividade) : null;
          if (!currentUltima || alterado > currentUltima) {
            f.ultima_atividade = t.alterado_em as string;
          }
        }

        if (t.responsavel_nome && !f.responsavel_nome) {
          f.responsavel_nome = t.responsavel_nome as string;
        }
      }

      const lista = Array.from(mapa.values()).sort((a, b) => a.titulo.localeCompare(b.titulo));

      const totaisCalculados: Totais = {
        total_familias: lista.length,
        total_abertas: lista.reduce((s, f) => s + f.total_abertas, 0),
        total_atrasadas: lista.reduce((s, f) => s + f.atrasadas, 0),
        total_alta_prioridade: lista.reduce((s, f) => s + f.alta_prioridade, 0),
        total_hoje: lista.reduce((s, f) => s + f.hoje, 0),
      };

      setFamilias(lista);
      setTotais(totaisCalculados);
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

  const familiasFiltradas = familias.filter((f) => {
    if (filtro === "atrasadas") return f.atrasadas > 0;
    if (filtro === "hoje") return f.hoje > 0;
    if (filtro === "alta") return f.alta_prioridade > 0;
    return true;
  });

  const filtros: { key: Filtro; label: string }[] = [
    { key: "todas", label: "Todos os clientes" },
    { key: "atrasadas", label: "Com atrasadas" },
    { key: "hoje", label: "Vencem hoje" },
    { key: "alta", label: "Alta prioridade" },
  ];

  return (
    <>
      <PageHeader
        title="Operacional"
        subtitle="Tarefas das famílias sincronizadas do Bitrix"
        actions={
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : totais ? (
          <>
            <KpiCard
              label="Famílias"
              value={String(totais.total_familias)}
              icon={<Users className="h-4 w-4" />}
              hint="Total no Bitrix"
            />
            <KpiCard
              label="Em aberto"
              value={String(totais.total_abertas)}
              icon={<ListTodo className="h-4 w-4" />}
              hint="Todas as famílias"
            />
            <KpiCard
              label="Atrasadas"
              value={String(totais.total_atrasadas)}
              icon={<Clock className="h-4 w-4" />}
              hint="Com prazo vencido"
            />
            <KpiCard
              label="Alta prioridade"
              value={String(totais.total_alta_prioridade)}
              icon={<Flame className="h-4 w-4" />}
              hint="Marcadas como urgentes"
            />
          </>
        ) : null}
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {filtros.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filtro === f.key
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {lastSync && (
            <span className="text-xs text-muted-foreground">
              Sync {format(lastSync, "HH:mm")}
            </span>
          )}
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

      {loading ? (
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : familiasFiltradas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          Nenhum cliente encontrado.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {familiasFiltradas.map((f) => (
            <button
              key={f.id}
              onClick={() => navigate(`/operacional/${f.id}`)}
              className="w-full text-left"
            >
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
                        {f.hoje > 0 && f.atrasadas === 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {f.hoje} hoje
                          </Badge>
                        )}
                        {f.alta_prioridade > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Flame className="h-3 w-3 mr-1" />
                            {f.alta_prioridade}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {f.responsavel_nome && <span>{f.responsavel_nome}</span>}
                        {f.ultima_atividade && (
                          <span>
                            Última atividade{" "}
                            {format(new Date(f.ultima_atividade), "dd/MM", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-lg font-semibold text-foreground">
                          {f.total_abertas}
                        </div>
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
