// Cobrança mensal por contrato: valor esperado do mês x situação do boleto.
// Bloco de acompanhamento da aba Planejamento do Caixa — nunca altera Orçado, Reforecast nem Realizado.

export const SITUACOES_COBRANCA = {
  recebido: "Recebido",
  parcial: "Parcial",
  pago_no_boleto: "Pago no Boleto",
  boleto_emitido: "Boleto Emitido",
  vencido: "Vencido",
  sem_boleto: "Sem Boleto",
  sem_registro: "Sem Registro",
  fora_do_boleto: "Fora do Boleto",
  sem_cobranca: "Sem Cobrança",
} as const;

export type SituacaoCobranca = keyof typeof SITUACOES_COBRANCA;

export const CLASSE_SITUACAO: Record<SituacaoCobranca, string> = {
  recebido: "cob-recebido",
  parcial: "cob-parcial",
  pago_no_boleto: "cob-pago-boleto",
  boleto_emitido: "cob-emitido",
  vencido: "cob-vencido",
  sem_boleto: "cob-sem-boleto",
  sem_registro: "cob-sem-registro",
  fora_do_boleto: "cob-fora",
  sem_cobranca: "",
};

export interface CobrancaMes {
  contrato_id: string;
  mes: string;
  esperado: number;
  recebido: number;
  boleto_a_vencer: number;
  boleto_vencido: number;
  boleto_pago: number;
  situacao: SituacaoCobranca;
}

// Situações que entram em cada linha do rodapé, conforme o desenho aprovado.
export const GRUPO_BOLETO_EMITIDO: readonly SituacaoCobranca[] = ["boleto_emitido", "pago_no_boleto", "vencido"];
export const GRUPO_SEM_BOLETO: readonly SituacaoCobranca[] = ["sem_boleto", "sem_registro"];

const indiceMes = (mes: string) => Number(mes.slice(5, 7)) - 1;

// Uma linha da grade por contrato, com a posição 0..11 correspondente a jan..dez.
export function gradeCobranca(linhas: CobrancaMes[]): Map<string, (CobrancaMes | null)[]> {
  const grade = new Map<string, (CobrancaMes | null)[]>();
  for (const l of linhas) {
    const i = indiceMes(l.mes);
    if (i < 0 || i > 11) continue;
    const arr = grade.get(l.contrato_id) ?? Array<CobrancaMes | null>(12).fill(null);
    arr[i] = l;
    grade.set(l.contrato_id, arr);
  }
  return grade;
}

export interface TotaisCobranca {
  esperado: number;
  boletoEmitido: number;
  semBoleto: number;
  fora: number;
}

const vazio = (): TotaisCobranca => ({ esperado: 0, boletoEmitido: 0, semBoleto: 0, fora: 0 });

export function totaisCobranca(linhas: CobrancaMes[]): { meses: TotaisCobranca[]; ano: TotaisCobranca } {
  const meses = Array.from({ length: 12 }, vazio);
  for (const l of linhas) {
    const i = indiceMes(l.mes);
    if (i < 0 || i > 11) continue;
    const t = meses[i];
    t.esperado += l.esperado;
    if (GRUPO_BOLETO_EMITIDO.includes(l.situacao)) t.boletoEmitido += l.esperado;
    else if (GRUPO_SEM_BOLETO.includes(l.situacao)) t.semBoleto += l.esperado;
    else if (l.situacao === "fora_do_boleto") t.fora += l.esperado;
  }
  const ano = meses.reduce((acc, t) => ({
    esperado: acc.esperado + t.esperado,
    boletoEmitido: acc.boletoEmitido + t.boletoEmitido,
    semBoleto: acc.semBoleto + t.semBoleto,
    fora: acc.fora + t.fora,
  }), vazio());
  return { meses, ano };
}
