import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MESES_LONGOS, brl, dt, indiceLabel, num2 } from "@/lib/locacoes";
import { outrasRecebimentos, ROTULOS_RECEBIMENTO, totaisRecebimentos, type RecebimentoMes, type Composicao } from "@/lib/controleRecebimentos";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const db = supabase as any;
const tituloMes = (i: number) => MESES_LONGOS[i].charAt(0).toUpperCase() + MESES_LONGOS[i].slice(1);
const RODAPE: [keyof Composicao, string][] = [["total", "Total do Mês"], ["recebido", "Recebido"], ["pago_no_boleto", "Pago no Boleto (aguardando importar)"], ["boleto_emitido", "Boleto Emitido"], ["vencido", "Vencido"], ["sem_boleto", "Sem Boleto"], ["fora_do_boleto", "Fora do Boleto"]];
const total = (m: RecebimentoMes) => m.recebido + m.a_receber;
const soma = (meses: RecebimentoMes[]) => meses.reduce((s, m) => s + Math.round(total(m) * 100), 0) / 100;

function Celula({ linha, esperado, contrato }: { linha?: RecebimentoMes; esperado?: number; contrato?: any }) {
  if (!linha || !total(linha)) return <td className="text-right text-muted-foreground">—</td>;
  const misto = linha.recebido > 0 && linha.a_receber > 0;
  const diferente = esperado != null && Math.abs(total(linha) - esperado) > 2;
  const dia = contrato?.dia_vencimento;
  const vence = dia ? dt(`${linha.mes.slice(0, 7)}-${String(dia).padStart(2, "0")}`) : null;
  const motivo = diferente ? (contrato?.data_saida ? `Saída em ${dt(contrato.data_saida)}; recebimentos podem corresponder a outros vencimentos.` : linha.recebido > 0 && linha.a_receber > 0 ? "Pagamento parcial e saldo pendente." : "Diferença para o contrato: desconto, acréscimo ou pagamento de outro vencimento não discriminado nos dados.") : "";
  const dica = [`Recebido: ${brl(linha.recebido)}`, `A Receber: ${brl(linha.a_receber)}`, linha.situacao && linha.a_receber ? `${ROTULOS_RECEBIMENTO[linha.situacao]}: ${brl(linha.valor_boleto || linha.a_receber)}${vence ? `, vence em ${vence}` : ""}` : "", esperado != null ? `Valor contratual no mês: ${brl(esperado)}` : "", motivo].filter(Boolean);
  return <td className={cn("text-right", diferente && "receb-excecao")}>
    <Tooltip><TooltipTrigger asChild><span tabIndex={0} className={cn("receb-valor", linha.a_receber > 0 ? "receb-pendente" : "receb-recebido")}>
      {linha.a_receber > 0 && <span aria-hidden="true" className={cn("receb-marca", `receb-${linha.situacao ?? "sem_boleto"}`)} />}
      {num2(total(linha))}
    </span></TooltipTrigger><TooltipContent><div className="space-y-1">{dica.map((d) => <p key={d}>{d}</p>)}{misto && <p>Recebido + A Receber</p>}</div></TooltipContent></Tooltip>
  </td>;
}

