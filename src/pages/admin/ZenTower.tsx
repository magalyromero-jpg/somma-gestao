import { useSaldoEmAberto } from "@/hooks/useSaldoEmAberto";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {  Bloco,   } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { cn } from "@/lib/utils";
import { PrazoRecebimento } from "@/components/locacoes/PrazoRecebimento";
import { Documentos } from "@/components/locacoes/Documentos";
import { FluxoCaixa } from "@/components/locacoes/FluxoCaixa";
import { PlanejamentoCaixa } from "@/components/locacoes/PlanejamentoCaixa";
import { ImportarPagamentos } from "@/components/locacoes/ImportarDocs";
import { ContratosEncerrados, EditarContrato, EncerrarContrato, NovoContrato } from "@/components/locacoes/GestaoContratos";
import { MESES, MESES_LONGOS, addMes, baseRenovacoes, brl, dt, indiceLabel, m2, num2, pct } from "@/lib/locacoes";
import { BlocoCicloVencimento, BlocoIndiceReajuste, Renovacoes } from "@/components/locacoes/Renovacoes";
import { reajusteRealizado } from "@/lib/leituraDocumento";

const db = supabase as any;

const CICLO: Record<string, { label: string; cls: string }> = {
  vigente: { label: "Vigente", cls: "op-tag-green" },
  a_vencer_12m: { label: "Vence em 12 meses", cls: "op-tag-blue" },
  a_vencer_120d: { label: "Vence em 120 dias", cls: "op-tag-amber" },
  vencido_sem_renovacao: { label: "Vencido", cls: "op-tag-red" },
  fim_a_informar: { label: "Fim a informar", cls: "op-tag-gray" },
  encerrado: { label: "Encerrado", cls: "op-tag-gray" },
  encerrado_em_pauta: { label: "Encerrado · em pauta", cls: "op-tag-gray" },
};

