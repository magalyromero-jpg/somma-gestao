import { Bloco } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { cn } from "@/lib/utils";
import { dt, MESES } from "@/lib/locacoes";

const um = (n: number | null) => (n == null || !isFinite(n) ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const dias = (a: string, b: string) => Math.round((Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10))) / 86400000);
const cap = (m: string) => m[0].toUpperCase() + m.slice(1);

type Boleto = { contrato_id: string; prazo: number; venc: string; pag: string };

function indicadores(bs: Boleto[]) {
  if (!bs.length) return { n: 0, media: null as number | null, emDia: null as number | null, maior: null as Boleto | null, ultimo: "" };
  const maior = bs.reduce((m, b) => (b.prazo > m.prazo ? b : m), bs[0]);
  return {
    n: bs.length,
    media: bs.reduce((s, b) => s + b.prazo, 0) / bs.length,
    emDia: (bs.filter((b) => b.prazo <= 0).length / bs.length) * 100,
    maior,
    ultimo: bs.reduce((m, b) => (b.pag > m ? b.pag : m), ""),
  };
}

export function PrazoRecebimento({ data }: { data: any }) {
  const ano = String(data.ano);
  const info = new Map<string, any>((data.contratosInfo ?? []).map((c: any) => [c.id, c]));
  const boletos: Boleto[] = (data.pags ?? [])
    .filter((p: any) => p.contrato_id && p.data_vencimento?.startsWith(ano) && p.data_pagamento)
    .map((p: any) => ({ contrato_id: p.contrato_id, prazo: dias(p.data_pagamento, p.data_vencimento), venc: p.data_vencimento.slice(0, 10), pag: p.data_pagamento.slice(0, 10) }));
  const total = indicadores(boletos);
  const grupos = new Map<string, Boleto[]>();
  for (const b of boletos) grupos.set(b.contrato_id, [...(grupos.get(b.contrato_id) ?? []), b]);
  const linhas = [...grupos.entries()].map(([id, bs]) => {
    const c = info.get(id);
    return { id, unidade: c?.unidades || "—", locatario: c?.locatario ?? "—", dia: c?.dia_vencimento, bs, ind: indicadores(bs) };
  }).sort((a, b) => a.unidade.localeCompare(b.unidade, "pt-BR", { numeric: true }));
  const maiorC = total.maior ? info.get(total.maior.contrato_id) : null;
  const verde = "text-[#1E6B34]";
  const cor = (n: number | null) => (n == null ? undefined : n <= 0 ? verde : n > 5 ? "text-destructive" : undefined);

  const cards: [string, string, string?][] = [
    ["Prazo Médio (dias)", um(total.media)],
    ["Pagos em Dia", total.emDia == null ? "—" : `${um(total.emDia)}%`],
    ["Pagos com Atraso", total.emDia == null ? "—" : `${um(100 - total.emDia)}%`],
    ["Maior Atraso (dias)", total.maior ? String(total.maior.prazo) : "—", total.maior ? `${maiorC?.unidades ?? "—"} · ${maiorC?.locatario ?? "—"} · Vencimento ${dt(total.maior.venc)}` : undefined],
    ["Boletos Pagos", String(total.n)],
  ];

  const mesBol = (bs: Boleto[], i: number) => bs.filter((b) => Number(b.venc.slice(5, 7)) === i + 1);

  return <>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {cards.map(([l, v, dica]) => <div key={l} title={dica} className="rounded-md border bg-card p-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">{l}</div>
        <div className="mt-3 text-[32px] font-extralight leading-none tabular-nums text-foreground">{v}</div>
      </div>)}
    </div>

    <Bloco titulo="Prazo por Contrato">
      <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Unidade", "Locatário", "Vencimento", "Boletos Pagos", "Prazo Médio (dias)", "Maior Atraso (dias)", "Pagos em Dia (%)", "Último Pagamento"].map((h, i) => <th key={h} className={cn(tableClasses.th, i >= 3 && i <= 6 && "text-right")}>{h}</th>)}
      </tr></thead><tbody>
        {linhas.map((l) => <tr key={l.id}>
          <td className={cn(tableClasses.td, "font-medium zen-un")}>{l.unidade}</td>
          <td className={cn(tableClasses.td, "zen-txt")}>{l.locatario}</td>
          <td className={tableClasses.td}>{l.dia ? `Dia ${l.dia}` : "—"}</td>
          <td className={tableClasses.num}>{l.ind.n}</td>
          <td className={cn(tableClasses.num, cor(l.ind.media))}>{um(l.ind.media)}</td>
          <td className={tableClasses.num}>{l.ind.maior?.prazo ?? "—"}</td>
          <td className={tableClasses.num}>{um(l.ind.emDia)}</td>
          <td className={cn(tableClasses.td, "tabular-nums")}>{dt(l.ind.ultimo)}</td>
        </tr>)}
        <tr className="font-medium">
          <td className={tableClasses.td} colSpan={3}>Total</td>
          <td className={tableClasses.num}>{total.n}</td>
          <td className={cn(tableClasses.num, cor(total.media))}>{um(total.media)}</td>
          <td className={tableClasses.num}>{total.maior?.prazo ?? "—"}</td>
          <td className={tableClasses.num}>{um(total.emDia)}</td>
          <td className={cn(tableClasses.td, "tabular-nums")}>{dt(total.ultimo)}</td>
        </tr>
      </tbody></table></div>
    </Bloco>

    <Bloco titulo="Prazo por Mês de Vencimento">
      <div className={tableClasses.wrap}><table className={cn(tableClasses.table, "zen-wide")}><thead><tr className={tableClasses.head}>
        <th className={tableClasses.th}>Unidade</th><th className={tableClasses.th}>Locatário</th>
        {MESES.map((m) => <th key={m} className={cn(tableClasses.th, "text-right")}>{cap(m)}</th>)}
      </tr></thead><tbody>
        {linhas.map((l) => <tr key={l.id}>
          <td className={cn(tableClasses.td, "font-medium zen-un")}>{l.unidade}</td>
          <td className={cn(tableClasses.td, "zen-txt")}>{l.locatario}</td>
          {MESES.map((m, i) => {
            const bs = mesBol(l.bs, i);
            const v = bs.length ? Math.max(...bs.map((b) => b.prazo)) : null;
            return <td key={m} className={cn(tableClasses.num, cor(v))}>{v ?? "—"}</td>;
          })}
        </tr>)}
        <tr className="font-medium">
          <td className={tableClasses.td} colSpan={2}>Média do Mês</td>
          {MESES.map((m, i) => {
            const bs = mesBol(boletos, i);
            const v = bs.length ? bs.reduce((s, b) => s + b.prazo, 0) / bs.length : null;
            return <td key={m} className={cn(tableClasses.num, cor(v))}>{um(v)}</td>;
          })}
        </tr>
      </tbody></table></div>
    </Bloco>
  </>;
}
