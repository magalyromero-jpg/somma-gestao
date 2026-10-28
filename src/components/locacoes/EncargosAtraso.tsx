import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { CORES, chartTooltipStyle } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { cn } from "@/lib/utils";
import { MESES, brl, dt } from "@/lib/locacoes";
import { Button } from "@/components/ui/button";

const db = supabase as any;
const DICA = "O banco informa apenas o total pago a mais. Juros estimados em 1% ao mês, proporcional aos dias de atraso; multa é o restante.";

/** Receita à parte, só para acompanhamento: não soma em Orçado, Reforecast, Realizado nem Previsto. */
export function EncargosAtraso({ data }: { data: any }) {
  const [aberto, setAberto] = useState(false);
  const ano = data.ano as number;
  const { data: rows = [] } = useQuery({
    queryKey: ["loc-encargos", data.edificio.id, ano],
    queryFn: async () => {
      const r = await db.from("loc_v_boleto_encargos").select("*").eq("edificio_id", data.edificio.id)
        .gte("competencia", `${ano}-01-01`).lte("competencia", `${ano}-12-01`).order("data_pagamento", { ascending: false });
      if (r.error) throw r.error;
      const b = await db.from("loc_boletos").select("id,natureza,descricao").eq("edificio_id", data.edificio.id).limit(10000);
      if (b.error) throw b.error;
      const meta = new Map<string, any>((b.data ?? []).map((item: any) => [item.id, item]));
      return (r.data ?? []).map((item: any) => ({ ...item, natureza: meta.get(item.id)?.natureza, descricao: meta.get(item.id)?.descricao }));
    },
  });
  const un = new Map<string, string>((data.contratosInfo ?? []).map((c: any) => [c.id, c.unidades]));
  const s = (f: string, l = rows) => l.reduce((t: number, r: any) => t + Number(r[f] ?? 0), 0);
  let acum = 0;
  const graf = MESES.map((m, i) => {
    const k = `${ano}-${String(i + 1).padStart(2, "0")}`;
    const l = rows.filter((r: any) => String(r.competencia).startsWith(k));
    acum += s("acrescimo", l);
    return { mes: m, multa: s("multa", l), juros: s("juros", l), total: s("acrescimo", l), qtd: l.length, acum };
  });

  return <div className="rounded-md border bg-card">
    <Button variant="ghost" aria-expanded={aberto} className="flex h-auto w-full items-center justify-between p-4 text-left" onClick={() => setAberto((v) => !v)}>
      <span className="text-sm font-semibold">{aberto ? "▾" : "▸"} Encargos de Atraso</span>
      <span className="text-sm tabular-nums">{brl(s("acrescimo"))}</span>
    </Button>
    {aberto && <div className="space-y-4 border-t p-4">
      <div className="h-64"><ResponsiveContainer><ComposedChart data={graf}>
        <CartesianGrid vertical={false} stroke={CORES.borda} />
        <XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={chartTooltipStyle} content={({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null; const p = payload[0].payload;
          return <div style={chartTooltipStyle} className="p-2 text-xs"><div className="font-semibold">{label}</div>
            <div>Multa: {brl(p.multa)}</div><div>Juros: {brl(p.juros)}</div><div>Total: {brl(p.total)}</div>
            <div>Boletos: {p.qtd}</div><div>Acumulado: {brl(p.acum)}</div></div>;
        }} />
        <Bar dataKey="multa" name="Multa" stackId="e" fill={CORES.marca} />
        <Bar dataKey="juros" name="Juros" stackId="e" fill={CORES.ouro} />
        <Line dataKey="acum" name="Acumulado" stroke={CORES.secundaria} dot={false} strokeWidth={2} />
      </ComposedChart></ResponsiveContainer></div>
      <table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Pagador", "Contrato (unidade)", "Vencimento", "Pagamento", "Dias de Atraso", "Valor do Título (R$)", "Valor Pago (R$)", "Multa (R$)", "Juros (R$)", "Total (R$)"].map((h, i) =>
          <th key={h} title={i === 7 || i === 8 ? DICA : undefined} className={cn(tableClasses.th, i >= 4 && "text-right")}>{h}</th>)}
      </tr></thead><tbody>
        {rows.map((r: any) => <tr key={r.id}>
          <td className={tableClasses.td}>{r.pagador} {r.natureza === "outros" && <span className="op-tag op-tag-gray ml-1" title={r.descricao ?? undefined}>Não Aluguel</span>}</td><td className={tableClasses.td}>{un.get(r.contrato_id) ?? r.outra_receita ?? "—"}</td>
          <td className={cn(tableClasses.td, "tabular-nums")}>{dt(r.data_vencimento)}</td><td className={cn(tableClasses.td, "tabular-nums")}>{dt(r.data_pagamento)}</td>
          <td className={tableClasses.num}>{r.dias_atraso}</td><td className={tableClasses.num}>{brl(r.valor_titulo)}</td><td className={tableClasses.num}>{brl(r.valor_pago)}</td>
          <td className={tableClasses.num} title={DICA}>{brl(r.multa)}</td><td className={tableClasses.num} title={DICA}>{brl(r.juros)}</td><td className={tableClasses.num}>{brl(r.acrescimo)}</td>
        </tr>)}
        <tr className="font-semibold"><td className={tableClasses.td} colSpan={5}>Total</td>
          <td className={tableClasses.num}>{brl(s("valor_titulo"))}</td><td className={tableClasses.num}>{brl(s("valor_pago"))}</td>
          <td className={tableClasses.num}>{brl(s("multa"))}</td><td className={tableClasses.num}>{brl(s("juros"))}</td><td className={tableClasses.num}>{brl(s("acrescimo"))}</td></tr>
      </tbody></table>
    </div>}
  </div>;
}
