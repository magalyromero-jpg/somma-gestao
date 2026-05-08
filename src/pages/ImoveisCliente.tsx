import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Building2 } from "lucide-react";
import { calcularProgresso } from "@/lib/onboarding/checklistImovel";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ImovelRow {
  id: string;
  familia_id: string;
  nome: string;
  endereco: string | null;
  valor_declarado: number | null;
  titularidade: string | null;
  holding_cnpj: string | null;
  tipo_operacao: string | null;
  alertas: any;
  familia_nome?: string;
  holding_nome?: string | null;
  checklist: Array<{ status: string; opcional: boolean }>;
}

const TIPO_OPERACAO_LABEL: Record<string, string> = {
  renda: "Para renda",
  venda: "Para venda",
  valorizacao: "Valorização",
  uso_familiar: "Uso familiar",
};

function pctColorClass(pct: number) {
  if (pct === 100) return "bg-emerald-500";
  if (pct >= 50) return "bg-yellow-500";
  if (pct > 0) return "bg-orange-500";
  return "bg-red-500";
}

export default function ImoveisCliente() {
  const [rows, setRows] = useState<ImovelRow[]>([]);
  const [familias, setFamilias] = useState<Array<{ id: string; nome: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [familia, setFamilia] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [pjFilter, setPjFilter] = useState("todos");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("imoveis_cliente")
        .select(
          "id, familia_id, nome, endereco, valor_declarado, titularidade, holding_cnpj, tipo_operacao, alertas, checklist_imovel(status, opcional)",
        )
        .order("valor_declarado", { ascending: false, nullsFirst: false });
      const { data: fams } = await supabase.from("familias_onboarding").select("id, nome, patrimonio_data");
      const famMap = new Map((fams ?? []).map((f: any) => [f.id, f.nome]));
      // Map de holdings (cnpj -> razao_social) por família
      const holdingByCnpj = new Map<string, string>();
      (fams ?? []).forEach((f: any) => {
        for (const h of f?.patrimonio_data?.holdings ?? []) {
          if (h.cnpj) holdingByCnpj.set(String(h.cnpj).replace(/\D/g, ""), h.razao_social);
        }
      });
      const mapped: ImovelRow[] = (data ?? []).map((r: any) => ({
        ...r,
        familia_nome: famMap.get(r.familia_id),
        holding_nome: r.holding_cnpj
          ? holdingByCnpj.get(String(r.holding_cnpj).replace(/\D/g, "")) ?? null
          : null,
        checklist: r.checklist_imovel ?? [],
      }));
      setRows(mapped);
      setFamilias(((fams ?? []) as any).map((f: any) => ({ id: f.id, nome: f.nome })));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (familia !== "todas" && r.familia_id !== familia) return false;
      const prog = calcularProgresso(r.checklist as any);
      if (statusFilter === "completos" && prog.pct !== 100) return false;
      if (statusFilter === "andamento" && (prog.pct === 100 || prog.recebidos === 0)) return false;
      if (statusFilter === "nao_iniciado" && prog.recebidos !== 0) return false;
      
      if (pjFilter === "PF" && (r.titularidade ?? "").toUpperCase() !== "PF") return false;
      if (pjFilter === "PJ" && (r.titularidade ?? "").toUpperCase() !== "PJ") return false;
      if (q && !`${r.nome} ${r.endereco ?? ""} ${r.familia_nome ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [rows, familia, statusFilter, tipoFilter, pjFilter, q]);

  const kpis = useMemo(() => {
    const totalImoveis = rows.length;
    let totalDocs = 0;
    let recebidosDocs = 0;
    let completos = 0;
    let alertas = 0;
    rows.forEach((r) => {
      const prog = calcularProgresso(r.checklist as any);
      totalDocs += prog.total;
      recebidosDocs += prog.recebidos;
      if (prog.pct === 100 && prog.total > 0) completos += 1;
      const a = Array.isArray(r.alertas) ? r.alertas.length : 0;
      alertas += a;
    });
    return { totalImoveis, totalDocs, recebidosDocs, completos, alertas };
  }, [rows]);

  const top3Ids = useMemo(() => {
    return [...rows]
      .sort((a, b) => (b.valor_declarado ?? 0) - (a.valor_declarado ?? 0))
      .slice(0, 3)
      .map((r) => r.id);
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total imóveis" value={String(kpis.totalImoveis)} />
        <KPI
          label="Docs recebidos"
          value={`${kpis.recebidosDocs} / ${kpis.totalDocs}`}
          sub={kpis.totalDocs > 0 ? `${Math.round((kpis.recebidosDocs / kpis.totalDocs) * 100)}%` : "0%"}
        />
        <KPI label="Completos" value={String(kpis.completos)} sub="imóveis" />
        <KPI label="Alertas" value={String(kpis.alertas)} sub="atenção" highlight={kpis.alertas > 0} />
      </div>

      <Card className="p-4 shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, endereço ou família" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={familia} onValueChange={setFamilia}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as famílias</SelectItem>
              {familias.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="completos">Completo</SelectItem>
              <SelectItem value="andamento">Em andamento</SelectItem>
              <SelectItem value="nao_iniciado">Não iniciado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="renda">Para renda</SelectItem>
              <SelectItem value="venda">Para venda</SelectItem>
              <SelectItem value="valorizacao">Valorização</SelectItem>
              <SelectItem value="uso_familiar">Uso familiar</SelectItem>
            </SelectContent>
          </Select>
          <Select value={pjFilter} onValueChange={setPjFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">PF e PJ</SelectItem>
              <SelectItem value="PF">Pessoa Física</SelectItem>
              <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Nenhum imóvel cadastrado. Importe via onboarding ou adicione manualmente.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const prog = calcularProgresso(r.checklist as any);
            const prioritario = top3Ids.includes(r.id);
            return (
              <Link
                key={r.id}
                to={`/imoveis/cliente/${r.id}`}
                className="block"
              >
                <Card className="p-4 hover:shadow-md transition-shadow shadow-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Building2 className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h3 className="font-medium truncate">{r.nome}</h3>
                          {prioritario && <Badge className="bg-gold/15 text-gold border-gold/40 hover:bg-gold/15">Prioritário</Badge>}
                          {(r.titularidade ?? "").toUpperCase() === "PJ" ? (
                            <Badge variant="outline" className="bg-orange-500/15 text-orange-700 border-orange-500/30">
                              PJ{r.holding_nome ? ` · ${r.holding_nome}` : ""}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-500/15 text-blue-700 border-blue-500/30">PF</Badge>
                          )}
                          {r.tipo_operacao && (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">
                              {TIPO_OPERACAO_LABEL[r.tipo_operacao] ?? r.tipo_operacao}
                            </Badge>
                          )}
                          {Array.isArray(r.alertas) && r.alertas.length > 0 && (
                            <Badge variant="outline" className="border-amber-400 text-amber-700">
                              {r.alertas.length} alerta{r.alertas.length > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {r.familia_nome ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{r.endereco ?? ""}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-medium">{r.valor_declarado ? formatBRL(r.valor_declarado) : "—"}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="text-xs text-muted-foreground w-24 shrink-0">Documentos</div>
                    <div className="h-2 bg-muted rounded-full flex-1 overflow-hidden">
                      <div
                        className={cn("h-full transition-all", pctColorClass(prog.pct))}
                        style={{ width: `${Math.max(prog.pct, prog.total === 0 ? 0 : 4)}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground w-24 text-right shrink-0">
                      {prog.recebidos}/{prog.total} — {prog.pct}%
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <Card className="p-4 shadow-card">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-extralight mt-1", highlight && "text-amber-600")}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