async function carregar(edificioId: string | undefined, admin: boolean) {
  const q = db.from("loc_edificios").select("id,nome");
  const { data: ed, error } = await (edificioId ? q.eq("id", edificioId) : q.eq("nome", "Zen Tower")).maybeSingle();
  if (error) throw error;
  if (!ed) return null;
  const id = ed.id;
  const ult = await db.from("loc_pagamentos").select("data_pagamento").eq("edificio_id", id).order("data_pagamento", { ascending: false }).limit(1);
  const ultimoPag: string = ult.data?.[0]?.data_pagamento ?? "";
  const ano = ultimoPag ? Number(ultimoPag.slice(0, 4)) : 2026;
  const relogio = new Date().toISOString().slice(0, 10);
  const hojeRef = ultimoPag > relogio ? ultimoPag : relogio;
  const rs = await Promise.all([
    db.from("loc_v_contrato_vigente").select("*").eq("edificio_id", id),
    db.from("loc_contratos").select("id,locatario_id,status,tipo,dia_vencimento,retencao_pct,data_inicio,no_orcamento").eq("edificio_id", id),
    db.from("loc_locatarios").select("id,nome"),
    db.from("loc_v_encerrados").select("*").eq("edificio_id", id),
    db.from("loc_v_ciclo").select("contrato_id,ciclo,dias_para_o_fim,fim_contrato").eq("edificio_id", id),
    db.from("loc_v_ocupacao").select("unidade_id,nome,tipo,situacao").eq("edificio_id", id),
    db.from("loc_pagamentos").select("id,codigo,imovel_nome,data_vencimento,data_pagamento,valor_liquido,contrato_id,dias_atraso").eq("edificio_id", id).order("data_pagamento", { ascending: false }).limit(5000),
    db.rpc("loc_orcado_caixa", { p_edificio: id, p_ano: ano }),
    db.from("loc_v_metragem").select("*").eq("edificio_id", id),
    db.from("loc_vigencias").select("id,contrato_id,seq,tipo,inicio,fim,valor_mensal,area_contrato_m2,indice,mes_reajuste,no_orcamento,observacao,data_documento").eq("edificio_id", id),
    db.from("loc_v_alerta_reajuste").select("*").eq("edificio_id", id),
    db.from("loc_v_auditoria_reajuste").select("*").eq("edificio_id", id),
    db.from("loc_v_evolucao").select("*").eq("edificio_id", id),
    db.from("loc_indices").select("indice,mes,fonte").order("mes", { ascending: false }).limit(60),
    db.from("loc_projecao_indices").select("*"),
    db.from("loc_projecao_regras").select("*").eq("edificio_id", id),
  ]);
  for (const r of rs) if (r.error) throw r.error;
  const [vig, contratos, locs, encerrados, ciclo, ocup, pags, orcado, metragem, vigencias, alertas, auditoria, evolucao, indices, focus, regras] = rs.map((r) => r.data ?? []);
  // unidades e locatários de todos os contratos (orçado fixo × reforecast)
  const [cuAll, lcAll, prevR] = await Promise.all([
    db.from("loc_contrato_unidades").select("contrato_id,loc_unidades(nome,tipo)").eq("edificio_id", id),
    db.from("loc_v_locatarios_cliente").select("id,nome").eq("edificio_id", id),
    db.rpc("loc_previsto_caixa", { p_edificio: id, p_ano: ano }),
  ]);
  const nomesLoc = new Map<string, string>((lcAll.data ?? []).map((l: any) => [l.id, l.nome]));
  const contratosInfo = contratos.map((c: any) => ({
    ...c, locatario: nomesLoc.get(c.locatario_id) ?? "—",
    unidades: (cuAll.data ?? []).filter((x: any) => x.contrato_id === c.id && x.loc_unidades?.tipo !== "garagem").map((x: any) => x.loc_unidades?.nome).sort((a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true })).join(" + "),
  })).filter((c: any) => c.unidades);
  const previsto = prevR.data ?? [];
  const vigIds = vigencias.map((v: any) => v.id);
  const deg = vigIds.length ? await db.from("loc_vigencia_degraus").select("*").in("vigencia_id", vigIds) : { data: [] };
  if (deg.error) throw deg.error;
  // reajustes por índice nos próximos meses (somente valor certo)
  const hoje = hojeRef;
  const limite = addMes(hoje.slice(0, 7), 4) + "-31";
  const vigMap = new Map<string, any>(vig.map((v: any) => [v.contrato_id, v]));
  const proximos = alertas.filter((a: any) => a.aniversario >= hoje && a.aniversario <= limite && !reajusteRealizado(auditoria, a.contrato_id, a.aniversario));
  const calc = await Promise.all(proximos.map((a: any) =>
    db.rpc("loc_calcular_reajuste", { p_contrato: a.contrato_id, p_aniversario: a.aniversario, p_valor_anterior: vigMap.get(a.contrato_id)?.valor_vigente ?? 0 })
      .then((r: any) => ({ ...a, calc: r.data?.[0] ?? null }))));
  return { edificio: ed, ano, vig, contratos, locs, encerrados, ciclo, ocup, pags, orcado, metragem, vigencias, auditoria, evolucao, indices, focus, regras, degraus: deg.data ?? [], reajustesCalc: calc, admin, contratosInfo, previsto, hoje: hojeRef };
}

export type DadosZen = NonNullable<Awaited<ReturnType<typeof carregar>>>;

export default function ZenTower() {
  return <PortalEdificio modo="admin" />;
}

