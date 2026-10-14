import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Bloco, chartTooltipStyle, CORES } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MESES, MESES_LONGOS, brl, dt, mil, num2 } from "@/lib/locacoes";
import { useSaldoEmAberto } from "@/hooks/useSaldoEmAberto";

const db = supabase as any;
const n = (v: any) => Number(v ?? 0);
const mesExtenso = (s: string) => { const m = MESES_LONGOS[Number(s.slice(5, 7)) - 1]; return m.charAt(0).toUpperCase() + m.slice(1); };
const valOuTraco = (v: number) => (Math.abs(v) > 0.004 ? brl(v) : "—");

function Quadro({ label, valor, tom, forte, children }: { label: string; valor?: string; tom?: "vermelho" | "cinza"; forte?: boolean; children?: React.ReactNode }) {
  return <div className={cn("rounded-sm border bg-card p-4", tom === "vermelho" && "reforecast-abaixo border-current", tom === "cinza" && "bg-muted")}>
    <div className={cn("text-[12px]", tom ? "font-medium" : "text-muted-foreground")}>{label}</div>
    {valor && <div className={cn("mt-1 tabular-nums text-[22px]", forte ? "font-bold" : "font-light")}>{valor}</div>}
    {children}
  </div>;
}

function PorCliente({ linhas, limite }: { linhas: any[]; limite: string }) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const rows = linhas.filter((r) => n(r.em_aberto) > 0.004 && (!limite || r.mes.slice(0, 7) <= limite));
  const meses = [...new Set(rows.map((r) => r.mes.slice(0, 7)))].sort();
  const grupos = new Map<string, { nome: string; total: number; meses: Map<string, number>; contratos: Map<string, { unidades: string; total: number; meses: Map<string, number> }> }>();
  for (const r of rows) {
    const nome = r.locatario ?? "—"; const m = r.mes.slice(0, 7); const v = n(r.em_aberto);
    const g = grupos.get(nome) ?? { nome, total: 0, meses: new Map(), contratos: new Map() };
    g.total += v; g.meses.set(m, (g.meses.get(m) ?? 0) + v);
    const c = g.contratos.get(r.contrato_id) ?? { unidades: r.unidades ?? "—", total: 0, meses: new Map() };
    c.total += v; c.meses.set(m, (c.meses.get(m) ?? 0) + v); g.contratos.set(r.contrato_id, c);
    grupos.set(nome, g);
  }
  const lista = [...grupos.values()].sort((a, b) => b.total - a.total);
  const totMes = (m: string) => rows.filter((r) => r.mes.slice(0, 7) === m).reduce((s, r) => s + n(r.em_aberto), 0);
  const total = rows.reduce((s, r) => s + n(r.em_aberto), 0);
  const ordUn = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true });
  return <section>
    <h4 className="mb-3 text-[15px] font-medium">Em Aberto por Cliente</h4>
    <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
      <th className={tableClasses.th}>Locatário</th>
      {meses.map((m) => <th key={m} className={cn(tableClasses.th, "text-right")}>{mesExtenso(m + "-01")}</th>)}
      <th className={cn(tableClasses.th, "text-right")}>Total</th>
    </tr></thead><tbody>
      {lista.length === 0 && <tr><td colSpan={meses.length + 2} className={cn(tableClasses.td, "text-muted-foreground")}>Nenhum valor em aberto.</td></tr>}
      {lista.map((g) => { const aberto = abertos.has(g.nome); const cs = [...g.contratos.values()].sort((a, b) => ordUn(a.unidades, b.unidades)); return [
        <tr key={g.nome}>
          <td className={tableClasses.td}>
            <button type="button" className="text-left font-medium hover:underline" aria-expanded={aberto}
              onClick={() => setAbertos((s) => { const x = new Set(s); x.has(g.nome) ? x.delete(g.nome) : x.add(g.nome); return x; })}>{aberto ? "▾" : "▸"} {g.nome}</button>
            <div className="text-[11px] text-muted-foreground">{cs.map((c) => c.unidades).join(" · ")}</div>
          </td>
          {meses.map((m) => <td key={m} className={cn(tableClasses.num, (g.meses.get(m) ?? 0) > 0.004 && "text-destructive")}>{valOuTraco(g.meses.get(m) ?? 0)}</td>)}
          <td className={cn(tableClasses.num, "font-bold text-destructive")}>{brl(g.total)}</td>
        </tr>,
        ...(aberto ? cs.map((c, i) => <tr key={g.nome + i} className="text-[12px] text-muted-foreground">
          <td className={cn(tableClasses.td, "pl-6 zen-un")}>{c.unidades}</td>
          {meses.map((m) => <td key={m} className={tableClasses.num}>{valOuTraco(c.meses.get(m) ?? 0)}</td>)}
          <td className={tableClasses.num}>{brl(c.total)}</td>
        </tr>) : []),
      ]; })}
      <tr className="font-bold"><td className={tableClasses.td}>Total Contratos Ativos</td>
        {meses.map((m) => <td key={m} className={cn(tableClasses.num, "text-destructive")}>{valOuTraco(totMes(m))}</td>)}
        <td className={cn(tableClasses.num, "text-destructive")}>{valOuTraco(total)}</td></tr>
    </tbody></table></div>
  </section>;
}

