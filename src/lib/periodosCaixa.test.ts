import { describe, expect, it } from "vitest";
import { mesesPeriodoCaixa, valoresPeriodoCaixa } from "./periodosCaixa";

describe("filtro mensal do detalhe do caixa", () => {
  it("seleciona cada mês de janeiro a dezembro", () => {
    for (let m = 1; m <= 12; m++) expect(mesesPeriodoCaixa(`m${m}`, 9)).toEqual([m]);
  });
  it("mantém novembro no Orçado e Reforecast mesmo com importação até setembro", () => {
    expect(mesesPeriodoCaixa("m11", 9)).toEqual([11]);
  });
  it("recorta valores e totais ao mesmo mês sem alterar a base", () => {
    const base = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];
    const filtrado = valoresPeriodoCaixa(base, mesesPeriodoCaixa("m7", 9));
    expect(filtrado).toEqual([700]);
    expect(filtrado.reduce((s, v) => s + v, 0)).toBe(700);
    expect(base.reduce((s, v) => s + v, 0)).toBe(7800);
  });
  it("preserva Realizado não importado como nulo", () => {
    expect(valoresPeriodoCaixa([100, null], [2])).toEqual([null]);
  });
  it("mantém os períodos acumulados e todos os meses", () => {
    expect(mesesPeriodoCaixa("ytd", 3)).toEqual([1, 2, 3]);
    expect(mesesPeriodoCaixa("t4", 9)).toEqual([10, 11, 12]);
    expect(mesesPeriodoCaixa("s2", 9)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(mesesPeriodoCaixa("ano", 0)).toHaveLength(12);
  });
});