export function PortalEdificio({ edificioId, modo }: { edificioId?: string; modo: "admin" | "consulta" | "cliente" }) {
  const [comoCliente, setComoCliente] = useState(false);
  const operar = modo === "admin" && !comoCliente;
  const equipe = modo !== "cliente" && !comoCliente;
  const admin = operar;
  const { data, isLoading, error } = useQuery({ queryKey: ["loc-edificio", edificioId ?? "zen", modo], queryFn: () => carregar(edificioId, true) });
  const [soDivergentes, setSoDivergentes] = useState(true);

  const d = useMemo(() => {
    if (!data) return null;
    const locNome = new Map<string, string>(data.locs.map((l: any) => [l.id, l.nome]));
    const contr = new Map<string, any>(data.contratos.map((c: any) => [c.id, c]));
    const ciclo = new Map<string, any>(data.ciclo.map((c: any) => [c.contrato_id, c]));
    const linhas = data.vig.map((v: any) => ({ ...v, contrato: contr.get(v.contrato_id), locatario: v.locatario ?? locNome.get(contr.get(v.contrato_id)?.locatario_id) ?? "—", ciclo: ciclo.get(v.contrato_id) }))
      .sort((a: any, b: any) => (a.unidades ?? "").localeCompare(b.unidades ?? "", "pt-BR", { numeric: true }));
    const porContrato = new Map<string, any>(linhas.map((l: any) => [l.contrato_id, l]));
    const ultimaData = data.pags.reduce((m: string, p: any) => (p.data_pagamento > m ? p.data_pagamento : m), "");
    const anoStr = String(data.ano);
    const ultimoMes = ultimaData.startsWith(anoStr) ? ultimaData.slice(0, 7) : `${anoStr}-00`;
    const meses = MESES.map((m, i) => {
      const key = `${anoStr}-${String(i + 1).padStart(2, "0")}`;
      const orcado = data.orcado.filter((o: any) => o.mes.startsWith(key)).reduce((s: number, o: any) => s + Number(o.valor ?? 0), 0);
      const realizado = data.pags.filter((p: any) => p.data_pagamento.startsWith(key)).reduce((s: number, p: any) => s + Number(p.valor_liquido ?? 0), 0);
      return { mes: m, key, i, orcado, realizado, fechado: key <= ultimoMes };
    });
    return { linhas, porContrato, meses, ultimaData, ultimoMes };
  }, [data]);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-72 w-full" /></div>;
  if (error) return <p className="text-sm text-destructive">Não foi possível carregar o edifício: {(error as Error).message}</p>;
  if (!data || !d) return <p className="text-sm text-muted-foreground">Edifício não encontrado.</p>;

  return (
    <div className="op-theme zen-portal space-y-6">
      <PageHeader
        title={data.edificio.nome}
        subtitle="Gestão de Locações"
        actions={<>
          {d.ultimaData && <div className="rounded-md border bg-card px-4 py-2 text-xs text-muted-foreground">Pagamentos importados até <span className="font-medium text-foreground tabular-nums">{dt(d.ultimaData)}</span></div>}
          {modo === "admin" && <Button variant="outline" size="sm" onClick={() => setComoCliente((v) => !v)}>{comoCliente ? "Voltar para Admin" : "Ver como Cliente"}</Button>}
        </>}
      />
      <Tabs key={comoCliente ? "cli" : "adm"} defaultValue="geral" className="space-y-4">
        <div className="overflow-x-auto"><TabsList>
          <TabsTrigger value="geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="caixa">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="planejamento">Planejamento do Caixa</TabsTrigger>
          <TabsTrigger value="prazo">Prazo de Recebimento</TabsTrigger>
<TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="renovacoes">Renovações</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="reajustes">Reajustes</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução do Aluguel</TabsTrigger>
          <TabsTrigger value="conferencia">Conferência</TabsTrigger>
          {admin && <TabsTrigger value="importar">Importar Pagamentos</TabsTrigger>}
        </TabsList></div>

        <TabsContent value="geral" className="space-y-4"><VisaoGeral data={data} d={d} /></TabsContent>

        <TabsContent value="caixa" className="space-y-4"><FluxoCaixa data={data} linhas={d.linhas} meses={d.meses} ultimoMes={d.ultimoMes} /></TabsContent>

        <TabsContent value="planejamento" className="space-y-4"><PlanejamentoCaixa data={data} admin={admin} /></TabsContent>

        <TabsContent value="prazo" className="space-y-4"><PrazoRecebimento data={data} /></TabsContent>

        <TabsContent value="contratos">
          <Bloco titulo="Contratos Vigentes" acao={<div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{d.linhas.length} contratos</span>{admin && <NovoContrato edificioId={data.edificio.id} locatarios={data.locs} unidades={data.ocup} />}</div>}>
            <div className={tableClasses.wrap}><table className={cn(tableClasses.table, "zen-wide")}><thead><tr className={tableClasses.head}>
              {["Unidade", "Locatário", "Matrícula", "Índice", "Valor vigente", "m² contrato", "m² matrícula", "Início", "Fim", "Ciclo", "R$/m²", ...(admin ? [""] : [])].map((h, i) => <th key={h} className={cn(tableClasses.th, ((i >= 4 && i <= 6) || i === 10) && "text-right")}>{h}</th>)}
            </tr></thead><tbody>{d.linhas.map((l: any) => {
              const c = CICLO[l.ciclo?.ciclo];
              return <tr key={l.contrato_id}>
                <td className={cn(tableClasses.td, "font-medium zen-un")}>{l.unidades ?? "—"}</td>
                <td className={cn(tableClasses.td, "zen-txt")}>{l.locatario}</td>
                <td className={cn(tableClasses.td, "zen-un")}>{l.matriculas ?? "—"}</td>
                <td className={cn(tableClasses.td, "zen-un")}>{indiceLabel(l.indice)}</td>
                <td className={tableClasses.num}>{brl(l.valor_vigente)}</td>
                <td className={tableClasses.num}>{num2(l.area_contrato_m2)}</td>
                <td className={tableClasses.num}>{num2(l.area_matricula_m2)}</td>
                <td className={cn(tableClasses.td, "tabular-nums")}>{dt(l.inicio)}</td>
                <td className={cn(tableClasses.td, "tabular-nums")}>{dt(l.fim)}</td>
                <td className={cn(tableClasses.td, "zen-txt")}>{c ? <span className={cn("op-tag", c.cls)}>{c.label}</span> : "—"}</td>
                <td className={tableClasses.num}>{l.rs_m2_matricula == null ? "—" : num2(l.rs_m2_matricula)}</td>
                {admin && <td className={tableClasses.td}><div className="flex flex-wrap justify-end gap-1"><EditarContrato linha={l} vigencias={data.vigencias} edificioId={data.edificio.id} /><EncerrarContrato contratoId={l.contrato_id} edificioId={data.edificio.id} unidade={l.unidades ?? ""} /></div></td>}
              </tr>;
            })}</tbody></table></div>
          </Bloco>
          {admin && <div className="mt-4"><ContratosEncerrados encerrados={data.encerrados ?? []} admin={admin} /></div>}
        </TabsContent>

<TabsContent value="renovacoes" className="space-y-4"><Renovacoes linhas={d.linhas} /></TabsContent>

        <TabsContent value="documentos" className="space-y-4"><Documentos data={data} admin={admin} /></TabsContent>

        <TabsContent value="reajustes"><Reajustes data={data} d={d} /></TabsContent>
        <TabsContent value="evolucao"><Evolucao data={data} d={d} /></TabsContent>
        {admin && <TabsContent value="importar"><ImportarPagamentos data={data} porContrato={d.porContrato} /></TabsContent>}

        <TabsContent value="conferencia" className="space-y-4">
          <Bloco titulo="Metragem: Contrato × Matrícula" acao={<label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={soDivergentes} onCheckedChange={setSoDivergentes} />Só divergentes</label>}>
            <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
              <th className={tableClasses.th}>Unidades</th><th className={tableClasses.th}>Matrículas</th><th className={cn(tableClasses.th, "text-right")}>m² contrato</th><th className={cn(tableClasses.th, "text-right")}>m² matrícula</th><th className={cn(tableClasses.th, "text-right")}>Diferença</th>
            </tr></thead><tbody>{data.metragem.filter((m: any) => !soDivergentes || (m.diferenca_m2 != null && Math.abs(m.diferenca_m2) > 1)).map((m: any) => <tr key={m.contrato_id}>
              <td className={cn(tableClasses.td, "font-medium zen-un")}>{m.unidades ?? "—"}</td>
              <td className={cn(tableClasses.td, "zen-un")}>{m.matriculas ?? "—"}</td>
              <td className={tableClasses.num}>{m2(m.area_contrato_m2)}</td>
              <td className={tableClasses.num}>{m2(m.area_matricula_m2)}</td>
              <td className={cn(tableClasses.num, m.diferenca_m2 != null && Math.abs(m.diferenca_m2) > 1 && "font-semibold text-destructive")}>{m2(m.diferenca_m2)}</td>
            </tr>)}</tbody></table></div>
          </Bloco>
        </TabsContent>

      </Tabs>
    </div>
  );
}

