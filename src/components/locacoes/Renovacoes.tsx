import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bloco, CORES, chartTooltipStyle } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DICA_VALOR_VIGENTE, baseRenovacoes, brl, dt, pct1 } from "@/lib/locacoes";
import type { CicloRenovacao, ContratoRenovacao } from "@/lib/locacoes";

export const CICLO_COR: Record<CicloRenovacao, string> = {
  a_vencer_120d: CORES.atraso,
  a_vencer_12m: CORES.ambar,
  vigente: CORES.verde,
  sem_data: CORES.cinza,
};
const CICLO_TAG: Record<CicloRenovacao, string> = {
  a_vencer_120d: "op-tag-red",
  a_vencer_12m: "op-tag-amber",
  vigente: "op-tag-green",
  sem_data: "op-tag-gray",
};
const CICLO_LABEL: Record<CicloRenovacao, string> = {
  a_vencer_120d: "Até 120 Dias",
  a_vencer_12m: "De 121 Dias a 12 Meses",
  vigente: "Acima de 12 Meses",
  sem_data: "Vencido ou Sem Data",
};

function Quadro({ label, valor, dica }: { label: string; valor: string; dica?: string }) {
  return <div title={dica} className="rounded-md border bg-card p-5">
    <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">{label}</div>
    <div className="mt-3 text-[32px] font-extralight leading-none tabular-nums text-foreground">{valor}</div>
  </div>;
}

const thR = cn(tableClasses.th, "text-right");

/** Barra única por ciclo de vencimento + tabela contínua (Visão Geral) */
export function BlocoCicloVencimento({ base }: { base: ReturnType<typeof baseRenovacoes> }) {
  return <Bloco titulo="Receita por Ciclo de Vencimento">
    <div className="flex h-6 w-full overflow-hidden rounded-sm">
      {base.porCiclo.map((c) => c.valor > 0 && (
        <div key={c.chave} title={`${c.label}: ${c.n} ${c.n === 1 ? "contrato" : "contratos"} · ${brl(c.valor)} · ${pct1(c.pct)}`} style={{ width: `${c.pct}%`, background: CICLO_COR[c.chave] }} />
      ))}
    </div>
    <div className="mt-4 overflow-x-auto"><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
      <th className={tableClasses.th}>Ciclo</th>
      <th className={thR}>Contratos</th>
      <th className={thR} title={DICA_VALOR_VIGENTE}>Valor Mensal Vigente (R$)</th>
      <th className={thR}>% da Receita</th>
    </tr></thead><tbody>
      {base.porCiclo.map((c) => <tr key={c.chave}>
        <td className={tableClasses.td}><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: CICLO_COR[c.chave] }} />{c.label}</span></td>
        <td className={tableClasses.num}>{c.n}</td>
        <td className={tableClasses.num} title={DICA_VALOR_VIGENTE}>{brl(c.valor)}</td>
        <td className={tableClasses.num}>{pct1(c.pct)}</td>
      </tr>)}
      <tr className="font-medium">
        <td className={tableClasses.td}>Total</td>
        <td className={tableClasses.num}>{base.nContratos}</td>
        <td className={tableClasses.num} title={DICA_VALOR_VIGENTE}>{brl(base.total)}</td>
        <td className={tableClasses.num}>{pct1(100)}</td>
      </tr>
    </tbody></table></div>
  </Bloco>;
}

