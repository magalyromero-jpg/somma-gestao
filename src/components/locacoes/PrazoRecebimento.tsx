import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bloco } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { cn } from "@/lib/utils";
import { brl, dt, mil, MESES } from "@/lib/locacoes";
import { useSaldoEmAberto } from "@/hooks/useSaldoEmAberto";

const um = (n: number | null) => (n == null || !isFinite(n) ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const ms = (s: string) => Date.parse(s.slice(0, 10) + "T00:00:00Z");
const cap = (m: string) => m[0].toUpperCase() + m.slice(1);

const FAIXAS = [
  { k: "f0", label: "No Prazo", cor: "#2E7D46", ok: (d: number) => d <= 0 },
  { k: "f1", label: "1 a 5 Dias", cor: "#B8C2C6", ok: (d: number) => d >= 1 && d <= 5 },
  { k: "f2", label: "6 a 15 Dias", cor: "#7D8E95", ok: (d: number) => d >= 6 && d <= 15 },
  { k: "f3", label: "16 a 30 Dias", cor: "#D9776B", ok: (d: number) => d >= 16 && d <= 30 },
  { k: "f4", label: "Acima de 30 Dias", cor: "#B3261E", ok: (d: number) => d > 30 },
];

/** Vencimento de referência: o mais tarde entre o dia contratual no mês do boleto e o vencimento do boleto. */
function vencRef(venc: string, dia?: number | null) {
  if (!dia) return venc.slice(0, 10);
  const y = Number(venc.slice(0, 4)), m = Number(venc.slice(5, 7));
  const ult = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const contratual = `${venc.slice(0, 7)}-${String(Math.min(dia, ult)).padStart(2, "0")}`;
  return contratual > venc.slice(0, 10) ? contratual : venc.slice(0, 10);
}

type B = { contrato_id: string; valor: number; prazo: number; venc: string; pag: string; mes: number };

function resumo(bs: B[]) {
  const rec = bs.reduce((s, b) => s + b.valor, 0);
  const atr = bs.filter((b) => b.prazo > 0).reduce((s, b) => s + b.valor, 0);
  const pond = bs.reduce((s, b) => s + b.valor * Math.max(b.prazo, 0), 0);
  const maior = bs.length ? bs.reduce((m, b) => (b.prazo > m.prazo ? b : m), bs[0]) : null;
  return { rec, atr, noPrazo: rec - atr, media: rec ? pond / rec : null, maior };
}

export function PrazoRecebimento({ data }: { data: any }) {
  const ano = String(data.ano);
  const info = new Map<string, any>((data.contratosInfo ?? []).map((c: any) => [c.id, c]));
  const ultimaData = (data.pags ?? []).reduce((m: string, p: any) => (p.data_pagamento > m ? p.data_pagamento : m), "");
  const saldo = useSaldoEmAberto(data.edificio.id, data.ano, ultimaData, true);

  const bs: B[] = (data.pags ?? [])
    .filter((p: any) => p.contrato_id && p.data_vencimento?.startsWith(ano) && p.data_pagamento)
    .map((p: any) => {
      const ref = vencRef(p.data_vencimento, info.get(p.contrato_id)?.dia_vencimento);
      return { contrato_id: p.contrato_id, valor: Number(p.valor_liquido ?? 0), prazo: Math.round((ms(p.data_pagamento) - ms(ref)) / 86400000), venc: ref, pag: p.data_pagamento.slice(0, 10), mes: Number(p.data_vencimento.slice(5, 7)) };
    });
  const t = resumo(bs);
  const mc = t.maior ? info.get(t.maior.contrato_id) : null;
  const pc = (v: number) => (t.rec ? `${um((v / t.rec) * 100)}% do total recebido` : undefined);

  const ultimoMes = Math.max(0, ...bs.map((b) => b.mes));
  const grafico = MESES.slice(0, ultimoMes).map((m, i) => {
    const row: any = { mes: cap(m), total: 0 };
    for (const f of FAIXAS) {
      row[f.k] = bs.filter((b) => b.mes === i + 1 && f.ok(b.prazo)).reduce((s, b) => s + b.valor, 0);
      row.total += row[f.k];
    }
    return row;
  });

  const grupos = new Map<string, B[]>();
  for (const b of bs) grupos.set(b.contrato_id, [...(grupos.get(b.contrato_id) ?? []), b]);
  const linhas = [...grupos.entries()].map(([id, g]) => ({ id, c: info.get(id), r: resumo(g), g }))
    .filter((l) => l.r.atr > 0.004).sort((a, b) => b.r.atr - a.r.atr);
  const tl = resumo(linhas.flatMap((l) => l.g));
  const corMedia = (n: number | null) => (n != null && n > 5 ? "text-destructive" : undefined);

  const cards: [string, string, string?][] = [
    ["Recebido no Prazo (R$)", brl(t.noPrazo), pc(t.noPrazo)],
    ["Recebido com Atraso (R$)", brl(t.atr), pc(t.atr)],
    ["Prazo Médio (dias)", um(t.media)],
    ["Maior Atraso (dias)", t.maior ? String(Math.max(t.maior.prazo, 0)) : "—", t.maior ? `${mc?.unidades ?? "—"} · ${mc?.locatario ?? "—"} · Vencimento ${dt(t.maior.venc)} · Pagamento ${dt(t.maior.pag)}` : undefined],
    ["Total em Aberto", saldo.isLoading ? "—" : brl(saldo.total)],
  ];

  return <>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map(([l, v, dica]) => <div key={l} title={dica} className="min-w-0 rounded-md border bg-card p-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">{l}</div>
        <div className={cn("mt-3 whitespace-nowrap text-[clamp(18px,2vw,26px)] font-extralight leading-none tabular-nums text-foreground", l === "Total em Aberto" && saldo.total > 0 && "text-destructive")}>{v}</div>
      </div>)}
    </div>

    <Bloco titulo="Recebimento por Faixa de Prazo">
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <BarChart data={grafico} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickFormatter={(v) => mil(v)} tickLine={false} axisLine={false} fontSize={12} width={48} />
            <Tooltip formatter={(v: number, k: string) => [brl(v), FAIXAS.find((f) => f.k === k)?.label ?? k]} />
            {FAIXAS.map((f, i) => <Bar key={f.k} dataKey={f.k} stackId="a" fill={f.cor}>
              {i === FAIXAS.length - 1 && <LabelList dataKey="total" position="top" fontSize={11} formatter={(v: number) => mil(v)} />}
            </Bar>)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {FAIXAS.map((f) => <span key={f.k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: f.cor }} />{f.label}</span>)}
        <span>Valores em R$ mil</span>
      </div>
    </Bloco>

    <Bloco titulo="Resumo por Cliente">
      <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Unidade", "Locatário", "Vencimento", "Recebido (R$)", "Com Atraso (R$)", "Com Atraso (%)", "Prazo Médio (dias)", "Maior Atraso (dias)"].map((h, i) => <th key={h} className={cn(tableClasses.th, i >= 3 && "text-right")}>{h}</th>)}
      </tr></thead><tbody>
        {linhas.map(({ id, c, r }) => <tr key={id}>
          <td className={cn(tableClasses.td, "font-medium zen-un")}>{c?.unidades || "—"}</td>
          <td className={cn(tableClasses.td, "zen-txt")}>{c?.locatario ?? "—"}</td>
          <td className={tableClasses.td}>{c?.dia_vencimento ? `Dia ${c.dia_vencimento}` : "—"}</td>
          <td className={tableClasses.num}>{brl(r.rec)}</td>
          <td className={tableClasses.num}>{brl(r.atr)}</td>
          <td className={tableClasses.num}>{r.rec ? `${um((r.atr / r.rec) * 100)}%` : "—"}</td>
          <td className={cn(tableClasses.num, corMedia(r.media))}>{um(r.media)}</td>
          <td className={tableClasses.num}>{r.maior ? Math.max(r.maior.prazo, 0) : "—"}</td>
        </tr>)}
        <tr className="font-medium">
          <td className={tableClasses.td} colSpan={3}>Total</td>
          <td className={tableClasses.num}>{brl(tl.rec)}</td>
          <td className={tableClasses.num}>{brl(tl.atr)}</td>
          <td className={tableClasses.num}>{tl.rec ? `${um((tl.atr / tl.rec) * 100)}%` : "—"}</td>
          <td className={cn(tableClasses.num, corMedia(tl.media))}>{um(tl.media)}</td>
          <td className={tableClasses.num}>{tl.maior ? Math.max(tl.maior.prazo, 0) : "—"}</td>
        </tr>
      </tbody></table></div>
    </Bloco>
  </>;
}
