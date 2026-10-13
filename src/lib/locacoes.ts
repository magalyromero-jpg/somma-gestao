export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const formatoPagamentoPermitido = (nome: string) => /\.(xlsx|xls|csv)$/i.test(nome);

export const brl = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num2 = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const mil = (n: number) => (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
export const dt = (s: string | null | undefined) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "—");
export const m2 = (n: number | null | undefined) => (n == null ? "—" : `${num2(n)} m²`);
export const pct = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : `${num2(n)}%`);
export const indiceLabel = (i: string | null | undefined) =>
  i === "MEDIA" ? "Média IPCA/IGP-M" : i === "IGPM" ? "IGP-M" : i === "FIXO" ? "Fixo" : i === "NENHUM" ? "Nenhum" : i ?? "—";

/** "YYYY-MM" somado de n meses */
export function addMes(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Taxa de reajuste projetada para o mês m do ano: ((13−m)/12)·F[ano−1] + ((m−1)/12)·F[ano] + ajuste */
export function taxaProjetada(focus: Record<number, number>, ano: number, m: number, ajuste = 0) {
  const ant = focus[ano - 1] ?? focus[ano] ?? 0;
  const atual = focus[ano] ?? ant;
  return ((13 - m) / 12) * ant + ((m - 1) / 12) * atual + ajuste;
}

export type ContratoProj = {
  contrato_id: string;
  valor_vigente: number;
  indice: string | null;
  mes_reajuste: number | null;
  retencao_pct: number | null;
  degraus: { a_partir: string; valor_mensal: number }[];
  renovacao?: { em: string; valor: number } | null;
};

/**
 * Projeta o valor de referência mês a mês (chave YYYY-MM) a partir do mês seguinte a `desde` até `ate`.
 * Retorna o valor de caixa por mês (boleto do mês M paga a referência M−1; retenção aplicada).
 */
export function projetarContrato(
  c: ContratoProj,
  desde: string,
  ate: string,
  focus: { IPCA: Record<number, number>; IGPM: Record<number, number> },
  ajuste = 0,
) {
  const ref = new Map<string, number>();
  let valor = Number(c.valor_vigente ?? 0);
  const degraus = new Map(c.degraus.map((d) => [d.a_partir.slice(0, 7), Number(d.valor_mensal)]));
  for (let k = addMes(desde, 1); k <= ate; k = addMes(k, 1)) {
    const [y, m] = k.split("-").map(Number);
    if (c.renovacao && c.renovacao.em.slice(0, 7) === k) valor = c.renovacao.valor;
    else if (degraus.has(k)) valor = degraus.get(k)!;
    else if (c.mes_reajuste === m && valor > 0 && ["IPCA", "IGPM", "MEDIA"].includes(c.indice ?? "")) {
      const t =
        c.indice === "MEDIA"
          ? (taxaProjetada(focus.IPCA, y, m, ajuste) + taxaProjetada(focus.IGPM, y, m, ajuste)) / 2
          : taxaProjetada(focus[c.indice as "IPCA" | "IGPM"], y, m, ajuste);
      valor = valor * (1 + t / 100);
    }
    ref.set(k, valor);
  }
  const ret = 1 - Number(c.retencao_pct ?? 0) / 100;
  const caixa = new Map<string, number>();
  for (const [k, v] of ref) caixa.set(addMes(k, 1), v * ret);
  return { ref, caixa };
}
