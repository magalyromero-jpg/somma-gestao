import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MESES_LONGOS, brl, dt, num2 } from "@/lib/locacoes";
import { previsaoCaixa, ROTULOS_PREVISAO, type ComposicaoPrevisao, type RecebimentoMes } from "@/lib/controleRecebimentos";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const db = supabase as any;
const nomeMes = (mes: string) => { const n = MESES_LONGOS[Number(mes.slice(5, 7)) - 1]; return `${n.charAt(0).toUpperCase()}${n.slice(1, 3)}/${mes.slice(0, 4)}`; };
const RODAPE: [keyof ComposicaoPrevisao, string][] = [["boleto_emitido", "Boleto Emitido"], ["vencido", "Vencido"], ["a_emitir", "A Emitir"], ["fora_do_boleto", "Fora do Boleto"], ["pago_no_boleto", "Pago no Boleto (Aguardando Importar)"]];
const c = (n: number) => Math.round(n * 100);
const Valor = ({ v }: { v: number }) => <td className="text-right tabular-nums">{v ? num2(v) : "—"}</td>;

function Celula({ valor, linha, dia }: { valor: number; linha: RecebimentoMes | null; dia?: number | null }) {
  if (!valor) return <td className="text-right text-muted-foreground">—</td>;
  if (!linha) linha = { contrato_id: "", mes: "", recebido: 0, a_receber: 0, situacao: null, valor_boleto: 0 };
  const sit = ROTULOS_PREVISAO[linha.situacao ?? "sem_boleto"];
  const vence = dia ? dt(`${linha.mes.slice(0, 7)}-${String(dia).padStart(2, "0")}`) : null;
  const dif = linha.valor_boleto > 0 && Math.abs(linha.valor_boleto - valor) > 2;
  return <td className="text-right tabular-nums">
    <Tooltip><TooltipTrigger asChild><span tabIndex={0}>{num2(valor)}</span></TooltipTrigger>
      <TooltipContent><div className="space-y-1">
        <p>{linha.a_receber > 0 ? sit : "Sem pendência no mês"}</p>
        {linha.recebido > 0 && <p>Já recebido: {brl(linha.recebido)}</p>}
        {linha.valor_boleto > 0 && <p>Boleto: {brl(linha.valor_boleto)}{vence ? `, vence em ${vence}` : ""}</p>}
        {!linha.valor_boleto && vence && <p>Vencimento: {vence}</p>}
        {dif && <p>Boleto difere do contrato em {brl(linha.valor_boleto - valor)}; a grade mostra o valor do contrato.</p>}
      </div></TooltipContent></Tooltip>
  </td>;
}

