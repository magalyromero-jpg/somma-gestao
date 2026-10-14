import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart } from "recharts";
import {  Bloco,  CORES,  LegendaTexto,  chartTooltipStyle,   } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RealizadoEmAberto } from "@/components/locacoes/RealizadoEmAberto";
import { MESES, addMes, brl, dt, m2, mil, num2, pct, projetarContrato } from "@/lib/locacoes";
import { compararReforecast, motivoReforecast, previstoPorMes } from "@/lib/reforecast";
const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");

type Mes = { mes: string; key: string; i: number; orcado: number; realizado: number; fechado: boolean };

const HATCH = "zen-hatch";

export function FluxoCaixa({ data, linhas, meses, ultimoMes }: { data: any; linhas: any[]; meses: Mes[]; ultimoMes: string }) {
  const ano = data.ano;
  const prevMes = (key: string) => (data.previsto ?? []).filter((o: any) => o.mes.startsWith(key)).reduce((s: number, o: any) => s + Number(o.valor ?? 0), 0);
  const chart = meses.map((m) => ({ mes: m.mes, orcado: m.orcado, realizado: m.fechado ? m.realizado : null, projetado: m.fechado ? null : prevMes(m.key) }));
  const tot = meses.reduce((a, m) => ({ o: a.o + m.orcado, r: a.r + (m.fechado ? m.realizado : 0) }), { o: 0, r: 0 });

  return <>
    <Bloco titulo={`Orçado × realizado em caixa, ${ano} (R$ mil)`}>
      <LegendaTexto itens={[{ cor: CORES.marca, label: "Realizado" }, { cor: CORES.secundaria, label: "Reforecast" }, { cor: CORES.ouro, label: "Orçado dos contratos" }]} />
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
          <Bar dataKey="realizado" name="Realizado" stackId="c" fill={CORES.marca} radius={[2, 2, 0, 0]}>
            <LabelList dataKey="realizado" position="top" formatter={(v: number) => (v ? mil(v) : "")} style={{ fontSize: 10, fill: CORES.texto }} />
          </Bar>
          <Bar dataKey="projetado" name="Reforecast" stackId="c" fill={`url(#${HATCH})`} radius={[2, 2, 0, 0]}>
            <LabelList dataKey="projetado" position="top" formatter={(v: number) => (v ? mil(v) : "")} style={{ fontSize: 10, fill: CORES.texto }} />
          </Bar>
          <Line dataKey="orcado" name="Orçado dos contratos" stroke={CORES.ouro} strokeWidth={2} dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </Bloco>

    <Bloco titulo="Mensal">
      <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        <th className={tableClasses.th}>Mês</th>{["Orçado (R$)", "Reforecast (R$)", "Realizado (R$)", "Diferença (R$)", "Variação (%)"].map((h) => <th key={h} className={cn(tableClasses.th, "text-right")}>{h}</th>)}<th className={tableClasses.th}>Situação</th>
      </tr></thead><tbody>{meses.map((m) => {
        const rf = prevMes(m.key), dif = m.realizado - rf;
        const sit = !m.fechado ? ["A Receber", "op-tag-gray"] : dif < -1 ? ["Abaixo do Reforecast", "op-tag-red"] : ["Dentro", "op-tag-green"];
        const cor = m.fechado && (dif < -1 ? "text-destructive" : "text-success");
        return <tr key={m.key}>
          <td className={tableClasses.td}>{m.mes}/{ano}</td>
          <td className={tableClasses.num}>{num2(m.orcado)}</td>
          <td className={tableClasses.num}>{num2(rf)}</td>
          <td className={tableClasses.num}>{m.fechado ? num2(m.realizado) : "—"}</td>
          <td className={cn(tableClasses.num, cor)}>{m.fechado ? num2(dif) : "—"}</td>
          <td className={cn(tableClasses.num, cor)}>{m.fechado && rf ? pct(dif / rf * 100) : "—"}</td>
          <td className={tableClasses.td}><span className={cn("op-tag", sit[1])}>{sit[0]}</span></td>
        </tr>;
      })}</tbody></table></div>
    </Bloco>

    <Bloco titulo="Orçado × Realizado (R$)">
      <div className={tableClasses.wrap}><table className={cn(tableClasses.table, "zen-wide")}><thead><tr className={tableClasses.head}>
        <th className={tableClasses.th}></th>{MESES.map((m) => <th key={m} className={cn(tableClasses.th, "text-right capitalize")}>{m}</th>)}<th className={cn(tableClasses.th, "text-right")}>Total</th>
      </tr></thead><tbody>
        {(() => {
          const rfF = meses.filter((m) => m.fechado).reduce((s, m) => s + prevMes(m.key), 0);
          const totRf = meses.reduce((s, m) => s + prevMes(m.key), 0);
          const linhasG: [string, (m: Mes) => number | null, number, boolean][] = [
            ["Orçado", (m) => m.orcado, tot.o, false],
            ["Reforecast", (m) => prevMes(m.key), totRf, false],
            ["Realizado", (m) => (m.fechado ? m.realizado : null), tot.r, false],
            ["Diferença", (m) => (m.fechado ? m.realizado - prevMes(m.key) : null), tot.r - rfF, true],
          ];
          const varM = (m: Mes) => { const rf = prevMes(m.key); return m.fechado && rf ? (m.realizado - rf) / rf * 100 : null; };
          const varT = rfF ? (tot.r - rfF) / rfF * 100 : null;
          const corV = (v: number | null) => v == null ? undefined : v < -0.01 ? "text-destructive" : "text-success";
          return <>
            {linhasG.map(([rot, f, t, colore]) => <tr key={rot}><td className={cn(tableClasses.td, "font-medium")}>{rot}</td>
              {meses.map((m) => { const v = f(m); return <td key={m.key} className={cn(tableClasses.num, colore && v != null && (v < -1 ? "text-destructive" : "text-success"))}>{v == null ? "—" : inteiro(v)}</td>; })}
              <td className={cn(tableClasses.num, "font-medium", colore && (t < -1 ? "text-destructive" : "text-success"))}>{inteiro(t)}</td></tr>)}
            <tr><td className={cn(tableClasses.td, "font-medium")}>Variação (%)</td>
              {meses.map((m) => { const v = varM(m); return <td key={m.key} className={cn(tableClasses.num, corV(v))}>{v == null ? "—" : pct(v)}</td>; })}
              <td className={cn(tableClasses.num, "font-medium", corV(varT))}>{varT == null ? "—" : pct(varT)}</td></tr>
          </>;
        })()}
      </tbody></table></div>
    </Bloco>

    <DetalheUnidade data={data} linhas={linhas} ultimoMes={ultimoMes} />
    <MudancasAno edificioId={data.edificio.id} ano={ano} />
    <RealizadoEmAberto ano={data.ano} edificioId={data.edificio.id} admin={!!data.admin} ultimaData={data.pags.reduce((m: string, p: any) => (p.data_pagamento > m ? p.data_pagamento : m), "")} />
    <Projecao data={data} linhas={linhas} />
  </>;
}