/** Rosca por valor + tabela contínua por índice (Visão Geral) */
export function BlocoIndiceReajuste({ base }: { base: ReturnType<typeof baseRenovacoes> }) {
  const cores = [CORES.marca, CORES.ouro, CORES.secundaria, CORES.ambar, CORES.cinza];
  return <Bloco titulo="Distribuição por Índice de Reajuste">
    <div className="grid gap-4 md:grid-cols-2">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number, _n, item: any) => [`${brl(v)} · ${item.payload.n} ${item.payload.n === 1 ? "contrato" : "contratos"}`, item.payload.label]} />
            <Pie data={base.porIndice} dataKey="valor" nameKey="label" innerRadius="55%" outerRadius="90%" strokeWidth={0}>
              {base.porIndice.map((g, i) => <Cell key={g.indice} fill={cores[i % cores.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto"><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        <th className={tableClasses.th}>Índice</th>
        <th className={thR}>Contratos</th>
        <th className={thR} title={DICA_VALOR_VIGENTE}>Valor Mensal Vigente (R$)</th>
        <th className={thR}>% da Receita</th>
      </tr></thead><tbody>
        {base.porIndice.map((g, i) => <tr key={g.indice}>
          <td className={tableClasses.td}><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: cores[i % cores.length] }} />{g.label}</span></td>
          <td className={tableClasses.num}>{g.n}</td>
          <td className={tableClasses.num} title={DICA_VALOR_VIGENTE}>{brl(g.valor)}</td>
          <td className={tableClasses.num}>{pct1(g.pct)}</td>
        </tr>)}
        <tr className="font-medium">
          <td className={tableClasses.td}>Total</td>
          <td className={tableClasses.num}>{base.nContratos}</td>
          <td className={tableClasses.num} title={DICA_VALOR_VIGENTE}>{brl(base.total)}</td>
          <td className={tableClasses.num}>{pct1(100)}</td>
        </tr>
      </tbody></table></div>
    </div>
  </Bloco>;
}

const FILTROS: { chave: CicloRenovacao | "todos"; label: string }[] = [
  { chave: "todos", label: "Todos" },
  { chave: "a_vencer_120d", label: "Até 120 Dias" },
  { chave: "a_vencer_12m", label: "De 121 Dias a 12 Meses" },
  { chave: "vigente", label: "Acima de 12 Meses" },
];

export function Renovacoes({ linhas }: { linhas: any[] }) {
  const base = useMemo(() => baseRenovacoes(linhas), [linhas]);
  const [filtro, setFiltro] = useState<CicloRenovacao | "todos">("todos");
  const lista = filtro === "todos" ? base.lista : base.lista.filter((c) => c.ciclo === filtro);
  const top10Pct = base.total ? (base.top10Valor / base.total) * 100 : 0;
  const curva = base.top10.map((c) => ({ ...c, rotulo: `${c.unidades} · ${c.locatario}` }));

  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Quadro label="Receita Mensal Vigente (R$)" valor={brl(base.total)} dica={DICA_VALOR_VIGENTE} />
      <Quadro label="Contratos Ativos" valor={String(base.nContratos)} />
      <Quadro label="Vencem em até 120 Dias (R$)" valor={brl(base.vencem120.valor)} dica={`${base.vencem120.n} ${base.vencem120.n === 1 ? "contrato" : "contratos"}`} />
      <Quadro label="Maiores 10 Contratos (% da receita)" valor={pct1(top10Pct)} dica={brl(base.top10Valor)} />
    </div>

    <Bloco titulo="Curva ABC de Renovação por Valor de Contrato">
      <div className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={curva} layout="vertical" margin={{ left: 8, right: 150 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="rotulo" width={260} tick={{ fontSize: 11, fill: CORES.texto }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(v: number, _n, item: any) => {
                const c = item.payload as ContratoRenovacao & { rotulo: string };
                return [`${brl(v)} · ${pct1(c.pct)} da receita · ${pct1(c.pctAcum)} acumulado · Classe ${c.classe} · Vencimento ${dt(c.fim)}`, c.rotulo];
              }}
            />
            <Bar dataKey="valor" radius={[0, 2, 2, 0]}>
              {curva.map((c) => <Cell key={c.contrato_id} fill={CICLO_COR[c.ciclo]} />)}
              <LabelList dataKey="valor" position="right" formatter={(_v: number, item: any) => `${brl(item?.valor ?? _v)} · ${pct1(item?.pctAcum ?? 0)} acumulado`} style={{ fontSize: 10, fill: CORES.texto }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Bloco>

    <Bloco titulo="Contratos por Valor e Vencimento" acao={<div className="flex flex-wrap gap-1">
      {FILTROS.map((f) => <Button key={f.chave} size="sm" variant={filtro === f.chave ? "default" : "outline"} onClick={() => setFiltro(f.chave)}>{f.label}</Button>)}
    </div>}>
      <div className="overflow-x-auto"><table className={cn(tableClasses.table, "zen-wide")}><thead><tr className={tableClasses.head}>
        <th className={thR}>#</th>
        <th className={tableClasses.th}>Unidade</th>
        <th className={tableClasses.th}>Locatário</th>
        <th className={thR} title={DICA_VALOR_VIGENTE}>Valor Mensal Vigente (R$)</th>
        <th className={thR}>% da Receita</th>
        <th className={thR}>% Acumulado</th>
        <th className={tableClasses.th}>Classe</th>
        <th className={tableClasses.th}>Vencimento</th>
        <th className={thR}>Dias para o Fim</th>
        <th className={tableClasses.th}>Ciclo</th>
      </tr></thead><tbody>
        {lista.map((c) => {
          const pos = base.lista.indexOf(c) + 1;
          return <tr key={c.contrato_id}>
            <td className={tableClasses.num}>{pos}</td>
            <td className={cn(tableClasses.td, "font-medium zen-un")}>{c.unidades}</td>
            <td className={cn(tableClasses.td, "zen-txt")}>{c.locatario}</td>
            <td className={tableClasses.num} title={DICA_VALOR_VIGENTE}>{brl(c.valor)}</td>
            <td className={tableClasses.num}>{pct1(c.pct)}</td>
            <td className={tableClasses.num}>{pct1(c.pctAcum)}</td>
            <td className={tableClasses.td}>{c.classe}</td>
            <td className={cn(tableClasses.td, "tabular-nums")}>{dt(c.fim)}</td>
            <td className={tableClasses.num}>{c.dias ?? "—"}</td>
            <td className={tableClasses.td}><span className={cn("op-tag", CICLO_TAG[c.ciclo])}>{CICLO_LABEL[c.ciclo]}</span></td>
          </tr>;
        })}
        <tr className="font-medium">
          <td className={tableClasses.td} colSpan={3}>Total</td>
          <td className={tableClasses.num} title={DICA_VALOR_VIGENTE}>{brl(lista.reduce((s, c) => s + c.valor, 0))}</td>
          <td className={tableClasses.num}>{pct1(base.total ? (lista.reduce((s, c) => s + c.valor, 0) / base.total) * 100 : 0)}</td>
          <td className={tableClasses.td} colSpan={5}></td>
        </tr>
      </tbody></table></div>
    </Bloco>
  </div>;
}
