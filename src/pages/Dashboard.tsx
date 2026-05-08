import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import { Building2, Users, AlertTriangle, FileWarning } from "lucide-react";
import { Link } from "react-router-dom";
import { LoadingSkeleton } from "@/components/LoadingState";
import { supabase } from "@/integrations/supabase/client";

interface Kpis {
  familiasTotal: number;
  familiasOnboarding: number;
  familiasConcluidas: number;
  imoveisTotal: number;
  patrimonioTotal: number;
  docsPendentes: number;
  imoveisCompletos: number;
  alertasCriticos: number;
  alertasAtencao: number;
  topFamilias: { id: string; nome: string; imoveis: number; valor: number }[];
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: fams }, { data: imvs }, { data: ckImv }, { data: ckHld }, { data: ckOut }] =
        await Promise.all([
          supabase.from("familias_onboarding").select("id, nome, patrimonio_data"),
          supabase.from("imoveis_cliente").select("id, familia_id, valor_declarado"),
          supabase.from("checklist_imovel").select("status, opcional, imovel_id"),
          supabase.from("checklist_holding").select("status, opcional"),
          supabase.from("checklist_outros_bens").select("status, opcional"),
        ]);

      const familiasTotal = (fams ?? []).length;
      let familiasConcluidas = 0;
      let alertasCriticos = 0;
      let alertasAtencao = 0;
      for (const f of fams ?? []) {
        const pd: any = f.patrimonio_data ?? {};
        const alertas: any[] = pd?.alertas_gerais ?? [];
        for (const a of alertas) {
          const nivel = String(a?.nivel ?? "").toLowerCase();
          if (nivel === "critico" || nivel === "crítico") alertasCriticos += 1;
          else if (nivel === "atencao" || nivel === "atenção") alertasAtencao += 1;
        }
        if ((pd?.imoveis?.length ?? 0) > 0 || (pd?.holdings?.length ?? 0) > 0) {
          familiasConcluidas += 1;
        }
      }
      const familiasOnboarding = Math.max(familiasTotal - familiasConcluidas, 0);

      const imoveisTotal = (imvs ?? []).length;
      const patrimonioTotal = (imvs ?? []).reduce(
        (s: number, i: any) => s + Number(i.valor_declarado ?? 0),
        0,
      );

      const isPendente = (r: any) => r.status === "pendente";
      const docsPendentes =
        (ckImv ?? []).filter(isPendente).length +
        (ckHld ?? []).filter(isPendente).length +
        (ckOut ?? []).filter(isPendente).length;

      const porImovel = new Map<string, { rec: number; tot: number }>();
      for (const c of ckImv ?? []) {
        if ((c as any).opcional) continue;
        const id = (c as any).imovel_id as string;
        if (!porImovel.has(id)) porImovel.set(id, { rec: 0, tot: 0 });
        const e = porImovel.get(id)!;
        e.tot += 1;
        if ((c as any).status === "recebido") e.rec += 1;
      }
      let imoveisCompletos = 0;
      porImovel.forEach((v) => {
        if (v.tot > 0 && v.rec === v.tot) imoveisCompletos += 1;
      });

      const porFamilia = new Map<string, { imoveis: number; valor: number }>();
      for (const i of imvs ?? []) {
        const fid = (i as any).familia_id as string;
        if (!porFamilia.has(fid)) porFamilia.set(fid, { imoveis: 0, valor: 0 });
        const e = porFamilia.get(fid)!;
        e.imoveis += 1;
        e.valor += Number((i as any).valor_declarado ?? 0);
      }
      const topFamilias = (fams ?? [])
        .map((f: any) => ({
          id: f.id,
          nome: f.nome,
          imoveis: porFamilia.get(f.id)?.imoveis ?? 0,
          valor: porFamilia.get(f.id)?.valor ?? 0,
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5);

      setKpis({
        familiasTotal,
        familiasOnboarding,
        familiasConcluidas,
        imoveisTotal,
        patrimonioTotal,
        docsPendentes,
        imoveisCompletos,
        alertasCriticos,
        alertasAtencao,
        topFamilias,
      });
    })();
  }, []);

  if (!kpis) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Visão consolidada do portfólio Somma" />
        <LoadingSkeleton rows={6} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão consolidada do portfólio Somma" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link to="/familias" className="block">
          <KpiCard
            label="Famílias"
            value={String(kpis.familiasTotal)}
            icon={<Users className="h-4 w-4" />}
            hint={`${kpis.familiasOnboarding} em onboarding · ${kpis.familiasConcluidas} concluídos`}
          />
        </Link>
        <Link to="/imoveis" className="block">
          <KpiCard
            label="Imóveis"
            value={String(kpis.imoveisTotal)}
            icon={<Building2 className="h-4 w-4" />}
            hint={`${formatBRL(kpis.patrimonioTotal, { compact: true })} patrimônio total`}
          />
        </Link>
        <Link to="/imoveis?status=pendentes" className="block">
          <KpiCard
            label="Documentos pendentes"
            value={String(kpis.docsPendentes)}
            icon={<FileWarning className="h-4 w-4" />}
            hint={`${kpis.imoveisCompletos} imóveis com checklist completo`}
          />
        </Link>
        <Link to="/familias" className="block">
          <KpiCard
            label="Alertas"
            value={String(kpis.alertasCriticos + kpis.alertasAtencao)}
            icon={<AlertTriangle className="h-4 w-4" />}
            hint={`${kpis.alertasCriticos} críticos · ${kpis.alertasAtencao} atenção`}
          />
        </Link>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top 5 famílias por patrimônio declarado</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b">
              <tr>
                <th className="text-left px-5 py-3">Família</th>
                <th className="text-right px-5 py-3">Imóveis</th>
                <th className="text-right px-5 py-3">Patrimônio declarado</th>
              </tr>
            </thead>
            <tbody>
              {kpis.topFamilias.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center px-5 py-8 text-muted-foreground">
                    Nenhuma família cadastrada.
                  </td>
                </tr>
              )}
              {kpis.topFamilias.map((f) => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-3">
                    <Link
                      to={`/familias-onboarding/${f.id}`}
                      className="font-medium hover:text-gold"
                    >
                      {f.nome}
                    </Link>
                  </td>
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
