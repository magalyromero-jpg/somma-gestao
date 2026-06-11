import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import {
  Building2, Users, AlertTriangle, FileWarning,
  ListTodo, Clock, Flame, CheckCheck, RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { LoadingSkeleton } from "@/components/LoadingState";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Kpis {
  familiasTotal: number; familiasOnboarding: number; familiasConcluidas: number;
  imoveisTotal: number; patrimonioTotal: number; docsPendentes: number;
  imoveisCompletos: number; alertasCriticos: number; alertasAtencao: number;
  topFamilias: { id: string; nome: string; imoveis: number; valor: number }[];
}
interface BitrixResumo { total: number; pendentes: number; em_andamento: number; alta_prioridade: number; atrasadas: number; }
interface TarefaUrgente { titulo: string; status: string; prioridade: string; prazo: string | null; responsavel_nome: string | null; familia_id: string; link_bitrix: string | null; }

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800", in_progress: "bg-blue-100 text-blue-800",
  awaiting_control: "bg-purple-100 text-purple-800", completed: "bg-green-100 text-green-800", deferred: "bg-gray-100 text-gray-600",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", in_progress: "Em andamento", awaiting_control: "Aguard. controle", completed: "Concluída", deferred: "Adiada",
};

function PrazoBadge({ prazo }: { prazo: string | null }) {
  if (!prazo) return null;
  const date = new Date(prazo);
  const atrasado = isPast(date) && !isToday(date);
  const hoje = isToday(date);
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${atrasado ? "bg-red-100 text-red-700" : hoje ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>
      <Clock className="w-3 h-3" />
      {atrasado ? "Atrasada" : hoje ? "Hoje" : format(date, "dd/MM", { locale: ptBR })}
    </span>
  );
}