function Card({ label, children, className, dica }: { label: string; children: React.ReactNode; className?: string; dica?: string }) {
  return <div title={dica} className={cn("rounded-md border bg-card p-5", className)}>
    <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">{label}</div>
    <div className="mt-3">{children}</div>
  </div>;
}
const Valor = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn("text-[32px] font-extralight leading-none tabular-nums text-foreground", className)}>{children}</div>;

function VisaoGeral({ data, d }: { data: DadosZen; d: any }) {
  const total = data.ocup.length;
  const locadas = data.ocup.filter((u: any) => u.situacao === "locada").length;
  const m2Medio = (prefixo: string) => {
    const ls = d.linhas.filter((l: any) => (l.unidades ?? "").startsWith(prefixo) && Number(l.area_matricula_m2) > 0 && Number(l.valor_vigente) > 0);
    const a = ls.reduce((s: number, l: any) => s + Number(l.area_matricula_m2), 0);
    return a ? ls.reduce((s: number, l: any) => s + Number(l.valor_vigente), 0) / a : null;
  };
  const fechados = d.meses.filter((m: any) => m.fechado);
  const ultimo = fechados[fechados.length - 1];
  const acumR = fechados.reduce((s: number, m: any) => s + m.realizado, 0);
  const saldo = useSaldoEmAberto(data.edificio.id, data.ano, d.ultimaData, !!data.admin);
  const recebidoPor = (pred: (k: string) => boolean) => {
    let c = 0, a = 0;
    for (const p of data.pags) { const k = p.data_pagamento.slice(0, 7); if (!pred(k)) continue; const v = Number(p.valor_liquido ?? 0); if (p.contrato_id) c += v; else a += v; }
    return { c, a };
  };
  const reforecastPor = (pred: (k: string) => boolean) => (data.previsto ?? []).filter((x: any) => pred(String(x.mes).slice(0, 7))).reduce((s: number, x: any) => s + Number(x.valor ?? 0), 0);
  const noMes = (k: string) => !!ultimo && k === ultimo.key;
  const noPeriodo = (k: string) => k.startsWith(String(data.ano)) && k <= d.ultimoMes;
  const recMes = recebidoPor(noMes), recAcum = recebidoPor(noPeriodo);
  const refMes = reforecastPor(noMes), refAcum = reforecastPor(noPeriodo);
  const difAjustes = refAcum - recAcum.c - saldo.total;
  const hojeKey = String(data.hoje ?? new Date().toISOString()).slice(0, 7);
  const limiteKey = addMes(hojeKey, 4);
  const [la, lm] = limiteKey.split("-").map(Number);
const vencem = d.linhas.filter((l: any) => ["a_vencer_12m", "a_vencer_120d"].includes(l.ciclo?.ciclo)).length;
  const renov = useMemo(() => baseRenovacoes(d.linhas), [d.linhas]);

  // próximos reajustes (somente valor certo)
  const vigAtual = new Map<string, any>();
  for (const v of data.vigencias) { const c = vigAtual.get(v.contrato_id); if (!c || v.seq > c.seq) vigAtual.set(v.contrato_id, v); }
  const vigToContrato = new Map<string, string>(data.vigencias.map((v: any) => [v.id, v.contrato_id]));
  const proximos: { unidade: string; regra: string; boleto: string; valor: number; key: string }[] = [];
  for (const g of data.degraus) {
    const cid = vigToContrato.get(g.vigencia_id);
    if (!cid || reajusteRealizado(data.auditoria, cid, g.a_partir)) continue;
    const l = d.porContrato.get(cid);
    const k = g.a_partir.slice(0, 7);
    if (!l || vigAtual.get(cid)?.id !== g.vigencia_id || k <= hojeKey || k > limiteKey) continue;
    proximos.push({ unidade: l.unidades, regra: g.origem === "reajuste" && ["IPCA", "IGPM", "MEDIA"].includes(l.indice) ? indiceLabel(l.indice) : "Degrau", boleto: addMes(k, 1), valor: Number(g.valor_mensal), key: cid + k });
  }
  for (const a of data.reajustesCalc) {
    const l = d.porContrato.get(a.contrato_id);
    if (reajusteRealizado(data.auditoria, a.contrato_id, a.aniversario)) continue;
    if (!l || !a.calc || a.calc.estimado || a.calc.valor_calculado == null) continue;
    const k = (a.calc.vigencia_a_partir ?? a.aniversario).slice(0, 7);
    if (proximos.some((p) => p.key === a.contrato_id + k)) continue;
    proximos.push({ unidade: l.unidades, regra: indiceLabel(a.indice), boleto: addMes(k, 1), valor: Number(a.calc.valor_calculado), key: a.contrato_id + k });
  }
  proximos.sort((a, b) => a.boleto.localeCompare(b.boleto) || a.unidade.localeCompare(b.unidade, "pt-BR", { numeric: true }));
  const nReaj = new Set([...proximos.map((p) => p.key.slice(0, 36)), ...data.reajustesCalc.filter((a: any) => d.porContrato.has(a.contrato_id)).map((a: any) => a.contrato_id)]).size;
  const mesLabel = (k: string) => { const [y, m] = k.split("-").map(Number); return `${MESES[m - 1]}/${y}`; };

  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card label="Unidades Administradas" className="sm:col-span-2">
        <div className="grid grid-cols-4 gap-4">
          <div><Valor>{total}</Valor><div className="mt-2 text-xs text-muted-foreground">total</div></div>
          <div><Valor className="text-success">{locadas}</Valor><div className="mt-2 text-xs text-muted-foreground">locadas</div></div>
          <div><Valor className="text-warning">{total - locadas}</Valor><div className="mt-2 text-xs text-muted-foreground">vaga</div></div>
          <div><Valor>{total ? Math.round(locadas / total * 100) : 0}%</Valor><div className="mt-2 text-xs text-muted-foreground">ocupação</div></div>
        </div>
      </Card>
      <Card label="Valor Médio do m² — Salas"><Valor>{brl(m2Medio("Sala"))}</Valor></Card>
      <Card label="Valor Médio do m² — Lojas"><Valor>{brl(m2Medio("Loja"))}</Valor></Card>
      <Card label={`Recebido em ${ultimo ? MESES_LONGOS[ultimo.i].charAt(0).toUpperCase() + MESES_LONGOS[ultimo.i].slice(1) : "—"}`} dica={`Contratos ${brl(recMes.c)} · Receitas Avulsas ${brl(recMes.a)} · Reforecast do mês ${brl(refMes)}`}>
        <Valor>{brl(ultimo?.realizado ?? 0)}</Valor>
      </Card>
      <Card label={`Acumulado Jan–${ultimo ? MESES[ultimo.i].charAt(0).toUpperCase() + MESES[ultimo.i].slice(1) : "—"}`} dica={`Contratos ${brl(recAcum.c)} · Receitas Avulsas ${brl(recAcum.a)} · Reforecast do período ${brl(refAcum)}`}>
        <Valor>{brl(acumR)}</Valor>
      </Card>
      <Card label={data.admin ? "Total em Aberto" : "Em Aberto"} dica={data.admin ? `Ativos ${brl(saldo.ativos)} · Não Ativos ${brl(saldo.naoAtivos)}\nDiferença: ajustes de meses anteriores ${brl(difAjustes)}` : undefined}>
        <Valor className={saldo.total > 0 ? "text-destructive" : undefined}>{saldo.isLoading ? "—" : brl(data.admin ? saldo.total : saldo.ativos)}</Valor>
      </Card>
      {data.admin && saldo.condominio > 0.004 && <Card label="Condomínio em Aberto"><Valor>{brl(saldo.condominio)}</Valor></Card>}
      <Card label={`Reajustes até ${MESES[lm - 1]}/${la}`} dica={`${nReaj} contratos`}><Valor>{nReaj}</Valor></Card>
<Card label="Vencimentos em 12 Meses" dica={`Até 120 Dias: ${renov.vencem120.n} · De 121 Dias a 12 Meses: ${renov.vencem12m.n}`}><Valor>{vencem}</Valor></Card>
    </div>
    <BlocoCicloVencimento base={renov} />
    <BlocoIndiceReajuste base={renov} />
    <Bloco titulo="Próximos Reajustes">
      {proximos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum reajuste com valor definido nos próximos meses.</p> :
        <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
          <th className={tableClasses.th}>Unidade</th><th className={tableClasses.th}>Regra</th><th className={tableClasses.th}>Boleto</th><th className={cn(tableClasses.th, "text-right")}>Novo valor</th>
        </tr></thead><tbody>{proximos.map((p) => <tr key={p.key}>
          <td className={cn(tableClasses.td, "font-medium")}>{p.unidade}</td>
          <td className={tableClasses.td}>{p.regra}</td>
          <td className={tableClasses.td}>{mesLabel(p.boleto)}</td>
          <td className={tableClasses.num}>{brl(p.valor)}</td>
        </tr>)}</tbody></table></div>}
    </Bloco>
  </>;
}