export function RealizadoEmAberto({ ano, edificioId, admin, ultimaData }: { ano: number; edificioId: string; admin: boolean; ultimaData: string }) {
  const [aba, setAba] = useState<"contrato" | "mes">("contrato");
  const q = useQuery({
    queryKey: ["loc-recebimentos", edificioId, ano],
    queryFn: async () => {
      const [cx, ea, enc, em, pc] = await Promise.all([
        db.rpc("loc_caixa_mensal", { p_edificio: edificioId, p_ano: ano }),
        db.rpc("loc_em_aberto", { p_edificio: edificioId, p_ano: ano }),
        admin ? db.from("loc_v_encerrados").select("contrato_id,unidades,locatario,data_saida,alugueis_em_aberto").eq("edificio_id", edificioId) : Promise.resolve({ data: [], error: null }),
        db.rpc("loc_em_aberto_mensal", { p_edificio: edificioId, p_ano: ano }),
        db.rpc("loc_em_aberto_mensal_contrato", { p_edificio: edificioId, p_ano: ano }),
      ]);
      for (const r of [cx, ea, enc, em, pc]) if (r.error) throw r.error;
      return { caixa: (cx.data ?? []) as any[], emAberto: (ea.data ?? []) as any[], encerrados: (enc.data ?? []) as any[], mensal: (em.data ?? []) as any[], porContrato: (pc.data ?? []) as any[] };
    },
  });

  const saldo = useSaldoEmAberto(edificioId, ano, ultimaData, admin);
  const limite = ultimaData.slice(0, 7);
  const caixa = saldo.caixa;
  const encerrados = saldo.encerradosComSaldo;
  const abertoEncerrados = saldo.naoAtivos;
  const contratos = [
    ...saldo.emAbertoAtivos.map((e) => ({ ...e, ativo: true })),
    ...encerrados.map((e) => ({ contrato_id: e.contrato_id, unidades: e.unidades, locatario: e.locatario, saldo: e.alugueis_em_aberto, competencias: `Encerrado em ${dt(e.data_saida)}`, ativo: false })),
  ].sort((a, b) => n(b.saldo) - n(a.saldo));
  const previsto = saldo.previstoAtivos;
  const recebido = caixa.reduce((s, m) => s + n(m.recebido_da_competencia), 0);
  const aberto = saldo.ativos;
  const abertoTotal = saldo.total;
  const porMes = new Map((q.data?.mensal ?? []).map((m) => [m.mes.slice(0, 7), m]));
  const mensal = caixa.map((m) => { const e: any = porMes.get(m.mes.slice(0, 7)) ?? {}; return { ...m, novo: n(e.em_aberto), acum: n(e.em_aberto_acumulado), label: MESES[Number(m.mes.slice(5, 7)) - 1] }; });
  const nomes = new Map((q.data?.emAberto ?? []).map((e) => [e.contrato_id, e.locatario]));
  const totalNovo = mensal.reduce((s, m) => s + m.novo, 0);
  const ultimoAcum = mensal.length ? mensal[mensal.length - 1].acum : 0;

  return <Bloco titulo="Recebimentos e Saldo em Aberto" acao={<div className="flex gap-2">
    {([["contrato", "Por Contrato"], ["mes", "Por Mês"]] as const).map(([v, l]) => <Button key={v} size="sm" variant={aba === v ? "default" : "outline"} aria-pressed={aba === v} onClick={() => setAba(v)}>{l}</Button>)}
  </div>}>
    {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : q.error ? <p className="text-sm text-destructive">Não foi possível carregar os valores.</p>
    : <div className="space-y-6">
      <div className={cn("grid grid-cols-2 gap-4", admin ? "lg:grid-cols-4" : "lg:grid-cols-2")}>
        <Quadro label={admin ? "Em Aberto Ativos" : "Em Aberto"} valor={valOuTraco(aberto)} tom="vermelho" />
        {admin && <Quadro label="Em Aberto Não Ativos" valor={valOuTraco(abertoEncerrados)} tom="cinza" />}
        {admin && <Quadro label="Total em Aberto" valor={valOuTraco(abertoTotal)} forte />}
        <Quadro label="Inadimplência">
          <div className="mt-1 space-y-0.5 text-[13px] tabular-nums">
            <div className="flex justify-between gap-2"><span>Contratos Ativos</span><span className="text-[18px] font-light">{previsto ? `${num2(aberto / previsto * 100)}%` : "—"}</span></div>
            {admin && <div className="flex justify-between gap-2"><span>Total</span><span className="text-[18px] font-light">{previsto ? `${num2(abertoTotal / previsto * 100)}%` : "—"}</span></div>}
          </div>
        </Quadro>
      </div>
    {aba === "contrato" ? <div className="space-y-6">
      <section>
        <h4 className="mb-3 text-[15px] font-medium">Em Aberto por Contrato</h4>
        <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
          {(admin ? ["Unidade", "Locatário", "Status", "Previsto", "Recebido", "Em Aberto", "Competências"] : ["Unidade", "Locatário", "Previsto", "Recebido", "Em Aberto", "Competências"]).map((h, i, a) => <th key={h} className={cn(tableClasses.th, i >= a.length - 4 && i <= a.length - 2 && "text-right")}>{h}</th>)}
        </tr></thead><tbody>
          {contratos.length === 0 && <tr><td colSpan={admin ? 7 : 6} className={cn(tableClasses.td, "text-muted-foreground")}>Nenhum valor em aberto.</td></tr>}
          {contratos.map((e) => <tr key={e.contrato_id}>
            <td className={cn(tableClasses.td, "font-medium zen-un")}>{e.unidades ?? "—"}</td>
            <td className={cn(tableClasses.td, "zen-txt")}>{e.locatario ?? "—"}</td>
            {admin && <td className={tableClasses.td}><span className={cn("op-tag", e.ativo ? "op-tag-green" : "op-tag-gray")}>{e.ativo ? "Ativo" : "Não Ativo"}</span></td>}
            <td className={tableClasses.num}>{e.ativo ? brl(n(e.previsto)) : "—"}</td>
            <td className={tableClasses.num}>{e.ativo ? valOuTraco(n(e.recebido)) : "—"}</td>
            <td className={cn(tableClasses.num, "font-bold text-destructive")}>{brl(n(e.saldo))}</td>
            <td className={cn(tableClasses.td, "zen-txt tabular-nums")}>{e.competencias ?? "—"}</td>
          </tr>)}
        </tbody></table></div>
      </section>
    </div>
    : <div className="space-y-6">
      <p className="text-[13px] text-muted-foreground">Contratos ativos. Mostra o que continua em aberto hoje em cada mês.{admin && abertoEncerrados > 0.004 ? ` O saldo dos contratos não ativos (${brl(abertoEncerrados)}) está em Por Contrato.` : ""}</p>
      <div className="text-[11px] text-muted-foreground">Contratos Ativos</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={mensal} margin={{ top: 20 }}>
          <CartesianGrid vertical={false} stroke={CORES.borda} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: CORES.texto }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: CORES.texto }} axisLine={false} tickLine={false} tickFormatter={(v) => mil(v)} width={44} />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => brl(v)} cursor={{ fill: "hsl(var(--muted))" }} />
          <Bar dataKey="acum" name="Contratos ativos" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]}>
            <LabelList dataKey="acum" position="top" formatter={(v: number) => (v > 0.004 ? mil(v) : "")} style={{ fontSize: 10, fill: CORES.texto }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
      <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Mês", "Previsto", "Recebido", "Em Aberto", "Em Aberto Acumulado"].map((h, i) => <th key={h} className={cn(tableClasses.th, i > 0 && "text-right")}>{h}</th>)}
      </tr></thead><tbody>
        {mensal.map((m) => { const sem = m.novo <= 0.004 && m.acum <= 0.004; return <tr key={m.mes} className={cn(sem && "text-muted-foreground")}>
          <td className={tableClasses.td}>{mesExtenso(m.mes)}</td>
          <td className={tableClasses.num}>{brl(n(m.previsto_contratual))}</td>
          <td className={tableClasses.num}>{valOuTraco(n(m.recebido_da_competencia))}</td>
          <td className={cn(tableClasses.num, m.novo > 0.004 && "font-bold text-destructive")}>{valOuTraco(m.novo)}</td>
          <td className={cn(tableClasses.num, m.acum > 0.004 && "font-bold text-destructive")}>{valOuTraco(m.acum)}</td>
        </tr>; })}
        <tr className="font-bold"><td className={tableClasses.td}>Total Contratos Ativos</td><td className={tableClasses.num}>{brl(previsto)}</td><td className={tableClasses.num}>{brl(recebido)}</td><td className={cn(tableClasses.num, "text-destructive")}>{valOuTraco(totalNovo)}</td><td className={cn(tableClasses.num, "text-destructive")}>{valOuTraco(ultimoAcum)}</td></tr>
      </tbody></table></div>
      <PorCliente linhas={(q.data?.porContrato ?? []).map((r) => ({ ...r, locatario: r.locatario ?? nomes.get(r.contrato_id) }))} limite={limite} />
      </div>
    </div>}
    </div>}
  </Bloco>;
}
