// Acompanhamento de IPTU repassado aos locatários: fora do caixa de aluguel.
// Não alimenta Orçado, Reforecast, Realizado, Planejamento do Caixa nem Fluxo de Caixa.

export type IptuForma = "avista" | "parcelado" | "sem_registro" | "proprio";

export interface IptuLinha {
  unidade: string;
  locatario: string | null;
  forma: IptuForma;
  valor_sala: number | null;
  valor_garagem: number | null;
  pago_em: string | null;
  observacao: string | null;
}

export const FORMA_LABEL: Record<IptuForma, string> = {
  avista: "À Vista",
  parcelado: "10 Parcelas",
  sem_registro: "Sem Registro",
  proprio: "Própria",
};

/** A parcela n (1 a 10) vence no dia 15 do mês n + 2 do ano; é devida a partir do dia 16 desse mês. */
export function parcelaDevida(n: number, ano: number, hoje: Date): boolean {
  const vencimento = new Date(ano, n + 1, 15); // mês n + 2 (mês é 0-based)
  const limite = new Date(vencimento.getFullYear(), vencimento.getMonth(), 16);
  return hoje >= limite;
}

/** Lojas primeiro, depois Salas, em ordem numérica. */
export function compararUnidades(a: string, b: string): number {
  const pa = /^(\D+)\s*(\d+)$/.exec(a.trim());
  const pb = /^(\D+)\s*(\d+)$/.exec(b.trim());
  const ta = pa ? pa[1].trim() : a;
  const tb = pb ? pb[1].trim() : b;
  if (ta !== tb) return ta.localeCompare(tb, "pt-BR");
  return (pa ? Number(pa[2]) : 0) - (pb ? Number(pb[2]) : 0);
}

export interface SituacaoIptu {
  texto: string;
  pendentes: number[];
}

/** Situação da unidade: Pago à Vista, Em Dia, "N Parcela(s) Pendente(s)", Sem Registro ou Própria. */
export function situacaoIptu(linha: IptuLinha, pagas: Set<number>, ano: number, hoje: Date): SituacaoIptu {
  if (linha.forma === "avista") return { texto: "Pago à Vista", pendentes: [] };
  if (linha.forma === "sem_registro") return { texto: "Sem Registro", pendentes: [] };
  if (linha.forma === "proprio") return { texto: "Própria", pendentes: [] };
  const pendentes: number[] = [];
  for (let n = 1; n <= 10; n++) if (!pagas.has(n) && parcelaDevida(n, ano, hoje)) pendentes.push(n);
  return {
    texto: pendentes.length === 0 ? "Em Dia" : `${pendentes.length} Parcela${pendentes.length > 1 ? "s" : ""} Pendente${pendentes.length > 1 ? "s" : ""}`,
    pendentes,
  };
}