export function ControleRecebimentos({ data, ano, outras }: { data: any; ano: number; outras: any[] }) {
  const edificio = data.edificio.id;
  const { data: q, error, isLoading } = useQuery({
    queryKey: ["loc-controle-recebimentos", edificio, ano], staleTime: Infinity,
    queryFn: async () => {
      const rs = await Promise.all([
        db.rpc("loc_controle_recebimentos", { p_edificio: edificio, p_ano: ano }),
        db.rpc("loc_esperado_caixa", { p_edificio: edificio, p_ano: ano }),
        db.from("loc_contratos").select("id,dia_vencimento,indice,mes_reajuste,data_saida").eq("edificio_id", edificio),
        db.from("loc_contratos_notas").select("contrato_id,nota").eq("edificio_id", edificio),
      ]);
      for (const r of rs) if (r.error) throw r.error;
      return { linhas: (rs[0].data ?? []).map((r: any): RecebimentoMes => ({ ...r, recebido: Number(r.recebido), a_receber: Number(r.a_receber), valor_boleto: Number(r.valor_boleto) })), esperado: rs[1].data ?? [], contratos: rs[2].data ?? [], notas: rs[3].data ?? [] };
    },
  });
  const atual = new Date().toISOString().slice(0, 7);
  const avulsas = outrasRecebimentos(data.realizado.outras, outras, ano, atual);
  const linhas: RecebimentoMes[] = q?.linhas ?? [];
  const ids = [...new Set(linhas.filter((l) => total(l) > 0).map((l) => l.contrato_id))].sort((a, b) => String(data.contratosInfo.find((c: any) => c.id === a)?.unidades ?? "").localeCompare(String(data.contratosInfo.find((c: any) => c.id === b)?.unidades ?? ""), "pt-BR", { numeric: true }));
  const t = totaisRecebimentos([...linhas, ...avulsas.flatMap((o) => o.meses)]);
  const cards = [["Recebido no Ano", t.ano.recebido, "Pagamentos líquidos por mês de pagamento, receitas avulsas e encargos deduplicados, iguais ao Fluxo de Caixa."], ["A Receber no Ano", t.ano.a_receber, "Saldo por vencimento acima de R$ 2,00, com saída proporcional."], [`Total Esperado ${ano}`, t.ano.total, "Recebido + A Receber."], ["Sem Boleto (a emitir)", t.ano.sem_boleto, "Pendências sem boleto, incluindo meses passados sem registro."]] as const;
  const saidas = (data.previsto ?? []).reduce((s: number, p: any) => { const e = q?.esperado.find((x: any) => x.contrato_id === p.contrato_id && x.mes === p.mes); return s + (e ? Number(p.valor) - Number(e.valor) : 0); }, 0);
  return <section className="space-y-4" aria-label="Controle de Recebimentos">
    <h2>Controle de Recebimentos</h2>
    {error ? <p role="alert" className="text-destructive">Não foi possível consultar os recebimentos: {error.message}</p> : isLoading ? <p>Carregando…</p> : <>
      <div className="portal-kpis">{cards.map(([l,v,d]) => <div key={l} className="portal-kpi" title={d}><div className="portal-kpi-label">{l}</div><div className="portal-kpi-value">{brl(v)}</div></div>)}</div>
      <table className="receb-grid" aria-label="Controle de Recebimentos por contrato">
        <thead><tr><th>Unidade</th><th>Locatário</th><th>Vencimento<br/>Boleto</th><th>Índice de<br/>Reajuste</th><th>Data de<br/>Reajuste</th>{MESES_LONGOS.map((m,i) => <th key={m} className="text-right">{tituloMes(i)}</th>)}<th className="text-right">Total {ano}</th><th>Obs</th></tr></thead>
        <tbody>{ids.map((id) => {
          const info = data.contratosInfo.find((c: any) => c.id === id);
          const contrato = q?.contratos.find((c: any) => c.id === id);
          const arr = linhas.filter((l) => l.contrato_id === id);
          const nota = q?.notas.find((n: any) => n.contrato_id === id)?.nota;
          return <tr key={id}><td>{info?.unidades || "—"}</td><td>{info?.locatario || "—"}</td><td>{contrato?.dia_vencimento ?? "—"}</td><td>{indiceLabel(contrato?.indice)}</td><td>{contrato?.mes_reajuste ? tituloMes(contrato.mes_reajuste - 1) : "—"}</td>
            {MESES_LONGOS.map((_,i) => { const mes = `${ano}-${String(i+1).padStart(2,"0")}-01`; const e = q?.esperado.find((x: any) => x.contrato_id === id && x.mes === mes); return <Celula key={mes} linha={arr.find((l) => l.mes === mes)} esperado={e ? Number(e.valor) : undefined} contrato={contrato}/>; })}
            <td className="text-right font-medium">{num2(soma(arr))}</td><td className="receb-nota">{nota || "—"}</td></tr>;
        })}
        {avulsas.length > 0 && <tr className="receb-grupo"><td colSpan={19}>Outras Receitas</td></tr>}
        {avulsas.map((o) => <tr key={o.nome}><td colSpan={2}>{o.nome}</td><td>—</td><td>—</td><td>—</td>{o.meses.map((l) => <Celula key={l.mes} linha={l}/>)}<td className="text-right">{num2(soma(o.meses))}</td><td>—</td></tr>)}
        </tbody><tfoot>{RODAPE.map(([k,l]) => <tr key={k} data-total={k} className={k === "total" ? "font-semibold" : undefined}><td colSpan={5}>{l}</td>{t.meses.map((m,i) => <td key={i} className={cn("text-right", k === "recebido" && "receb-recebido")}>{m[k] ? num2(m[k]) : "—"}</td>)}<td className="text-right">{num2(t.ano[k])}</td><td>—</td></tr>)}</tfoot>
      </table>
      <div className="flex justify-between gap-4 border-t py-3 text-sm"><span>Saídas (Diferença para o Reforecast)</span><span className="tabular-nums">{brl(saidas)}</span></div>
    </>}
  </section>;
}