import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart } from "recharts";
import { Bloco, CORES, LegendaTexto, chartTooltipStyle, tableClasses } from "@/components/operacional/Shared";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MESES, addMes, brl, dt, m2, mil, num2, pct, projetarContrato } from "@/lib/locacoes";

type Mes = { mes: string; key: string; i: number; orcado: number; realizado: number; fechado: boolean };

const HATCH = "zen-hatch";

export function FluxoCaixa({ data, linhas, meses, ultimoMes }: { data: any; linhas: any[]; meses: Mes[]; ultimoMes: string }) {
  const ano = data.ano;
  const chart = meses.map((m) => ({ mes: m.mes, orcado: m.orcado, realizado: m.fechado ? m.realizado : null, projetado: m.fechado ? null : m.orcado }));
  const tot = meses.reduce((a, m) => ({ o: a.o + m.orcado, r: a.r + (m.fechado ? m.realizado : 0) }), { o: 0, r: 0 });

  return <>
    <Bloco titulo={`Orçado × realizado em caixa, ${ano} (R$ mil)`}>
      <LegendaTexto itens={[{ cor: CORES.primaria, label: "Realizado" }, { cor: CORES.secundaria, label: "Projetado" }, { cor: CORES.ouro, label: "Orçado dos contratos" }]} />
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chart} margin={{ top: 20 }}>
          <defs>
            <pattern id={HATCH} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill={CORES.secundaria} />
              <rect width="3" height="7" fill="hsl(var(--card))" fillOpacity={0.55} />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} stroke={CORES.borda} />
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: CORES.texto }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: CORES.texto }} axisLine={false} tickLine={false} tickFormatter={(v) => mil(v)} width={44} />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => brl(v)} cursor={{ fill: "hsl(var(--muted))" }} />
          <Bar dataKey="realizado" name="Realizado" stackId="c" fill={CORES.primaria} radius={[2, 2, 0, 0]}>
            <LabelList dataKey="realizado" position="top" formatter={(v: number) => (v ? mil(v) : "")} style={{ fontSize: 10, fill: CORES.texto }} />
          </Bar>
          <Bar dataKey="projetado" name="Projetado" stackId="c" fill={`url(#${HATCH})`} radius={[2, 2, 0, 0]}>
            <LabelList dataKey="projetado" position="top" formatter={(v: number) => (v ? mil(v) : "")} style={{ fontSize: 10, fill: CORES.texto }} />
          </Bar>
          <Line dataKey="orcado" name="Orçado dos contratos" stroke={CORES.ouro} strokeWidth={2} dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </Bloco>

    <Bloco titulo="Por mês">
      <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        <th className={tableClasses.th}>Mês</th><th className={cn(tableClasses.th, "text-right")}>Orçado (R$)</th><th className={cn(tableClasses.th, "text-right")}>Realizado (R$)</th><th className={cn(tableClasses.th, "text-right")}>Diferença (R$)</th><th className={tableClasses.th}>Situação</th>
      </tr></thead><tbody>{meses.map((m) => {
        const dif = m.realizado - m.orcado;
        const sit = !m.fechado ? ["A receber", "op-tag-gray"] : dif < -1 ? ["Abaixo do orçado", "op-tag-red"] : ["Dentro", "op-tag-green"];
        return <tr key={m.key}>
          <td className={tableClasses.td}>{m.mes}/{ano}</td>
          <td className={tableClasses.num}>{num2(m.orcado)}</td>
          <td className={tableClasses.num}>{m.fechado ? num2(m.realizado) : "—"}</td>
          <td className={cn(tableClasses.num, m.fechado && dif < 0 && "text-destructive")}>{m.fechado ? num2(dif) : "—"}</td>
          <td className={tableClasses.td}><span className={cn("op-tag", sit[1])}>{sit[0]}</span></td>
        </tr>;
      })}</tbody></table></div>
    </Bloco>

    <Bloco titulo="Orçado × realizado, visão global (R$)">
      <div className={tableClasses.wrap}><table className={cn(tableClasses.table, "min-w-[1300px]")}><thead><tr className={tableClasses.head}>
        <th className={tableClasses.th}></th>{MESES.map((m) => <th key={m} className={cn(tableClasses.th, "text-right capitalize")}>{m}</th>)}<th className={cn(tableClasses.th, "text-right")}>Total</th>
      </tr></thead><tbody>
        {([["Orçado", (m: Mes) => m.orcado, tot.o], ["Realizado", (m: Mes) => (m.fechado ? m.realizado : null), tot.r], ["Diferença", (m: Mes) => (m.fechado ? m.realizado - m.orcado : null), tot.r - meses.filter((m) => m.fechado).reduce((s, m) => s + m.orcado, 0)]] as const).map(([rot, f, t]) =>
          <tr key={rot}><td className={cn(tableClasses.td, "font-medium")}>{rot}</td>
            {meses.map((m) => { const v = f(m); return <td key={m.key} className={cn(tableClasses.num, rot === "Diferença" && v != null && v < 0 && "text-destructive")}>{v == null ? "—" : num2(v)}</td>; })}
            <td className={cn(tableClasses.num, "font-medium", rot === "Diferença" && t < 0 && "text-destructive")}>{num2(t)}</td></tr>)}
      </tbody></table></div>
    </Bloco>

    <DetalheUnidade data={data} linhas={linhas} ultimoMes={ultimoMes} />
    <Projecao data={data} linhas={linhas} />
  </>;
}

