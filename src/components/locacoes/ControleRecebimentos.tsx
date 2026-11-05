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

function Celula({ linha, dia }: { linha: RecebimentoMes | null; dia?: number | null }) {
  if (!linha) return <td className="text-right text-muted-foreground">—</td>;
  const sit = ROTULOS_PREVISAO[linha.situacao ?? "sem_boleto"];
  const vence = dia ? dt(`${linha.mes.slice(0, 7)}-${String(dia).padStart(2, "0")}`) : null;
  const dif = linha.valor_boleto > 0 && Math.abs(linha.valor_boleto - linha.a_receber) > 2;
  return <td className="text-right tabular-nums">
    <Tooltip><TooltipTrigger asChild><span tabIndex={0}>{num2(linha.a_receber)}</span></TooltipTrigger>
      <TooltipContent><div className="space-y-1">
        <p>{sit}</p>
        {linha.valor_boleto > 0 && <p>Boleto: {brl(linha.valor_boleto)}{vence ? `, vence em ${vence}` : ""}</p>}
        {!linha.valor_boleto && vence && <p>Vencimento: {vence}</p>}
        {dif && <p>Boleto difere do contrato em {brl(linha.valor_boleto - linha.a_receber)}; a grade mostra o valor do contrato.</p>}
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
      ]);
      for (const r of rs) if (r.error) throw r.error;
      const conv = (r: any): RecebimentoMes => ({ ...r, mes: String(r.mes).slice(0, 10), recebido: Number(r.recebido), a_receber: Number(r.a_receber), valor_boleto: Number(r.valor_boleto) });
      return { linhas: [...(rs[0].data ?? []), ...(rs[1].data ?? [])].map(conv), contratos: rs[2].data ?? [], outras: [...(rs[3].data ?? []), ...(rs[4].data ?? [])] };
    },
  });
  const p = previsaoCaixa(q?.linhas ?? [], q?.contratos ?? [], atual);
  const info = (id: string) => data.contratosInfo.find((x: any) => x.id === id);
  const ids = [...p.contratos.keys()].sort((a, b) => String(info(a)?.unidades ?? "").localeCompare(String(info(b)?.unidades ?? ""), "pt-BR", { numeric: true }));
  const outrasMes = p.meses.map((m) => (q?.outras ?? []).filter((o: any) => String(o.mes).slice(0, 7) === m.slice(0, 7)).reduce((s: number, o: any) => s + c(Number(o.emitido)), 0) / 100);
  const colunas = p.meses.map((_, i) => (ids.reduce((s, id) => s + c(p.contratos.get(id)!.meses[i]?.a_receber ?? 0), 0) + c(outrasMes[i])) / 100);
  const atrasoTotal = ids.reduce((s, id) => s + c(p.contratos.get(id)!.atraso), 0) / 100;
  const fimAno = p.meses.filter((m) => m.startsWith(String(ano))).length;
  const previsto = colunas.slice(0, fimAno).reduce((s, v) => s + c(v), 0) / 100;
  const geral = (colunas.reduce((s, v) => s + c(v), 0) + c(atrasoTotal)) / 100;
  const cards = [["Em Atraso", atrasoTotal, "Boletos vencidos de meses anteriores ainda não pagos."], ["A Receber neste Mês", colunas[0], `Total a receber em ${nomeMes(p.meses[0])}, incluindo outras receitas.`], [`Previsto até 31/12`, previsto, `Soma do a receber de ${nomeMes(p.meses[0])} até Dez/${ano}.`], ["A Emitir", p.composicao.a_emitir, "Contratos ainda sem boleto no mês atual."]] as const;
  return <section className="space-y-4" aria-label="Previsão de Caixa a Partir de Hoje">
    <div className="flex items-baseline gap-3"><h2>Previsão de Caixa a Partir de Hoje</h2><span className="text-muted-foreground">{dt(hoje.toISOString())}</span></div>
    {error ? <p role="alert" className="text-destructive">Não foi possível consultar a previsão: {error.message}</p> : isLoading ? <p>Carregando…</p> : <>
      <div className="portal-kpis">{cards.map(([l, v, d]) => <Tooltip key={l}><TooltipTrigger asChild><div tabIndex={0} className="portal-kpi"><div className="portal-kpi-label">{l}</div><div className="portal-kpi-value">{brl(v)}</div></div></TooltipTrigger><TooltipContent>{d}</TooltipContent></Tooltip>)}</div>
      <table className="receb-grid" aria-label="Previsão de caixa por contrato">
        <thead><tr><th>Unidade</th><th>Locatário</th><th className="text-right">Em Atraso</th>{p.meses.map((m) => <th key={m} className="text-right">{nomeMes(m)}</th>)}<th className="text-right">Total</th></tr></thead>
        <tbody>{ids.map((id) => {
          const r = p.contratos.get(id)!;
          const dia = q?.contratos.find((x: any) => x.id === id)?.dia_vencimento;
          const tot = (r.meses.reduce((s, l) => s + c(l?.a_receber ?? 0), 0) + c(r.atraso)) / 100;
          return <tr key={id}><td>{info(id)?.unidades || "—"}</td><td>{info(id)?.locatario || "—"}</td><Valor v={r.atraso} />
            {r.meses.map((l, i) => <Celula key={i} linha={l} dia={dia} />)}<td className="text-right tabular-nums font-medium">{num2(tot)}</td></tr>;
        })}</tbody>
        <tfoot>
          <tr><td>Outras Receitas</td><td>Heliponto e demais</td><Valor v={0} />{outrasMes.map((v, i) => <Valor key={i} v={v} />)}<Valor v={outrasMes.reduce((s, v) => s + c(v), 0) / 100} /></tr>
          <tr className="font-semibold"><td>Total a Receber</td><td></td><Valor v={atrasoTotal} />{colunas.map((v, i) => <Valor key={i} v={v} />)}<Valor v={geral} /></tr>
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
