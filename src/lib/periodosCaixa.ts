import { MESES } from "./locacoes";

export const PERIODOS_CAIXA = [
  { v: "ano", label: "Todos os meses" },
  ...MESES.map((m, i) => ({ v: `m${i + 1}`, label: m.charAt(0).toUpperCase() + m.slice(1) })),
  { v: "ytd", label: "Acumulado importado" },
  ...[1, 2, 3, 4].map((q) => ({ v: `t${q}`, label: `${q}º trimestre` })),
  { v: "s1", label: "1º semestre" },
  { v: "s2", label: "2º semestre" },
];

/** Meses exibidos são independentes da janela de pagamentos importados. */
export function mesesPeriodoCaixa(periodo: string, ultimoMes: number): number[] {
  const ano = Array.from({ length: 12 }, (_, i) => i + 1);
  if (periodo === "ytd") return ano.filter((m) => m <= ultimoMes);
  if (/^m([1-9]|1[0-2])$/.test(periodo)) return [Number(periodo.slice(1))];
  if (/^t[1-4]$/.test(periodo)) {
    const inicio = (Number(periodo.slice(1)) - 1) * 3 + 1;
    return [inicio, inicio + 1, inicio + 2];
  }
  if (periodo === "s1") return ano.slice(0, 6);
  if (periodo === "s2") return ano.slice(6);
  return ano;
}

export function valoresPeriodoCaixa<T>(valores: T[], meses: number[]): T[] {
  return meses.map((m) => valores[m - 1]);
}