function Reajustes({ data, d }: { data: DadosZen; d: any }) {
  const resultado = (a: any) => {
    const p = String(a.parecer ?? "").toLowerCase();
    if (p === "pendente") return { label: "Pendente", cls: "op-tag-amber" };
    if (p === "divergente") return { label: "Divergente", cls: "op-tag-amber" };
    return { label: "Atualizado", cls: "op-tag-green" };
  };
  const linhas = [...data.auditoria].sort((a: any, b: any) => (b.aniversario ?? "").localeCompare(a.aniversario ?? ""));
  const fonte = (i: string) => data.indices.find((x: any) => x.indice === i);
  return <Bloco titulo="Conferência de Reajustes">
    <p className="mb-4 text-[13px] text-muted-foreground">Reajuste do aniversário do contrato: atualizado, divergente ou pendente.</p>
    {linhas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum reajuste a verificar.</p> :
      <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Unidade", "Índice", "Referência", "Base", "Pelo Índice", "Aplicado", "Situação"].map((h, i) => <th key={h} className={cn(tableClasses.th, i >= 3 && i <= 5 && "text-right")}>{h}</th>)}
      </tr></thead><tbody>{linhas.map((a: any, i: number) => {
        const p = resultado(a);
        return <tr key={i}>
          <td className={cn(tableClasses.td, "font-medium")}>{d.porContrato.get(a.contrato_id)?.unidades ?? "—"}</td>
          <td className={tableClasses.td}>{indiceLabel(a.indice)}</td>
          <td className={cn(tableClasses.td, "tabular-nums")}>{dt(a.mes_referencia)}</td>
          <td className={tableClasses.num}>{brl(a.valor_anterior)}</td>
          <td className={tableClasses.num}>{brl(a.valor_calculado)}</td>
          <td className={tableClasses.num}>{brl(a.valor_aplicado)}</td>
          <td className={tableClasses.td}><span className={cn("op-tag", p.cls)}>{p.label}</span></td>
        </tr>;
      })}</tbody></table></div>}
    <p className="mt-3 text-xs text-muted-foreground">Índices: IPCA ({fonte("IPCA")?.fonte ?? "IBGE"}, até {dt(fonte("IPCA")?.mes)}) · IGP-M ({fonte("IGPM")?.fonte ?? "FGV"}, até {dt(fonte("IGPM")?.mes)}).</p>
  </Bloco>;
}