const PERIODOS: { v: string; label: string; meses: (u: number) => number[] }[] = [
  { v: "ytd", label: "Year to Date", meses: (u) => Array.from({ length: Math.max(u, 0) }, (_, i) => i + 1) },
  ...MESES.map((m, i) => ({ v: `m${i + 1}`, label: m.charAt(0).toUpperCase() + m.slice(1), meses: () => [i + 1] })),
  ...[1, 2, 3, 4].map((q) => ({ v: `t${q}`, label: `${q}º trimestre`, meses: () => [1, 2, 3].map((x) => (q - 1) * 3 + x) })),
  { v: "s1", label: "1º semestre", meses: () => [1, 2, 3, 4, 5, 6] },
  { v: "s2", label: "2º semestre", meses: () => [7, 8, 9, 10, 11, 12] },
  { v: "ano", label: "Ano", meses: () => Array.from({ length: 12 }, (_, i) => i + 1) },
];

function DetalheUnidade({ data, linhas, ultimoMes }: { data: any; linhas: any[]; ultimoMes: string }) {
  const [visao, setVisao] = useState<"or" | "mes">("or");
  const [periodo, setPeriodo] = useState("ytd");
  const ano = String(data.ano);
  const u = Number(ultimoMes.slice(5, 7)) || 0;
  const ms = new Set((PERIODOS.find((p) => p.v === periodo) ?? PERIODOS[0]).meses(u));
  const obs = (cid: string) => [...data.vigencias].filter((v: any) => v.contrato_id === cid).sort((a: any, b: any) => b.seq - a.seq)[0]?.observacao ?? "";
  const orcMes = (cid: string, m: number) => data.orcado.filter((o: any) => o.contrato_id === cid && o.mes.startsWith(`${ano}-${String(m).padStart(2, "0")}`)).reduce((s: number, o: any) => s + Number(o.valor ?? 0), 0);
  const rows = linhas.map((l) => {
    const o = [...ms].reduce((s, m) => s + orcMes(l.contrato_id, m), 0);
    const r = data.pags.filter((p: any) => p.contrato_id === l.contrato_id && p.data_pagamento.startsWith(ano) && ms.has(Number(p.data_pagamento.slice(5, 7)))).reduce((s: number, p: any) => s + Number(p.valor_liquido ?? 0), 0);
    return { l, o, r, porMes: Array.from({ length: 12 }, (_, i) => orcMes(l.contrato_id, i + 1)) };
  });
  const tO = rows.reduce((s, x) => s + x.o, 0), tR = rows.reduce((s, x) => s + x.r, 0);
  return <Bloco titulo="Detalhe por unidade" acao={<div className="flex flex-wrap items-center gap-2">
    {visao === "or" && <Select value={periodo} onValueChange={setPeriodo}><SelectTrigger className="h-8 w-40 text-xs" aria-label="Período"><SelectValue /></SelectTrigger><SelectContent>{PERIODOS.map((p) => <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>)}</SelectContent></Select>}
    <Button size="sm" variant={visao === "or" ? "default" : "outline"} aria-pressed={visao === "or"} onClick={() => setVisao("or")}>Orçado × realizado</Button>
    <Button size="sm" variant={visao === "mes" ? "default" : "outline"} aria-pressed={visao === "mes"} onClick={() => setVisao("mes")}>Orçado por mês</Button>
  </div>}>
    {visao === "or" ? <div className={tableClasses.wrap}><table className={cn(tableClasses.table, "min-w-[1000px]")}><thead><tr className={tableClasses.head}>
      {["Unidade", "Locatário", "Orçado", "Realizado", "Diferença", "% realizado", "Observação"].map((h, i) => <th key={h} className={cn(tableClasses.th, i >= 2 && i <= 5 && "text-right")}>{h}</th>)}
    </tr></thead><tbody>
      {rows.map(({ l, o, r }) => <tr key={l.contrato_id}>
        <td className={cn(tableClasses.td, "font-medium")}>{l.unidades}</td><td className={tableClasses.td}>{l.locatario}</td>
        <td className={tableClasses.num}>{brl(o)}</td><td className={tableClasses.num}>{brl(r)}</td>
        <td className={cn(tableClasses.num, r - o < -1 && "text-destructive")}>{brl(r - o)}</td>
        <td className={tableClasses.num}>{o ? pct(r / o * 100) : "—"}</td>
        <td className={cn(tableClasses.td, "max-w-[280px] truncate")} title={obs(l.contrato_id)}>{obs(l.contrato_id)}</td>
      </tr>)}
      <tr className="font-medium"><td className={tableClasses.td}>Total</td><td className={tableClasses.td}></td><td className={tableClasses.num}>{brl(tO)}</td><td className={tableClasses.num}>{brl(tR)}</td><td className={cn(tableClasses.num, tR - tO < 0 && "text-destructive")}>{brl(tR - tO)}</td><td className={tableClasses.num}>{tO ? pct(tR / tO * 100) : "—"}</td><td className={tableClasses.td}></td></tr>
    </tbody></table></div>
    : <div className={tableClasses.wrap}><table className={cn(tableClasses.table, "min-w-[1400px]")}><thead><tr className={tableClasses.head}>
      <th className={tableClasses.th}>Unidade</th><th className={tableClasses.th}>Locatário</th>{MESES.map((m) => <th key={m} className={cn(tableClasses.th, "text-right capitalize")}>{m}</th>)}
    </tr></thead><tbody>
      {rows.map(({ l, porMes }) => <tr key={l.contrato_id}><td className={cn(tableClasses.td, "font-medium")}>{l.unidades}</td><td className={tableClasses.td}>{l.locatario}</td>{porMes.map((v, i) => <td key={i} className={tableClasses.num}>{num2(v)}</td>)}</tr>)}
      <tr className="font-medium"><td className={tableClasses.td}>Total</td><td className={tableClasses.td}></td>{Array.from({ length: 12 }, (_, i) => <td key={i} className={tableClasses.num}>{num2(rows.reduce((s, x) => s + x.porMes[i], 0))}</td>)}</tr>
    </tbody></table></div>}
  </Bloco>;
}