function BitrixSection() {
  const [resumo, setResumo] = useState<BitrixResumo | null>(null);
  const [urgentes, setUrgentes] = useState<TarefaUrgente[]>([]);
  const [familiaMap, setFamiliaMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("bitrix-proxy", { body: { action: "resumo_dashboard" } });
      if (data?.resumo) setResumo(data.resumo);
      const { data: tarefas } = await supabase
        .from("bitrix_tarefas_cache").select("titulo, status, prioridade, prazo, responsavel_nome, familia_id, link_bitrix")
        .neq("status", "completed")
        .or("prioridade.eq.high,prazo.lte." + new Date().toISOString())
        .order("prazo", { ascending: true, nullsFirst: false }).limit(8);
      if (tarefas) setUrgentes(tarefas as TarefaUrgente[]);
      const { data: fams } = await supabase.from("familias_onboarding").select("id, nome");
      if (fams) {
        const map: Record<string, string> = {};
        fams.forEach((f: any) => { map[f.id] = f.nome; });
        setFamiliaMap(map);
      }
      setLastSync(new Date());
    } catch { }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (!loading && !resumo && urgentes.length === 0) return null;

  return (
    <>
      <div className="flex items-center justify-between mb-3 mt-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Operacional · Bitrix24</h2>
        <div className="flex items-center gap-2">
          {lastSync && <span className="text-xs text-muted-foreground">Sync {format(lastSync, "HH:mm")}</span>}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {loading ? [1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />) : resumo ? (
          <>
            <KpiCard label="Tarefas em aberto" value={String(resumo.total)} icon={<ListTodo className="h-4 w-4" />} hint={`${resumo.pendentes} pendentes · ${resumo.em_andamento} em andamento`} />
            <KpiCard label="Alta prioridade" value={String(resumo.alta_prioridade)} icon={<Flame className="h-4 w-4" />} hint="Tarefas marcadas como urgentes" />
            <KpiCard label="Atrasadas" value={String(resumo.atrasadas)} icon={<Clock className="h-4 w-4" />} hint="Com prazo vencido" />
            <KpiCard label="Concluídas (cache)" value="—" icon={<CheckCheck className="h-4 w-4" />} hint="Sincronize por família para ver" />
          </>
        ) : null}
      </div>
      {urgentes.length > 0 && (
        <Card className="shadow-card mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Tarefas urgentes
              <Badge className="bg-red-100 text-red-700 border-0 font-medium">{urgentes.filter(t => t.prioridade === "high" || (t.prazo && isPast(new Date(t.prazo)))).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-5 py-3">Tarefa</th>
                  <th className="text-left px-5 py-3 hidden md:table-cell">Família</th>
                  <th className="text-left px-5 py-3 hidden md:table-cell">Responsável</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {urgentes.map((t, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3 max-w-xs">
                      {t.link_bitrix ? <a href={t.link_bitrix} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline line-clamp-2">{t.titulo}</a> : <span className="font-medium line-clamp-2">{t.titulo}</span>}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell text-muted-foreground">
                      {t.familia_id && familiaMap[t.familia_id] ? <Link to={`/familias-onboarding/${t.familia_id}`} className="hover:underline">{familiaMap[t.familia_id]}</Link> : "—"}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell text-muted-foreground">{t.responsavel_nome ?? "—"}</td>
                    <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[t.status] ?? ""}`}>{STATUS_LABEL[t.status] ?? t.status}</span></td>
                    <td className="px-5 py-3"><PrazoBadge prazo={t.prazo} /></td>
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

export default function Dashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: fams }, { data: imvs }, { data: ckImv }, { data: ckHld }, { data: ckOut }] = await Promise.all([
        supabase.from("familias_onboarding").select("id, nome, patrimonio_data"),
        supabase.from("imoveis_cliente").select("id, familia_id, valor_declarado"),
        supabase.from("checklist_imovel").select("status, opcional, imovel_id"),
        supabase.from("checklist_holding").select("status, opcional"),
        supabase.from("checklist_outros_bens").select("status, opcional"),
      ]);
      const familiasTotal = (fams ?? []).length;
      let familiasConcluidas = 0, alertasCriticos = 0, alertasAtencao = 0;
      for (const f of fams ?? []) {
        const pd: any = f.patrimonio_data ?? {};
        for (const a of pd?.alertas_gerais ?? []) {
          const nivel = String(a?.nivel ?? "").toLowerCase();
          if (nivel === "critico" || nivel === "crítico") alertasCriticos++;
          else if (nivel === "atencao" || nivel === "atenção") alertasAtencao++;
        }
        if ((pd?.imoveis?.length ?? 0) > 0 || (pd?.holdings?.length ?? 0) > 0) familiasConcluidas++;
      }
      const imoveisTotal = (imvs ?? []).length;
      const patrimonioTotal = (imvs ?? []).reduce((s: number, i: any) => s + Number(i.valor_declarado ?? 0), 0);
      const isPendente = (r: any) => r.status === "pendente";
      const docsPendentes = (ckImv ?? []).filter(isPendente).length + (ckHld ?? []).filter(isPendente).length + (ckOut ?? []).filter(isPendente).length;
      const porImovel = new Map<string, { rec: number; tot: number }>();
      for (const c of ckImv ?? []) {
        if ((c as any).opcional) continue;
        const id = (c as any).imovel_id as string;
        if (!porImovel.has(id)) porImovel.set(id, { rec: 0, tot: 0 });
        const e = porImovel.get(id)!;
        e.tot++;
        if ((c as any).status === "recebido") e.rec++;
      }
      let imoveisCompletos = 0;
      porImovel.forEach(v => { if (v.tot > 0 && v.rec === v.tot) imoveisCompletos++; });
      const porFamilia = new Map<string, { imoveis: number; valor: number }>();
      for (const i of imvs ?? []) {
        const fid = (i as any).familia_id as string;
        if (!porFamilia.has(fid)) porFamilia.set(fid, { imoveis: 0, valor: 0 });
        const e = porFamilia.get(fid)!;
        e.imoveis++; e.valor += Number((i as any).valor_declarado ?? 0);
      }
      const topFamilias = (fams ?? []).map((f: any) => ({ id: f.id, nome: f.nome, imoveis: porFamilia.get(f.id)?.imoveis ?? 0, valor: porFamilia.get(f.id)?.valor ?? 0 })).sort((a, b) => b.valor - a.valor).slice(0, 5);
      setKpis({ familiasTotal, familiasOnboarding: Math.max(familiasTotal - familiasConcluidas, 0), familiasConcluidas, imoveisTotal, patrimonioTotal, docsPendentes, imoveisCompletos, alertasCriticos, alertasAtencao, topFamilias });
    })();
  }, []);

  if (!kpis) return (<><PageHeader title="Dashboard" subtitle="Visão consolidada do portfólio Somma" /><LoadingSkeleton rows={6} /></>);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão consolidada do portfólio Somma" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link to="/familias" className="block"><KpiCard label="Famílias" value={String(kpis.familiasTotal)} icon={<Users className="h-4 w-4" />} hint={`${kpis.familiasOnboarding} em onboarding · ${kpis.familiasConcluidas} concluídos`} /></Link>
        <Link to="/imoveis" className="block"><KpiCard label="Imóveis" value={String(kpis.imoveisTotal)} icon={<Building2 className="h-4 w-4" />} hint={`${formatBRL(kpis.patrimonioTotal, { compact: true })} patrimônio total`} /></Link>
        <Link to="/imoveis?status=pendentes" className="block"><KpiCard label="Documentos pendentes" value={String(kpis.docsPendentes)} icon={<FileWarning className="h-4 w-4" />} hint={`${kpis.imoveisCompletos} imóveis com checklist completo`} /></Link>
        <Link to="/familias" className="block"><KpiCard label="Alertas" value={String(kpis.alertasCriticos + kpis.alertasAtencao)} icon={<AlertTriangle className="h-4 w-4" />} hint={`${kpis.alertasCriticos} críticos · ${kpis.alertasAtencao} atenção`} /></Link>
      </div>
      <BitrixSection />
      <Card className="shadow-card">
        <CardHeader className="pb-2"><CardTitle className="text-base">Top 5 famílias por patrimônio declarado</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b">
              <tr><th className="text-left px-5 py-3">Família</th><th className="text-right px-5 py-3">Imóveis</th><th className="text-right px-5 py-3">Patrimônio declarado</th></tr>
            </thead>
            <tbody>
              {kpis.topFamilias.length === 0 && <tr><td colSpan={3} className="text-center px-5 py-8 text-muted-foreground">Nenhuma família cadastrada.</td></tr>}
              {kpis.topFamilias.map(f => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-3"><Link to={`/familias-onboarding/${f.id}`} className="font-medium hover:text-gold">{f.nome}</Link></td>
                  <td className="text-right px-5 py-3">{f.imoveis}</td>
                  <td className="text-right px-5 py-3 font-medium">{formatBRL(f.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
