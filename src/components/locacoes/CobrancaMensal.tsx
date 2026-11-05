import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bloco } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { cn } from "@/lib/utils";
import { MESES, brl, num2 } from "@/lib/locacoes";
import {
  CLASSE_SITUACAO,
  SITUACOES_COBRANCA,
  gradeCobranca,
  totaisCobranca,
  type CobrancaMes,
  type SituacaoCobranca,
  type TotaisCobranca,
} from "@/lib/cobrancaMensal";

const db = supabase as any;
const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
const LEGENDA: SituacaoCobranca[] = [
  "recebido", "parcial", "pago_no_boleto", "boleto_emitido", "vencido", "sem_boleto", "sem_registro", "fora_do_boleto",
];
const RODAPE: [string, (t: TotaisCobranca) => number, string?][] = [
  ["Total Esperado", (t) => t.esperado],
  ["Boleto Emitido", (t) => t.boletoEmitido, "Boleto Emitido, Pago no Boleto e Vencido."],
  ["Sem Boleto", (t) => t.semBoleto, "Sem Boleto e Sem Registro."],
  ["Fora do Boleto", (t) => t.fora, "Contratos que não pagam por boleto."],
];

const dicaCelula = (l: CobrancaMes) =>
  `${SITUACOES_COBRANCA[l.situacao]}\nEsperado: ${brl(l.esperado)}\nRecebido: ${brl(l.recebido)}\nBoleto a Vencer: ${brl(l.boleto_a_vencer)}\nBoleto Vencido: ${brl(l.boleto_vencido)}\nBoleto Pago: ${brl(l.boleto_pago)}`;

export function CobrancaMensal({ edificio, ano, info }: { edificio: string; ano: number; info: Map<string, any> }) {
  const { data: linhas, error } = useQuery({
    queryKey: ["loc-cobranca", edificio, ano],
    queryFn: async () => {
      const r = await db.rpc("loc_cobranca_mensal", { p_edificio: edificio, p_ano: ano });
      if (r.error) throw r.error;
      return ((r.data ?? []) as any[]).map((x) => ({
        contrato_id: x.contrato_id,
        mes: String(x.mes),
        esperado: Number(x.esperado),
        recebido: Number(x.recebido),
        boleto_a_vencer: Number(x.boleto_a_vencer),
        boleto_vencido: Number(x.boleto_vencido),
        boleto_pago: Number(x.boleto_pago),
        situacao: x.situacao as SituacaoCobranca,
      })) as CobrancaMes[];
    },
  });

  const dados = linhas ?? [];
  const grade = gradeCobranca(dados);
  const { meses: totMes, ano: totAno } = totaisCobranca(dados);
  const hoje = new Date();
  const mesDestaque = ano === hoje.getFullYear() ? hoje.getMonth() : -1;
  const ordem = [...grade.keys()].sort((a, b) =>
    String(info.get(a)?.unidades ?? "").localeCompare(String(info.get(b)?.unidades ?? ""), "pt-BR", { numeric: true }));
  const anoContrato = (id: string) => (grade.get(id) ?? []).reduce((t, l) => t + (l?.esperado ?? 0), 0);

  if (error) {
    return <Bloco titulo="Cobrança Mensal por Contrato">
      <p role="alert" className="text-sm text-destructive">Não foi possível consultar a cobrança mensal: {error.message}</p>
    </Bloco>;
  }
  if (!linhas) {
    return <Bloco titulo="Cobrança Mensal por Contrato"><p className="text-sm text-muted-foreground">Carregando…</p></Bloco>;
  }

  return <Bloco titulo="Cobrança Mensal por Contrato">
    <div className="mb-3 flex flex-wrap gap-2">
      {LEGENDA.map((s) => <span key={s} className={cn("cob-sit", CLASSE_SITUACAO[s])}>{SITUACOES_COBRANCA[s]}</span>)}
    </div>
    <table className={cn(tableClasses.table, "cob-grid")}>
      <thead><tr className={tableClasses.head}>
        <th className={tableClasses.th}>Unidade</th>
        <th className={tableClasses.th}>Locatário</th>
        {MESES.map((m, i) => (
          <th key={m} className={cn(tableClasses.th, "text-right", i === mesDestaque && "cob-atual")}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </th>
        ))}
        <th className={cn(tableClasses.th, "text-right")}>Ano</th>
      </tr></thead>
      <tbody>
        {ordem.map((id) => {
          const c = info.get(id);
          const arr = grade.get(id)!;
          return <tr key={id}>
            <td className={cn(tableClasses.td, "whitespace-nowrap")}>{c?.unidades ?? "—"}</td>
            <td className={cn(tableClasses.td, "cob-locatario")} title={c?.locatario ?? undefined}>{c?.locatario ?? "—"}</td>
            {arr.map((l, i) => <td key={i} className={cn(tableClasses.num, i === mesDestaque && "cob-atual")}>
              {!l || l.situacao === "sem_cobranca"
                ? <span className="text-muted-foreground">—</span>
                : <span className={cn("cob-sit", CLASSE_SITUACAO[l.situacao])} title={dicaCelula(l)}>{inteiro(l.esperado)}</span>}
            </td>)}
            <td className={cn(tableClasses.num, "font-medium")}>{brl(anoContrato(id))}</td>
          </tr>;
        })}
        {RODAPE.map(([rotulo, valor, dica], ri) => <tr key={rotulo} className={ri === 0 ? "font-semibold" : undefined}>
          <td className={tableClasses.td} colSpan={2} title={dica}>{rotulo}</td>
          {totMes.map((t, i) => <td key={i} title={brl(valor(t))} className={cn(tableClasses.num, "cob-total-mes", i === mesDestaque && "cob-atual")}>{num2(valor(t))}</td>)}
          <td className={tableClasses.num}>{brl(valor(totAno))}</td>
        </tr>)}
      </tbody>
    </table>
  </Bloco>;
}