export function ControleRecebimentos({ data }: { data: any; ano?: number; outras?: any[] }) {
  const edificio = data.edificio.id;
  const hoje = new Date();
  const atual = hoje.toISOString().slice(0, 7);
  const ano = hoje.getFullYear();
  const { data: q, error, isLoading } = useQuery({
    queryKey: ["loc-controle-recebimentos", edificio, "previsao", ano], staleTime: Infinity,
    queryFn: async () => {
      const rs = await Promise.all([
        db.rpc("loc_controle_recebimentos", { p_edificio: edificio, p_ano: ano }),
        db.rpc("loc_controle_recebimentos", { p_edificio: edificio, p_ano: ano + 1 }),
        db.from("loc_contratos").select("id,dia_vencimento,data_saida").eq("edificio_id", edificio),
        db.rpc("loc_planejamento_outras", { p_edificio: edificio, p_ano: ano }),
        db.rpc("loc_planejamento_outras", { p_edificio: edificio, p_ano: ano + 1 }),
        db.rpc("loc_esperado_caixa", { p_edificio: edificio, p_ano: ano }),
        db.rpc("loc_esperado_caixa", { p_edificio: edificio, p_ano: ano + 1 }),
      ]);
      for (const r of rs) if (r.error) throw r.error;
      const conv = (r: any): RecebimentoMes => ({ ...r, mes: String(r.mes).slice(0, 10), recebido: Number(r.recebido), a_receber: Number(r.a_receber), valor_boleto: Number(r.valor_boleto) });
      return { linhas: [...(rs[0].data ?? []), ...(rs[1].data ?? [])].map(conv), contratos: rs[2].data ?? [], outras: [...(rs[3].data ?? []), ...(rs[4].data ?? [])], esperado: [...(rs[5].data ?? []), ...(rs[6].data ?? [])] as any[] };
    },
  });
  const p = previsaoCaixa(q?.linhas ?? [], q?.contratos ?? [], atual);
  const info = (id: string) => data.contratosInfo.find((x: any) => x.id === id);
  const ativos = new Set((q?.contratos ?? []).filter((x: any) => !x.data_saida || x.data_saida.slice(0, 7) >= atual).map((x: any) => x.id));
  const valores = new Map<string, number[]>();
  for (const e of q?.esperado ?? []) {
    if (!ativos.has(e.contrato_id)) continue;
    const k = p.meses.indexOf(String(e.mes).slice(0, 10)); if (k < 0) continue;
    const arr = valores.get(e.contrato_id) ?? p.meses.map(() => 0); arr[k] = (c(arr[k]) + c(Number(e.valor))) / 100; valores.set(e.contrato_id, arr);
  }
  const linhaDe = (id: string, mes: string) => (q?.linhas ?? []).find((l) => l.contrato_id === id && l.mes === mes) ?? null;
  const ids = [...valores.keys()].filter((id) => valores.get(id)!.some(Boolean)).sort((a, b) => String(info(a)?.unidades ?? "").localeCompare(String(info(b)?.unidades ?? ""), "pt-BR", { numeric: true }));
  const outrasMes = p.meses.map((m) => (q?.outras ?? []).filter((o: any) => String(o.mes).slice(0, 7) === m.slice(0, 7)).reduce((s: number, o: any) => s + c(Number(o.emitido)), 0) / 100);
  const colunas = p.meses.map((_, i) => (ids.reduce((s, id) => s + c(valores.get(id)![i]), 0) + c(outrasMes[i])) / 100);
  const fimAno = p.meses.filter((m) => m.startsWith(String(ano))).length;
  const somaC = (v: number[]) => v.reduce((s, x) => s + c(x), 0) / 100;
  const previsto = somaC(colunas.slice(0, fimAno));
  const geral = somaC(colunas);
  const cards = [["Previsão do Mês", colunas[0]], ["Previsão até 31/12", previsto], ["Previsão dos 12 Meses", geral], ["A Emitir", p.composicao.a_emitir]] as const;
  return <section className="space-y-4" aria-label="Previsão de Caixa a Partir de Hoje">
    <div className="flex items-baseline gap-3"><h2>Previsão de Caixa a Partir de Hoje</h2><span className="text-muted-foreground">{dt(hoje.toISOString())}</span></div>
    {error ? <p role="alert" className="text-destructive">Não foi possível consultar a previsão: {error.message}</p> : isLoading ? <p>Carregando…</p> : <>
      <div className="portal-kpis">{cards.map(([l, v]) => <div key={l} className="portal-kpi"><div className="portal-kpi-label">{l}</div><div className="portal-kpi-value">{brl(v)}</div></div>)}</div>
      <table className="receb-grid" aria-label="Previsão de caixa por contrato">
        <thead><tr><th>Unidade</th><th>Locatário</th>{p.meses.map((m) => <th key={m} className="text-right">{nomeMes(m)}</th>)}<th className="text-right">Total</th></tr></thead>
        <tbody>{ids.map((id) => {
          const v = valores.get(id)!;
          const dia = q?.contratos.find((x: any) => x.id === id)?.dia_vencimento;
          return <tr key={id}><td>{info(id)?.unidades || "—"}</td><td>{info(id)?.locatario || "—"}</td>
            {v.map((x, i) => <Celula key={i} valor={x} linha={linhaDe(id, p.meses[i])} dia={dia} />)}<td className="text-right tabular-nums font-medium">{num2(somaC(v))}</td></tr>;
        })}</tbody>
        <tfoot>
          <tr><td>Outras Receitas</td><td>Heliponto e demais</td>{outrasMes.map((v, i) => <Valor key={i} v={v} />)}<Valor v={outrasMes.reduce((s, v) => s + c(v), 0) / 100} /></tr>
          <tr className="font-semibold"><td>Total a Receber</td><td></td>{colunas.map((v, i) => <Valor key={i} v={v} />)}<Valor v={geral} /></tr>
        </tfoot>
      </table>
      <div className="space-y-1 text-sm" aria-label="Composição do mês atual">
        <h3 className="font-semibold">Composição de {nomeMes(p.meses[0])}</h3>
        {RODAPE.map(([k, l]) => <div key={k} className="flex justify-between border-b py-1"><span>{l}</span><span className="tabular-nums">{num2(p.composicao[k])}</span></div>)}
        <div className="flex justify-between py-1"><span>Outras Receitas</span><span className="tabular-nums">{num2(outrasMes[0])}</span></div>
        <div className="flex justify-between py-1 font-semibold"><span>Total do Mês</span><span className="tabular-nums">{num2(colunas[0])}</span></div>
      </div>
    </>}
  </section>;
}
