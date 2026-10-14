import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Bloco, chartTooltipStyle, CORES } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MESES, MESES_LONGOS, brl, dt, mil, num2 } from "@/lib/locacoes";

const db = supabase as any;
const n = (v: any) => Number(v ?? 0);
const mesExtenso = (s: string) => { const m = MESES_LONGOS[Number(s.slice(5, 7)) - 1]; return m.charAt(0).toUpperCase() + m.slice(1); };
const valOuTraco = (v: number) => (Math.abs(v) > 0.004 ? brl(v) : "—");

function Quadro({ label, valor, destaque, legenda }: { label: string; valor: string; destaque?: boolean; legenda?: string }) {
  return <div className={cn("rounded-sm border bg-card p-4", destaque && "reforecast-abaixo border-current")}>
    <div className={cn("text-[12px]", destaque ? "font-medium" : "text-muted-foreground")}>{label}</div>
    <div className={cn("mt-1 font-light tabular-nums", destaque ? "text-[28px] font-normal" : "text-[22px]")}>{valor}</div>
    {legenda && <div className="mt-1 text-[11px] tabular-nums">{legenda}</div>}
  </div>;
}

export function RealizadoEmAberto({ ano, edificioId, admin, ultimaData }: { ano: number; edificioId: string; admin: boolean; ultimaData: string }) {
  const [aba, setAba] = useState<"acum" | "mensal">("acum");
  const q = useQuery({
    queryKey: ["loc-recebimentos", edificioId, ano],
    queryFn: async () => {
      const [cx, ea, enc] = await Promise.all([
        db.rpc("loc_caixa_mensal", { p_edificio: edificioId, p_ano: ano }),
        db.rpc("loc_em_aberto", { p_edificio: edificioId, p_ano: ano }),
        admin ? db.from("loc_v_encerrados").select("contrato_id,unidades,locatario,data_saida,alugueis_em_aberto").eq("edificio_id", edificioId) : Promise.resolve({ data: [], error: null }),
      ]);
      for (const r of [cx, ea, enc]) if (r.error) throw r.error;
      return { caixa: (cx.data ?? []) as any[], emAberto: (ea.data ?? []) as any[], encerrados: (enc.data ?? []) as any[] };
    },
  });

  const limite = ultimaData.slice(0, 7);
  const caixa = (q.data?.caixa ?? []).filter((m) => !limite || m.mes.slice(0, 7) <= limite).sort((a, b) => a.mes.localeCompare(b.mes));
  const encerrados = admin ? (q.data?.encerrados ?? []).filter((e) => n(e.alugueis_em_aberto) > 0.004) : [];
  const abertoEncerrados = encerrados.reduce((s, e) => s + n(e.alugueis_em_aberto), 0);
  const contratos = [
    ...(q.data?.emAberto ?? []).filter((e) => !e.encerrado).map((e) => ({ ...e, ativo: true })),
    ...encerrados.map((e) => ({ contrato_id: e.contrato_id, unidades: e.unidades, locatario: e.locatario, saldo: e.alugueis_em_aberto, competencias: `Encerrado em ${dt(e.data_saida)}`, ativo: false })),
  ].sort((a, b) => n(b.saldo) - n(a.saldo));
  const previsto = caixa.reduce((s, m) => s + n(m.previsto_contratual), 0);
  const recebido = caixa.reduce((s, m) => s + n(m.recebido_da_competencia), 0);
  const aberto = caixa.reduce((s, m) => s + n(m.em_aberto), 0);
  const abertoTotal = aberto + abertoEncerrados;
  let acum = 0;
  const mensal = caixa.map((m) => { acum += n(m.em_aberto); return { ...m, acum, label: MESES[Number(m.mes.slice(5, 7)) - 1] }; });

  return <Bloco titulo="Recebimentos e Saldo em Aberto" acao={<div className="flex gap-2">
    {([["acum", "Acumulado"], ["mensal", "Mensal"]] as const).map(([v, l]) => <Button key={v} size="sm" variant={aba === v ? "default" : "outline"} aria-pressed={aba === v} onClick={() => setAba(v)}>{l}</Button>)}
  </div>}>
    {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : q.error ? <p className="text-sm text-destructive">Não foi possível carregar os valores.</p>
    : aba === "acum" ? <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Quadro label="Previsto" valor={brl(previsto)} />
        <Quadro label="Recebido" valor={brl(recebido)} />
        <Quadro label="Em Aberto" valor={valOuTraco(abertoTotal)} destaque legenda={admin && abertoEncerrados > 0.004 ? `Inclui contratos encerrados: ${brl(abertoEncerrados)}` : undefined} />
        <Quadro label="Inadimplência" valor={previsto ? `${num2(abertoTotal / previsto * 100)}%` : "—"} />
      </div>
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
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={mensal} margin={{ top: 20 }}>
          <CartesianGrid vertical={false} stroke={CORES.borda} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: CORES.texto }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: CORES.texto }} axisLine={false} tickLine={false} tickFormatter={(v) => mil(v)} width={44} />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => brl(v)} cursor={{ fill: "hsl(var(--muted))" }} />
          <Bar dataKey="em_aberto" name="Em Aberto" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]}>
            <LabelList dataKey="em_aberto" position="top" formatter={(v: number) => (v > 0.004 ? mil(v) : "")} style={{ fontSize: 10, fill: CORES.texto }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Mês", "Previsto", "Recebido", "Em Aberto", "Em Aberto Acumulado"].map((h, i) => <th key={h} className={cn(tableClasses.th, i > 0 && "text-right")}>{h}</th>)}
      </tr></thead><tbody>
        {mensal.map((m) => { const sem = n(m.em_aberto) <= 0.004; return <tr key={m.mes} className={cn(sem && "text-muted-foreground")}>
          <td className={tableClasses.td}>{mesExtenso(m.mes)}</td>
          <td className={tableClasses.num}>{brl(n(m.previsto_contratual))}</td>
          <td className={tableClasses.num}>{valOuTraco(n(m.recebido_da_competencia))}</td>
          <td className={cn(tableClasses.num, !sem && "font-bold text-destructive")}>{valOuTraco(n(m.em_aberto))}</td>
          <td className={cn(tableClasses.num, m.acum > 0.004 && !sem && "font-bold text-destructive")}>{valOuTraco(m.acum)}</td>
        </tr>; })}
        <tr className="font-bold"><td className={tableClasses.td}>Total</td><td className={tableClasses.num}>{brl(previsto)}</td><td className={tableClasses.num}>{brl(recebido)}</td><td className={cn(tableClasses.num, "text-destructive")}>{valOuTraco(aberto)}</td><td className={tableClasses.num} /></tr>
      </tbody></table></div>
    </div>}
  </Bloco>;
}