export const VISOES_DETALHE = [["orc", "Orçado"], ["ref", "Reforecast"], ["real", "Realizado"], ["or", "Orçado × Realizado"]] as const;

const PERIODOS: { v: string; label: string; meses: (u: number) => number[] }[] = [
  { v: "ytd", label: "Year to Date", meses: (u) => Array.from({ length: Math.max(u, 0) }, (_, i) => i + 1) },
  ...MESES.map((m, i) => ({ v: `m${i + 1}`, label: m.charAt(0).toUpperCase() + m.slice(1), meses: () => [i + 1] })),
  ...[1, 2, 3, 4].map((q) => ({ v: `t${q}`, label: `${q}º trimestre`, meses: () => [1, 2, 3].map((x) => (q - 1) * 3 + x) })),
  { v: "s1", label: "1º semestre", meses: () => [1, 2, 3, 4, 5, 6] },
  { v: "s2", label: "2º semestre", meses: () => [7, 8, 9, 10, 11, 12] },
  { v: "ano", label: "Ano", meses: () => Array.from({ length: 12 }, (_, i) => i + 1) },
];

function DetalheUnidade({ data, ultimoMes }: { data: any; linhas: any[]; ultimoMes: string }) {
  const [visao, setVisao] = useState<"orc" | "real" | "or" | "ref">("orc");
  const [periodo, setPeriodo] = useState("ytd");
  const ano = String(data.ano);
  const u = ultimoMes.startsWith(ano) ? Number(ultimoMes.slice(5, 7)) || 0 : 0;
  const ms = new Set((PERIODOS.find((p) => p.v === periodo) ?? PERIODOS[0]).meses(u));
  const mk = (m: number) => `${ano}-${String(m).padStart(2, "0")}`;
  const contratos: any[] = data.contratosInfo ?? [];
  const soma = (arr: any[], ids: Set<string>, m: number, campo = "valor", data_campo = "mes") => arr.filter((o: any) => ids.has(o.contrato_id) && String(o[data_campo]).startsWith(mk(m))).reduce((s: number, o: any) => s + Number(o[campo] ?? 0), 0);
  // agrupa por unidade
  const porUn = new Map<string, any[]>();
  for (const c of contratos) { const grupo = porUn.get(c.unidades) ?? []; grupo.push(c); porUn.set(c.unidades, grupo); }
  const unidades = [...porUn.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR", { numeric: true })).map(([un, cs]) => {
    const recente = [...cs].sort((a, b) => String(b.data_inicio ?? "").localeCompare(String(a.data_inicio ?? "")))[0];
    const orcC = cs.filter((c) => c.no_orcamento && c.tipo === "locacao");
    const ids = new Set(cs.map((c) => c.id)), orcIds = new Set(orcC.map((c) => c.id));
    const meses12 = Array.from({ length: 12 }, (_, i) => i + 1);
    const orc = meses12.map((m) => soma(data.orcado, orcIds, m));
    const real = meses12.map((m) => (m <= u ? soma(data.pags, ids, m, "valor_liquido", "data_pagamento") : null));
    const ref = previstoPorMes(data.previsto ?? [], ids, ano);
    const totalRef = ref.reduce((s, n) => s + n, 0);
    const totalOrc = orc.reduce((s, n) => s + n, 0);
    return { un, locRecente: recente?.locatario ?? "—", locOrc: (orcC[0] ?? recente)?.locatario ?? "—", temOrc: orcC.length > 0, orc, real, ref, totalRef, totalOrc, diferenca: compararReforecast(totalOrc, totalRef).diferenca, motivo: motivoReforecast(cs, data.vigencias ?? []) };
  });
  const celulaRef = (orcado: number, previsto: number, diferenca = false, key?: number) => {
    const comparacao = compararReforecast(orcado, previsto);
    const colorida = comparacao.estado !== "igual";
    return <td key={key} className={cn(tableClasses.num, colorida && `reforecast-${comparacao.estado}`)} title={colorida ? `Orçado: ${brl(orcado)} · Reforecast: ${brl(previsto)} · Diferença: ${brl(comparacao.diferenca)}` : undefined}>
      {diferenca ? (comparacao.diferenca === 0 ? "—" : num2(comparacao.diferenca)) : (previsto === 0 ? "—" : inteiro(previsto))}
    </td>;
  };
  const totaisRef = Array.from({ length: 12 }, (_, i) => unidades.reduce((s, x) => s + x.ref[i], 0));
  const totaisOrc = Array.from({ length: 12 }, (_, i) => unidades.reduce((s, x) => s + x.orc[i], 0));
  const totalRef = totaisRef.reduce((s, n) => s + n, 0), totalOrc = totaisOrc.reduce((s, n) => s + n, 0);
  const fmt = (v: number | null) => (v == null || Math.round(v) === 0 ? "—" : inteiro(v));
  const mensal = (lista: typeof unidades, get: (x: typeof unidades[number]) => (number | null)[], loc: (x: typeof unidades[number]) => string) => <div className={tableClasses.wrap}><table className={cn(tableClasses.table, "zen-wide")}><thead><tr className={tableClasses.head}>
      <th className={tableClasses.th}>Unidade</th><th className={tableClasses.th}>Locatário</th>{MESES.map((m) => <th key={m} className={cn(tableClasses.th, "text-right capitalize")}>{m}</th>)}<th className={cn(tableClasses.th, "text-right")}>Total</th>
    </tr></thead><tbody>
      {lista.map((x) => { const v = get(x); return <tr key={x.un}><td className={cn(tableClasses.td, "font-medium zen-un")}>{x.un}</td><td className={cn(tableClasses.td, "zen-txt")}>{loc(x)}</td>{v.map((n, i) => <td key={i} className={tableClasses.num}>{fmt(n)}</td>)}<td className={cn(tableClasses.num, "font-bold")}>{fmt(v.reduce((s: number, n) => s + (n ?? 0), 0))}</td></tr>; })}
      <tr className="font-bold"><td className={tableClasses.td}>Total</td><td className={tableClasses.td}></td>{Array.from({ length: 12 }, (_, i) => { const col = lista.map((x) => get(x)[i]); return <td key={i} className={tableClasses.num}>{col.every((n) => n == null) ? "—" : fmt(col.reduce((s: number, n) => s + (n ?? 0), 0))}</td>; })}<td className={tableClasses.num}>{fmt(lista.reduce((s, x) => s + get(x).reduce((a: number, n) => a + (n ?? 0), 0), 0))}</td></tr>
    </tbody></table></div>;
  const comOrc = unidades.filter((x) => x.temOrc);
  const ox = unidades.map((x) => ({ x, o: [...ms].reduce((s, m) => s + x.orc[m - 1], 0), r: [...ms].reduce((s, m) => s + (x.real[m - 1] ?? 0), 0), f: [...ms].reduce((s, m) => s + (x.ref[m - 1] ?? 0), 0) })).filter(({ o, r, f }) => o || r || f);
  const tF = ox.reduce((s, y) => s + y.f, 0), tO = ox.reduce((s, y) => s + y.o, 0), tR = ox.reduce((s, y) => s + y.r, 0);
  return <Bloco titulo="Detalhe por Unidade" acao={<div className="flex flex-wrap items-center gap-2">
    {visao === "or" && <Select value={periodo} onValueChange={setPeriodo}><SelectTrigger className="h-8 w-40 text-xs" aria-label="Período"><SelectValue /></SelectTrigger><SelectContent>{PERIODOS.map((p) => <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>)}</SelectContent></Select>}
    {VISOES_DETALHE.map(([v, l]) =>
      <Button key={v} size="sm" variant={visao === v ? "default" : "outline"} aria-pressed={visao === v} onClick={() => setVisao(v)}>{l}</Button>)}
  </div>}>
    {visao === "orc" ? mensal(comOrc, (x) => x.orc, (x) => x.locOrc)
      : visao === "real" ? mensal(unidades, (x) => x.real, (x) => x.locRecente)
      : visao === "ref" ? <>
        <ReforecastTabela edificioId={data.edificio.id} ano={data.ano} />
      </>
      : <div className={tableClasses.wrap}><table className={cn(tableClasses.table, "zen-wide")}><thead><tr className={tableClasses.head}>
      {["Unidade", "Locatário", "Orçado", "Reforecast", "Realizado", "Diferença (R$)", "Variação (%)"].map((h, i) => <th key={h} className={cn(tableClasses.th, i >= 2 && "text-right")}>{h}</th>)}
    </tr></thead><tbody>
      {ox.map(({ x, o, r, f }) => <tr key={x.un}>
        <td className={cn(tableClasses.td, "font-medium zen-un")}>{x.un}</td><td className={cn(tableClasses.td, "zen-txt")}>{x.locOrc}</td>
        <td className={tableClasses.num}>{o ? brl(o) : "—"}</td><td className={tableClasses.num}>{f ? brl(f) : "—"}</td><td className={tableClasses.num}>{r ? brl(r) : "—"}</td>
        <td className={cn(tableClasses.num, r - f < -0.004 ? "text-destructive" : "text-success")}>{Math.abs(r - f) > 0.004 ? brl(r - f) : "—"}</td>
        <td className={cn(tableClasses.num, r - f < -0.004 ? "text-destructive" : "text-success")}>{f ? pct((r - f) / f * 100) : ""}</td>
      </tr>)}
      <tr className="font-bold"><td className={tableClasses.td}>Total</td><td className={tableClasses.td}></td><td className={tableClasses.num}>{brl(tO)}</td><td className={tableClasses.num}>{brl(tF)}</td><td className={tableClasses.num}>{brl(tR)}</td><td className={cn(tableClasses.num, tR - tF < -0.004 ? "text-destructive" : "text-success")}>{brl(tR - tF)}</td><td className={cn(tableClasses.num, tR - tF < -0.004 ? "text-destructive" : "text-success")}>{tF ? pct((tR - tF) / tF * 100) : ""}</td></tr>
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
    const hoje = String(data.hoje ?? new Date().toISOString()).slice(0, 7);
    const regras = new Map<string, any>(data.regras.map((x: any) => [x.contrato_id, x]));
    const elegiveis = linhas.filter((l) => l.contrato?.tipo !== "eventual" && !/estacionamento|audit|heliponto|rooftop/i.test(l.unidades ?? ""));
    const porContrato = elegiveis.map((l) => {
      const vig = vigAtual.get(l.contrato_id);
      const reg = regras.get(l.contrato_id);
      const futuro = vig && vig.inicio.slice(0, 7) > hoje ? [{ a_partir: vig.inicio, valor_mensal: Number(vig.valor_mensal) }] : [];
      const { ref, caixa } = projetarContrato({
        contrato_id: l.contrato_id, valor_vigente: futuro.length ? 0 : Number(l.valor_vigente ?? 0), indice: l.indice, mes_reajuste: l.mes_reajuste,
        retencao_pct: l.contrato?.retencao_pct, degraus: [...futuro, ...data.degraus.filter((g: any) => g.vigencia_id === vig?.id)],
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

  return <Bloco titulo="Projeção 2027–2029 (R$ mil)" acao={<div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground">Índices</span>
    <Select value={cen} onValueChange={setCen}><SelectTrigger className="h-8 w-48 text-xs" aria-label="Índices"><SelectValue /></SelectTrigger><SelectContent>
      <SelectItem value="0">Focus {dt(boletim)}</SelectItem><SelectItem value="1">Focus + 1 p.p.</SelectItem><SelectItem value="-1">Focus − 1 p.p.</SelectItem>
    </SelectContent></Select>
  </div>}>
    <p className="mb-3 text-xs text-muted-foreground">Contratos Vigentes + reajustes projetados (Focus)</p>
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={r.barras}>
        <CartesianGrid vertical={false} stroke={CORES.borda} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: CORES.texto }} axisLine={false} tickLine={false} interval={2} />
        <YAxis tick={{ fontSize: 10, fill: CORES.texto }} axisLine={false} tickLine={false} tickFormatter={(v) => mil(v)} width={44} />
        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => brl(v)} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="v" name="Receita projetada" fill={CORES.secundaria} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
    <div className="mt-4"><table className={cn(tableClasses.table)}><thead><tr className={tableClasses.head}>
      <th className={tableClasses.th}>Ano</th><th className={cn(tableClasses.th, "text-right")}>Receita Projetada (R$)</th><th className={cn(tableClasses.th, "text-right")}>Variação Anual</th>
    </tr></thead><tbody>{r.anos.map((a) => <tr key={a.y}><td className={tableClasses.td}>{a.y}</td><td className={tableClasses.num}>{num2(a.v)}</td><td className={cn(tableClasses.num, a.varPct < 0 && "text-destructive")}>{pct(a.varPct)}</td></tr>)}</tbody></table></div>
    <div className="mt-4"><Button size="sm" variant="outline" aria-pressed={detalhe} onClick={() => setDetalhe((x) => !x)}>{detalhe ? "Ocultar detalhe por unidade" : "Ver detalhe por unidade"}</Button></div>
    {detalhe && <div className={cn(tableClasses.wrap, "mt-4")}><table className={cn(tableClasses.table, "zen-wide")}><thead><tr className={tableClasses.head}>
      {["Unidade", "Locatário", "m²", "R$/m² hoje", "R$/m² nov/29", "Próxima renovação", "2027", "2028", "2029"].map((h, i) => <th key={h} className={cn(tableClasses.th, i >= 2 && i !== 5 && "text-right")}>{h}</th>)}
    </tr></thead><tbody>
      {r.porContrato.map((x) => <tr key={x.l.contrato_id}>
        <td className={cn(tableClasses.td, "font-medium zen-un")}>{x.l.unidades}</td><td className={cn(tableClasses.td, "zen-txt")}>{x.l.locatario}</td>
        <td className={tableClasses.num}>{x.area ? m2(x.area) : "—"}</td><td className={tableClasses.num}>{x.hoje == null ? "—" : num2(x.hoje)}</td><td className={tableClasses.num}>{x.nov29 == null ? "—" : num2(x.nov29)}</td>
        <td className={cn(tableClasses.td, "tabular-nums")}>{dt(x.renov)}</td>
        <td className={tableClasses.num}>{num2(x.a2027)}</td><td className={tableClasses.num}>{num2(x.a2028)}</td><td className={tableClasses.num}>{num2(x.a2029)}</td>
      </tr>)}
      <tr className="font-medium"><td className={tableClasses.td}>Total</td><td className={tableClasses.td} colSpan={5}></td>
        <td className={tableClasses.num}>{num2(r.porContrato.reduce((s, x) => s + x.a2027, 0))}</td><td className={tableClasses.num}>{num2(r.porContrato.reduce((s, x) => s + x.a2028, 0))}</td><td className={tableClasses.num}>{num2(r.porContrato.reduce((s, x) => s + x.a2029, 0))}</td></tr>
    </tbody></table></div>}
  </Bloco>;
}

function MudancasAno({ edificioId, ano }: { edificioId: string; ano: number }) {
  const q = useQuery({
    queryKey: ["loc-mudancas-ano", edificioId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("loc_v_mudancas_ano").select("contrato_id, unidades, locatario, tipo, data_decisao, valor_mensal, observacao").eq("edificio_id", edificioId).order("data_decisao");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const linhas = (q.data ?? []).filter((x) => String(x.data_decisao ?? "").startsWith(String(ano)));
  return <Bloco titulo={`Mudanças em ${ano}`}>
    {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : q.error ? <p className="text-sm text-destructive">Não foi possível carregar.</p> :
    <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
      {["Unidade", "Locatário", "Tipo", "Data", "Valor Mensal (R$)"].map((h, i) => <th key={h} className={cn(tableClasses.th, i === 4 && "text-right")}>{h}</th>)}
    </tr></thead><tbody>
      {linhas.length === 0 && <tr><td colSpan={5} className={cn(tableClasses.td, "text-muted-foreground")}>Nenhuma mudança.</td></tr>}
      {linhas.map((x, i) => <tr key={`${x.contrato_id}-${i}`}>
        <td className={cn(tableClasses.td, "font-medium zen-un")}>{x.unidades ?? "—"}</td>
        <td className={cn(tableClasses.td, "zen-txt")}>{x.locatario ?? "—"}</td>
        <td className={tableClasses.td}>{x.tipo}</td>
        <td className={cn(tableClasses.td, "tabular-nums")}>{dt(x.data_decisao)}</td>
        <td className={tableClasses.num}>{num2(Number(x.valor_mensal ?? 0))}</td>
      </tr>)}
    </tbody></table></div>}
  </Bloco>;
}

function ReforecastTabela({ edificioId, ano }: { edificioId: string; ano: number }) {
  const q = useQuery({
    queryKey: ["loc-reforecast-vs-orcado", edificioId, ano],
    queryFn: async () => {
      const [r, m] = await Promise.all([
        (supabase as any).rpc("loc_reforecast_vs_orcado", { p_edificio: edificioId, p_ano: ano }),
        (supabase as any).from("loc_v_mudancas_ano").select("contrato_id").eq("edificio_id", edificioId),
      ]);
      if (r.error) throw r.error;
      if (m.error) throw m.error;
      const dec = new Set(((m.data ?? []) as any[]).map((x) => x.contrato_id));
      return ((r.data ?? []) as any[]).map((x) => ({ ...x, decisao: dec.has(x.contrato_id) }));
    },
  });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (q.error) return <p className="text-sm text-destructive">Não foi possível carregar o reforecast.</p>;
  const grupos = new Map<string, { un: string; loc: string; locPeso: number; o: number[]; r: number[]; d: number[] }>();
  for (const x of q.data ?? []) {
    const un = x.unidades ?? "—";
    const g = grupos.get(un) ?? { un, loc: "—", locPeso: -1, o: Array(12).fill(0), r: Array(12).fill(0), d: Array(12).fill(0) };
    const i = Number(String(x.mes).slice(5, 7)) - 1;
    g.o[i] += Number(x.orcado ?? 0); g.r[i] += Number(x.reforecast ?? 0);
    if (x.decisao) g.d[i] += Number(x.diferenca ?? 0);
    const peso = Number(x.reforecast ?? 0) * 100 + i;
    if (Number(x.reforecast) > 0 && peso > g.locPeso && x.locatario) { g.loc = x.locatario; g.locPeso = peso; }
    grupos.set(un, g);
  }
  const linhas = [...grupos.values()].filter((g) => g.o.some(Boolean) || g.r.some(Boolean)).sort((a, b) => a.un.localeCompare(b.un, "pt-BR", { numeric: true }));
  const soma = (v: number[]) => v.reduce((s, n) => s + n, 0);
  const cel = (orcado: number, ref: number, d: number, key?: number) => {
    const cls = d >= 1 ? "reforecast-acima" : d <= -1 ? "reforecast-abaixo" : "";
    return <td key={key} className={cn(tableClasses.num, cls)} title={cls ? `Orçado: ${brl(orcado)} · Reforecast: ${brl(ref)} · Diferença: ${brl(ref - orcado)}` : undefined}>{ref === 0 ? "—" : inteiro(ref)}</td>;
  };
  const dif = (orcado: number, ref: number) => {
    const c = compararReforecast(orcado, ref);
    const cls = c.diferenca > 0 ? "reforecast-acima" : c.diferenca < 0 ? "reforecast-abaixo" : "";
    return <td className={cn(tableClasses.num, cls)}>{c.diferenca === 0 ? "—" : num2(c.diferenca)}</td>;
  };
  const tO = Array.from({ length: 12 }, (_, i) => linhas.reduce((s, g) => s + g.o[i], 0));
  const tR = Array.from({ length: 12 }, (_, i) => linhas.reduce((s, g) => s + g.r[i], 0));
  return <>
    <p className="mb-3 text-xs text-muted-foreground">Verde: acima do orçado · Vermelho: abaixo do orçado</p>
    <div className={tableClasses.wrap}><table className={cn(tableClasses.table, "zen-wide")}><thead><tr className={tableClasses.head}>
      <th className={tableClasses.th}>Unidade</th><th className={tableClasses.th}>Locatário</th>{MESES.map((m) => <th key={m} className={cn(tableClasses.th, "text-right capitalize")}>{m}</th>)}
      <th className={cn(tableClasses.th, "text-right")}>Reforecast</th>
    </tr></thead><tbody>
      {linhas.map((g) => <tr key={g.un}><td className={cn(tableClasses.td, "font-medium zen-un")}>{g.un}</td><td className={cn(tableClasses.td, "zen-txt")}>{g.loc}</td>
        {g.r.map((n, i) => cel(g.o[i], n, g.d[i], i))}
        <td className={cn(tableClasses.num, "font-bold")}>{num2(soma(g.r))}</td></tr>)}
      <tr className="font-bold"><td className={tableClasses.td}>Total</td><td className={tableClasses.td} />
        {tR.map((n, i) => cel(tO[i], n, linhas.reduce((s, g) => s + g.d[i], 0), i))}
        <td className={tableClasses.num}>{num2(soma(tR))}</td></tr>
    </tbody></table></div>
  </>;
}