function Evolucao({ data, d }: { data: DadosZen; d: any }) {
  const linhas = data.evolucao.map((e: any) => ({ ...e, l: d.porContrato.get(e.contrato_id) })).filter((e: any) => e.l)
    .sort((a: any, b: any) => (a.l.unidades ?? "").localeCompare(b.l.unidades ?? "", "pt-BR", { numeric: true }));
  const ehLoja = (e: any) => String(e.unidades ?? e.l.unidades ?? "").trim().startsWith("Loja");
  const grupos = [
    { titulo: "Salas", sing: "sala", plur: "salas", itens: linhas.filter((e: any) => !ehLoja(e)) },
    { titulo: "Lojas", sing: "loja", plur: "lojas", itens: linhas.filter(ehLoja) },
  ];
  const STATUS: Record<string, string> = { vigente: "Vigente", vencido: "Vencido", encerrado: "Encerrado", "vence em até 180 dias": "Vence em até 180 dias" };
  const cab = ["Unidade", "Locatário", "Início do contrato inicial", "Início do aditivo", "Fim da vigência atual", "Aluguel inicial", "Aluguel atual", "Variação %", "Possui aditivo?", "Situação"];
  return <div className="space-y-4">
    {grupos.map((g) => {
      const comArea = g.itens.filter((e: any) => Number(e.l.area_matricula_m2) > 0 && Number(e.aluguel_inicial) > 0 && Number(e.aluguel_atual) > 0);
      const area = comArea.reduce((s: number, e: any) => s + Number(e.l.area_matricula_m2), 0);
      const ini = area ? comArea.reduce((s: number, e: any) => s + Number(e.aluguel_inicial), 0) / area : null;
      const atu = area ? comArea.reduce((s: number, e: any) => s + Number(e.aluguel_atual), 0) / area : null;
      return <div key={g.titulo}>
        <div className="mb-2 text-[15px] font-medium">{g.titulo}</div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card label="R$/m² Inicial"><Valor>{brl(ini)}</Valor></Card>
          <Card label="R$/m² Atual"><Valor>{brl(atu)}</Valor></Card>
          <Card label="Variação do R$/m²"><Valor>{ini && atu ? pct((atu / ini - 1) * 100) : "—"}</Valor><div className="mt-2 text-xs text-muted-foreground">{comArea.length} {comArea.length === 1 ? g.sing : g.plur} com área ({m2(area)})</div></Card>
        </div>
      </div>;
    })}
    {grupos.map((g) => {
      const tIni = g.itens.reduce((s: number, e: any) => s + Number(e.aluguel_inicial || 0), 0);
      const tAtu = g.itens.reduce((s: number, e: any) => s + Number(e.aluguel_atual || 0), 0);
      const tVar = tIni ? (tAtu / tIni - 1) * 100 : null;
      return <Bloco key={g.titulo} titulo={`Evolução do Aluguel · ${g.titulo}`}>
        <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
          {cab.map((h, i) => <th key={h} className={cn(tableClasses.th, [5, 6, 7].includes(i) && "text-right")}>{h}</th>)}
        </tr></thead><tbody>{g.itens.map((e: any) => <tr key={e.contrato_id}>
          <td className={cn(tableClasses.td, "font-medium zen-un")}>{e.unidades ?? e.l.unidades}</td>
          <td className={cn(tableClasses.td, "zen-txt")}>{e.locatario ?? e.l.locatario}</td>
          <td className={cn(tableClasses.td, "tabular-nums")}>{dt(e.inicio_inicial)}</td>
          <td className={cn(tableClasses.td, "tabular-nums")}>{dt(e.inicio_aditivo)}</td>
          <td className={cn(tableClasses.td, "tabular-nums")}>{dt(e.fim_vigente)}</td>
          <td className={tableClasses.num}>{brl(e.aluguel_inicial)}</td>
          <td className={tableClasses.num}>{brl(e.aluguel_atual)}</td>
          <td className={cn(tableClasses.num, Number(e.variacao_pct) < 0 && "text-destructive")}>{pct(e.variacao_pct)}</td>
          <td className={tableClasses.td}>{e.tem_aditivo ? "Sim" : "Não"}</td>
          <td className={cn(tableClasses.td, "zen-txt")}>{STATUS[e.status] ?? e.status ?? "—"}</td>
        </tr>)}
          <tr className="font-medium">
            <td className={tableClasses.td} colSpan={5}>Total</td>
            <td className={tableClasses.num}>{brl(tIni)}</td>
            <td className={tableClasses.num}>{brl(tAtu)}</td>
            <td className={cn(tableClasses.num, tVar != null && tVar < 0 && "text-destructive")}>{tVar == null ? "—" : pct(tVar)}</td>
            <td className={tableClasses.td} colSpan={2}></td>
          </tr>
        </tbody></table></div>
      </Bloco>;
    })}
  </div>;
}
