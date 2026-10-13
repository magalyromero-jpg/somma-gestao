import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Bloco, CORES, FaixaNumeros, LegendaTexto, chartTooltipStyle, tableClasses } from "@/components/operacional/Shared";
import { cn } from "@/lib/utils";

const db = supabase as any;
const brl = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const brlK = (n: number) => n >= 1e6 ? `R$ ${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi` : `R$ ${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
const dt = (s: string | null | undefined) => s ? s.slice(0, 10).split("-").reverse().join("/") : "—";
const m2 = (n: number | null | undefined) => n == null ? "—" : `${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²`;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const CICLO: Record<string, { label: string; cls: string }> = {
  vigente: { label: "Vigente", cls: "op-tag-green" },
  a_vencer_12m: { label: "Vence em 12 meses", cls: "op-tag-blue" },
  a_vencer_120d: { label: "Vence em 120 dias", cls: "op-tag-amber" },
  vencido_sem_renovacao: { label: "Vencido", cls: "op-tag-red" },
  fim_a_informar: { label: "Fim a informar", cls: "op-tag-gray" },
  encerrado: { label: "Encerrado", cls: "op-tag-gray" },
  encerrado_em_pauta: { label: "Encerrado · em pauta", cls: "op-tag-gray" },
};

async function carregar() {
  const { data: ed, error } = await db.from("loc_edificios").select("id,nome").eq("nome", "Zen Tower").maybeSingle();
  if (error) throw error;
  if (!ed) return null;
  const id = ed.id;
  const ano = new Date().getFullYear();
  const [vig, contratos, locs, ciclo, ocup, pags, orcado, metragem, vigencias] = await Promise.all([
    db.from("loc_v_contrato_vigente").select("*").eq("edificio_id", id),
    db.from("loc_contratos").select("id,locatario_id,status,dia_vencimento,retencao_pct").eq("edificio_id", id),
    db.from("loc_locatarios").select("id,nome"),
    db.from("loc_v_ciclo").select("contrato_id,ciclo,dias_para_o_fim").eq("edificio_id", id),
    db.from("loc_v_ocupacao").select("unidade_id,nome,tipo,situacao").eq("edificio_id", id),
    db.from("loc_pagamentos").select("id,codigo,imovel_nome,data_vencimento,data_pagamento,valor_liquido,contrato_id,dias_atraso").eq("edificio_id", id).order("data_pagamento", { ascending: false }),
    db.rpc("loc_orcado_caixa", { p_edificio: id, p_ano: ano }),
    db.from("loc_v_metragem").select("*").eq("edificio_id", id),
    db.from("loc_vigencias").select("id,contrato_id,seq,tipo,inicio,fim,documento_id").eq("edificio_id", id),
  ]);
  for (const r of [vig, contratos, locs, ciclo, ocup, pags, orcado, metragem, vigencias]) if (r.error) throw r.error;
  return { edificio: ed, ano, vig: vig.data, contratos: contratos.data, locs: locs.data, ciclo: ciclo.data, ocup: ocup.data, pags: pags.data, orcado: orcado.data, metragem: metragem.data, vigencias: vigencias.data };
}

export default function ZenTower() {
  const { data, isLoading, error } = useQuery({ queryKey: ["zen-tower"], queryFn: carregar });
  const [soDivergentes, setSoDivergentes] = useState(true);

  const d = useMemo(() => {
    if (!data) return null;
    const locNome = new Map<string, string>(data.locs.map((l: any) => [l.id, l.nome]));
    const contr = new Map<string, any>(data.contratos.map((c: any) => [c.id, c]));
    const ciclo = new Map<string, any>(data.ciclo.map((c: any) => [c.contrato_id, c]));
    const linhas = data.vig.map((v: any) => ({ ...v, locatario: locNome.get(contr.get(v.contrato_id)?.locatario_id) ?? "—", ciclo: ciclo.get(v.contrato_id) }))
      .sort((a: any, b: any) => (a.unidades ?? "").localeCompare(b.unidades ?? "", "pt-BR", { numeric: true }));
    const nomeContrato = new Map<string, string>(linhas.map((l: any) => [l.contrato_id, `${l.unidades ?? "—"} · ${l.locatario}`]));
    const anoStr = String(data.ano);
    const meses = MESES.map((m, i) => {
      const key = `${anoStr}-${String(i + 1).padStart(2, "0")}`;
      const orcado = data.orcado.filter((o: any) => o.mes.startsWith(key)).reduce((s: number, o: any) => s + Number(o.valor ?? 0), 0);
      const realizado = data.pags.filter((p: any) => p.data_pagamento.startsWith(key)).reduce((s: number, p: any) => s + Number(p.valor_liquido ?? 0), 0);
      return { mes: m, key, orcado, realizado: realizado || null };
    });
    const hojeKey = new Date().toISOString().slice(0, 7);
    const ytd = meses.filter((m) => m.key <= hojeKey);
    const ocupadas = data.ocup.filter((u: any) => u.situacao === "locada").length;
    const semPdf = data.vigencias.filter((v: any) => !v.documento_id);
    const divergentes = data.metragem.filter((m: any) => m.diferenca_m2 != null && Math.abs(m.diferenca_m2) > 1);
    return {
      linhas, nomeContrato, meses, ocupadas, semPdf, divergentes,
      totalVigente: linhas.reduce((s: number, l: any) => s + Number(l.valor_vigente ?? 0), 0),
      orcadoYtd: ytd.reduce((s, m) => s + m.orcado, 0),
      realizadoYtd: ytd.reduce((s, m) => s + (m.realizado ?? 0), 0),
      aVencer: linhas.filter((l: any) => ["a_vencer_120d", "vencido_sem_renovacao"].includes(l.ciclo?.ciclo)).length,
      semContrato: data.pags.filter((p: any) => !p.contrato_id),
    };
  }, [data]);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-72 w-full" /></div>;
  if (error) return <p className="text-sm text-destructive">Não foi possível carregar o Zen Tower: {(error as Error).message}</p>;
  if (!data || !d) return <p className="text-sm text-muted-foreground">Edifício Zen Tower não encontrado.</p>;

  return (
    <div className="op-theme space-y-4">
      <PageHeader title="Zen Tower" subtitle="Administração · Gestão de locações" />
      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList>
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="caixa">Fluxo de caixa</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="conferencia">Conferência</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-4">
          <FaixaNumeros itens={[
            { label: "Unidades", valor: data.ocup.length, detalhe: `${d.ocupadas} locadas · ${data.ocup.length - d.ocupadas} vagas` },
            { label: "Ocupação", valor: `${data.ocup.length ? Math.round(d.ocupadas / data.ocup.length * 100) : 0}%` },
            { label: "Contratos ativos", valor: d.linhas.length },
            { label: "Aluguel vigente / mês", valor: brlK(d.totalVigente) },
            { label: `Orçado ${data.ano} até hoje`, valor: brlK(d.orcadoYtd) },
            { label: `Realizado ${data.ano} até hoje`, valor: brlK(d.realizadoYtd), detalhe: d.orcadoYtd ? `${Math.round(d.realizadoYtd / d.orcadoYtd * 100)}% do orçado` : undefined },
            { label: "Vencidos ou a vencer (120 d)", valor: d.aVencer, danger: d.aVencer > 0 },
          ]} />
          <Bloco titulo={`Orçado × realizado em caixa — ${data.ano}`}><CaixaChart meses={d.meses} /></Bloco>
        </TabsContent>

        <TabsContent value="contratos">
          <Bloco titulo="Contratos vigentes" acao={<span className="text-xs text-muted-foreground">{d.linhas.length} contratos</span>}>
            <div className={tableClasses.wrap}><table className={cn(tableClasses.table, "min-w-[1100px]")}><thead><tr className={tableClasses.head}>
              {["Unidade", "Locatário", "Matrícula", "Índice", "Valor vigente", "m² contrato", "m² matrícula", "R$/m²", "Início", "Fim", "Ciclo"].map((h, i) => <th key={h} className={cn(tableClasses.th, i >= 4 && i <= 7 && "text-right")}>{h}</th>)}
            </tr></thead><tbody>{d.linhas.map((l: any) => <tr key={l.contrato_id}>
              <td className={cn(tableClasses.td, "font-medium")}>{l.unidades ?? "—"}</td>
              <td className={tableClasses.td}>{l.locatario}</td>
              <td className={tableClasses.td}>{l.matriculas ?? "—"}</td>
              <td className={tableClasses.td}>{l.indice === "MEDIA" ? "Média IPCA/IGP-M" : l.indice ?? "—"}</td>
              <td className={tableClasses.num}>{brl(l.valor_vigente)}</td>
              <td className={tableClasses.num}>{m2(l.area_contrato_m2)}</td>
              <td className={tableClasses.num}>{m2(l.area_matricula_m2)}</td>
              <td className={tableClasses.num}>{brl(l.rs_m2_matricula)}</td>
              <td className={tableClasses.td}>{dt(l.inicio)}</td>
              <td className={tableClasses.td}>{dt(l.fim)}</td>
              <td className={tableClasses.td}>{l.ciclo && <span className={cn("op-tag", CICLO[l.ciclo.ciclo]?.cls)}>{CICLO[l.ciclo.ciclo]?.label ?? l.ciclo.ciclo}</span>}</td>
            </tr>)}</tbody></table></div>
          </Bloco>
        </TabsContent>

        <TabsContent value="caixa" className="space-y-4">
          <Bloco titulo={`Orçado × realizado em caixa — ${data.ano}`}><CaixaChart meses={d.meses} /></Bloco>
          <Bloco titulo="Por mês">
            <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
              <th className={tableClasses.th}>Mês</th><th className={cn(tableClasses.th, "text-right")}>Orçado</th><th className={cn(tableClasses.th, "text-right")}>Realizado</th><th className={cn(tableClasses.th, "text-right")}>Diferença</th>
            </tr></thead><tbody>{d.meses.map((m) => <tr key={m.key}>
              <td className={tableClasses.td}>{m.mes}/{data.ano}</td>
              <td className={tableClasses.num}>{brl(m.orcado)}</td>
              <td className={tableClasses.num}>{m.realizado == null ? "—" : brl(m.realizado)}</td>
              <td className={cn(tableClasses.num, m.realizado != null && m.realizado < m.orcado && "text-destructive")}>{m.realizado == null ? "—" : brl(m.realizado - m.orcado)}</td>
            </tr>)}</tbody></table></div>
          </Bloco>
          <p className="text-xs text-muted-foreground">Orçado: valores contratuais conhecidos, com retenção aplicada; o boleto do mês paga o aluguel do mês anterior. Realizado: valor líquido recebido, pela data de pagamento.</p>
        </TabsContent>

        <TabsContent value="pagamentos" className="space-y-4">
          <FaixaNumeros itens={[
            { label: "Pagamentos registrados", valor: data.pags.length },
            { label: "Sem contrato", valor: d.semContrato.length, detalhe: "auditório, heliponto, rooftop, estacionamento" },
            { label: "Total recebido", valor: brlK(data.pags.reduce((s: number, p: any) => s + Number(p.valor_liquido), 0)) },
          ]} />
          <Bloco titulo="Pagamentos recebidos">
            <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
              {["Pagamento", "Vencimento", "Código", "Imóvel", "Contrato", "Atraso", "Valor líquido"].map((h, i) => <th key={h} className={cn(tableClasses.th, i >= 5 && "text-right")}>{h}</th>)}
            </tr></thead><tbody>{data.pags.map((p: any) => <tr key={p.id}>
              <td className={tableClasses.td}>{dt(p.data_pagamento)}</td>
              <td className={tableClasses.td}>{dt(p.data_vencimento)}</td>
              <td className={cn(tableClasses.td, "tabular-nums text-muted-foreground")}>{p.codigo}</td>
              <td className={tableClasses.td}>{p.imovel_nome?.replace("Zen Tower - ", "")}</td>
              <td className={tableClasses.td}>{p.contrato_id ? d.nomeContrato.get(p.contrato_id) ?? "—" : <span className="op-tag op-tag-gray">Sem contrato</span>}</td>
              <td className={cn(tableClasses.num, p.dias_atraso > 3 && "text-destructive")}>{p.dias_atraso ? `${p.dias_atraso} d` : "—"}</td>
              <td className={tableClasses.num}>{brl(p.valor_liquido)}</td>
            </tr>)}</tbody></table></div>
          </Bloco>
        </TabsContent>

        <TabsContent value="conferencia" className="space-y-4">
          <Bloco titulo="Metragem: contrato × matrícula" acao={<label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={soDivergentes} onCheckedChange={setSoDivergentes} />Só divergentes ({d.divergentes.length})</label>}>
            <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
              <th className={tableClasses.th}>Unidades</th><th className={tableClasses.th}>Matrículas</th><th className={cn(tableClasses.th, "text-right")}>m² contrato</th><th className={cn(tableClasses.th, "text-right")}>m² matrícula</th><th className={cn(tableClasses.th, "text-right")}>Diferença</th>
            </tr></thead><tbody>{(soDivergentes ? d.divergentes : data.metragem).map((m: any) => <tr key={m.contrato_id}>
              <td className={cn(tableClasses.td, "font-medium")}>{m.unidades ?? "—"}</td>
              <td className={tableClasses.td}>{m.matriculas ?? "—"}</td>
              <td className={tableClasses.num}>{m2(m.area_contrato_m2)}</td>
              <td className={tableClasses.num}>{m2(m.area_matricula_m2)}</td>
              <td className={cn(tableClasses.num, m.diferenca_m2 != null && Math.abs(m.diferenca_m2) > 1 && "font-semibold text-destructive")}>{m2(m.diferenca_m2)}</td>
            </tr>)}</tbody></table></div>
          </Bloco>
          <Bloco titulo="Contratos e aditivos sem PDF" acao={<span className="text-xs text-muted-foreground">{d.semPdf.length} pendentes</span>}>
            <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
              <th className={tableClasses.th}>Contrato</th><th className={tableClasses.th}>Documento</th><th className={tableClasses.th}>Início</th><th className={tableClasses.th}>Fim</th>
            </tr></thead><tbody>{[...d.semPdf].sort((a: any, b: any) => (d.nomeContrato.get(a.contrato_id) ?? "").localeCompare(d.nomeContrato.get(b.contrato_id) ?? "", "pt-BR", { numeric: true }) || a.seq - b.seq).map((v: any) => <tr key={v.id}>
              <td className={tableClasses.td}>{d.nomeContrato.get(v.contrato_id) ?? "Contrato encerrado"}</td>
              <td className={tableClasses.td}>{v.tipo === "contrato" ? "Contrato inicial" : `${v.seq}º aditivo`}</td>
              <td className={tableClasses.td}>{dt(v.inicio)}</td>
              <td className={tableClasses.td}>{dt(v.fim)}</td>
            </tr>)}</tbody></table></div>
          </Bloco>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CaixaChart({ meses }: { meses: { mes: string; orcado: number; realizado: number | null }[] }) {
  return <>
    <LegendaTexto itens={[{ cor: CORES.secundaria, label: "Orçado" }, { cor: CORES.ouro, label: "Realizado" }]} />
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={meses}>
        <CartesianGrid vertical={false} stroke={CORES.borda} />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: CORES.texto }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: CORES.texto }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)} mil`} width={56} />
        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => brl(v)} cursor={{ fill: "hsl(var(--surface2))" }} />
        <Bar dataKey="orcado" name="Orçado" fill={CORES.secundaria} radius={[3, 3, 0, 0]} />
        <Line dataKey="realizado" name="Realizado" stroke={CORES.ouro} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
      </ComposedChart>
    </ResponsiveContainer>
  </>;
}