function Projecao({ data, linhas }: { data: any; linhas: any[] }) {
  const [cen, setCen] = useState("0");
  const [detalhe, setDetalhe] = useState(false);
  const boletim = data.focus[0]?.boletim;
  const r = useMemo(() => {
    const focus = { IPCA: {} as Record<number, number>, IGPM: {} as Record<number, number> };
    for (const f of data.focus) (focus as any)[f.indice] && ((focus as any)[f.indice][f.ano] = Number(f.valor));
    const vigAtual = new Map<string, any>();
    for (const v of data.vigencias) { const c = vigAtual.get(v.contrato_id); if (!c || v.seq > c.seq) vigAtual.set(v.contrato_id, v); }
    const hoje = new Date().toISOString().slice(0, 7);
    const regras = new Map<string, any>(data.regras.map((x: any) => [x.contrato_id, x]));
    const elegiveis = linhas.filter((l) => l.contrato?.tipo !== "eventual" && !/estacionamento|audit|heliponto|rooftop/i.test(l.unidades ?? ""));
    const porContrato = elegiveis.map((l) => {
      const vig = vigAtual.get(l.contrato_id);
      const reg = regras.get(l.contrato_id);
      const { ref, caixa } = projetarContrato({
        contrato_id: l.contrato_id, valor_vigente: Number(l.valor_vigente ?? 0), indice: l.indice, mes_reajuste: l.mes_reajuste,
        retencao_pct: l.contrato?.retencao_pct, degraus: data.degraus.filter((g: any) => g.vigencia_id === vig?.id),
        renovacao: reg ? { em: reg.renovacao_em, valor: Number(reg.valor_renovacao) } : null,
      }, hoje, "2029-12", focus, Number(cen));
      const anoTot = (y: number) => Array.from({ length: 12 }, (_, i) => caixa.get(`${y}-${String(i + 1).padStart(2, "0")}`) ?? 0).reduce((s, v) => s + v, 0);
      const area = Number(l.area_matricula_m2) || null;
      return { l, caixa, a2027: anoTot(2027), a2028: anoTot(2028), a2029: anoTot(2029), area, hoje: area ? Number(l.valor_vigente) / area : null, nov29: area ? (ref.get("2029-11") ?? 0) / area : null, renov: reg?.renovacao_em ?? l.fim };
    });
    const barras: { k: string; label: string; v: number }[] = [];
    for (let k = "2027-01"; k <= "2029-12"; k = addMes(k, 1)) barras.push({ k, label: `${MESES[Number(k.slice(5)) - 1]}/${k.slice(2, 4)}`, v: porContrato.reduce((s, x) => s + (x.caixa.get(k) ?? 0), 0) });
    const orc2026 = data.orcado.reduce((s: number, o: any) => s + Number(o.valor ?? 0), 0);
    const anos = [2027, 2028, 2029].map((y) => ({ y, v: barras.filter((b) => b.k.startsWith(String(y))).reduce((s, b) => s + b.v, 0) }));
    return { porContrato, barras, anos: anos.map((a, i) => ({ ...a, varPct: ((a.v / (i ? anos[i - 1].v : orc2026)) - 1) * 100 })) };
  }, [data, linhas, cen]);

  return <Bloco titulo="Projetado 2027 a 2029 (R$ mil por mês)" acao={<div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground">Índices</span>
    <Select value={cen} onValueChange={setCen}><SelectTrigger className="h-8 w-48 text-xs" aria-label="Índices"><SelectValue /></SelectTrigger><SelectContent>
      <SelectItem value="0">Focus {dt(boletim)}</SelectItem><SelectItem value="1">Focus + 1 p.p.</SelectItem><SelectItem value="-1">Focus − 1 p.p.</SelectItem>
    </SelectContent></Select>
  </div>}>
    <p className="mb-3 text-xs text-muted-foreground">Contratos vigentes + reajustes projetados (Focus)</p>
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={r.barras}>
        <CartesianGrid vertical={false} stroke={CORES.borda} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: CORES.texto }} axisLine={false} tickLine={false} interval={2} />
        <YAxis tick={{ fontSize: 10, fill: CORES.texto }} axisLine={false} tickLine={false} tickFormatter={(v) => mil(v)} width={44} />
        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => brl(v)} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="v" name="Receita projetada" fill={CORES.secundaria} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
    <div className="mt-4"><table className={cn(tableClasses.table, "min-w-0")}><thead><tr className={tableClasses.head}>
      <th className={tableClasses.th}>Ano</th><th className={cn(tableClasses.th, "text-right")}>Receita projetada (R$)</th><th className={cn(tableClasses.th, "text-right")}>Variação vs ano anterior</th>
    </tr></thead><tbody>{r.anos.map((a) => <tr key={a.y}><td className={tableClasses.td}>{a.y}</td><td className={tableClasses.num}>{num2(a.v)}</td><td className={cn(tableClasses.num, a.varPct < 0 && "text-destructive")}>{pct(a.varPct)}</td></tr>)}</tbody></table></div>
    <div className="mt-4"><Button size="sm" variant="outline" aria-pressed={detalhe} onClick={() => setDetalhe((x) => !x)}>{detalhe ? "Ocultar detalhe por unidade" : "Ver detalhe por unidade"}</Button></div>
    {detalhe && <div className={cn(tableClasses.wrap, "mt-4")}><table className={cn(tableClasses.table, "min-w-[1100px]")}><thead><tr className={tableClasses.head}>
      {["Unidade", "Locatário", "m²", "R$/m² hoje", "R$/m² nov/29", "Próxima renovação", "2027", "2028", "2029"].map((h, i) => <th key={h} className={cn(tableClasses.th, i >= 2 && i !== 5 && "text-right")}>{h}</th>)}
    </tr></thead><tbody>
      {r.porContrato.map((x) => <tr key={x.l.contrato_id}>
        <td className={cn(tableClasses.td, "font-medium")}>{x.l.unidades}</td><td className={tableClasses.td}>{x.l.locatario}</td>
        <td className={tableClasses.num}>{x.area ? m2(x.area) : "—"}</td><td className={tableClasses.num}>{x.hoje == null ? "—" : num2(x.hoje)}</td><td className={tableClasses.num}>{x.nov29 == null ? "—" : num2(x.nov29)}</td>
        <td className={cn(tableClasses.td, "tabular-nums")}>{dt(x.renov)}</td>
        <td className={tableClasses.num}>{num2(x.a2027)}</td><td className={tableClasses.num}>{num2(x.a2028)}</td><td className={tableClasses.num}>{num2(x.a2029)}</td>
      </tr>)}
      <tr className="font-medium"><td className={tableClasses.td}>Total</td><td className={tableClasses.td} colSpan={5}></td>
        <td className={tableClasses.num}>{num2(r.porContrato.reduce((s, x) => s + x.a2027, 0))}</td><td className={tableClasses.num}>{num2(r.porContrato.reduce((s, x) => s + x.a2028, 0))}</td><td className={tableClasses.num}>{num2(r.porContrato.reduce((s, x) => s + x.a2029, 0))}</td></tr>
    </tbody></table></div>}
  </Bloco>;
}
