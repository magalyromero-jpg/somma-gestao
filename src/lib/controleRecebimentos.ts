export type SituacaoRecebimento = "boleto_emitido" | "vencido" | "pago_no_boleto" | "sem_boleto" | "sem_registro" | "fora_do_boleto";
export type RecebimentoMes = { contrato_id: string; mes: string; recebido: number; a_receber: number; situacao: SituacaoRecebimento | null; valor_boleto: number };
export const ROTULOS_RECEBIMENTO: Record<SituacaoRecebimento, string> = {
  boleto_emitido: "Boleto Emitido", vencido: "Vencido", pago_no_boleto: "Pago no Boleto (aguardando importar)",
  sem_boleto: "Sem Boleto", sem_registro: "Sem Registro", fora_do_boleto: "Fora do Boleto",
};
export const centavos = (valor: number) => Math.round(valor * 100);
export function saldoReceber(esperado: number, pago: number) {
  const saldo = Math.max(centavos(esperado) - centavos(pago), 0);
  return saldo > 200 ? saldo / 100 : 0;
}
export type Composicao = { recebido: number; pago_no_boleto: number; boleto_emitido: number; vencido: number; sem_boleto: number; fora_do_boleto: number; total: number; a_receber: number };
const vazio = (): Composicao => ({ recebido: 0, pago_no_boleto: 0, boleto_emitido: 0, vencido: 0, sem_boleto: 0, fora_do_boleto: 0, total: 0, a_receber: 0 });
export function totaisRecebimentos(linhas: RecebimentoMes[]) {
  const meses = Array.from({ length: 12 }, vazio);
  for (const l of linhas) {
    const i = Number(l.mes.slice(5, 7)) - 1;
    if (!meses[i]) continue;
    const t = meses[i];
    t.recebido += centavos(l.recebido);
    const saldo = centavos(l.a_receber);
    const grupo = l.situacao === "sem_registro" || !l.situacao ? "sem_boleto" : l.situacao;
    t[grupo] += saldo;
    t.a_receber += saldo;
    t.total += centavos(l.recebido) + saldo;
  }
  const ano = vazio();
  for (const t of meses) for (const k of Object.keys(t) as (keyof Composicao)[]) { ano[k] += t[k]; t[k] /= 100; }
  for (const k of Object.keys(ano) as (keyof Composicao)[]) ano[k] /= 100;
  return { meses, ano };
}

// Other revenues reuse the cash-flow realized rows (including already deduplicated late fees).
export function outrasRecebimentos(outrasReal: { un: string; real: (number | null)[] }[], boletos: { outra_receita: string; mes: string; emitido: number }[], ano: number, atual: string) {
  const nomes = [...new Set([...outrasReal.map((o) => o.un), ...boletos.filter((b) => Number(b.emitido) > 0 && b.mes.slice(0, 7) >= atual).map((b) => b.outra_receita)])];
  return nomes.map((nome) => ({ nome, meses: Array.from({ length: 12 }, (_, i): RecebimentoMes => {
    const mes = `${ano}-${String(i + 1).padStart(2, "0")}-01`;
    return { contrato_id: `outra:${nome}`, mes, recebido: outrasReal.filter((o) => o.un === nome).reduce((s, o) => s + Number(o.real[i] ?? 0), 0),
      a_receber: mes.slice(0, 7) >= atual ? boletos.filter((b) => b.outra_receita === nome && b.mes.slice(0, 7) === mes.slice(0, 7)).reduce((s, b) => s + Number(b.emitido), 0) : 0,
      situacao: "boleto_emitido", valor_boleto: 0 };
  }) })).filter((o) => o.meses.some((m) => m.recebido || m.a_receber));
}