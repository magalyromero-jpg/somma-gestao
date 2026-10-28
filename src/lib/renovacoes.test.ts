import { describe, expect, it } from "vitest";
import { baseRenovacoes } from "./locacoes";

const linha = (id: string, valor: number, indice: string | null, ciclo: string, fim: string | null = "2028-01-31", dias = 400) => ({
  contrato_id: id, unidades: `Sala ${id}`, locatario: `Loc ${id}`, valor_vigente: valor, indice,
  ciclo: { ciclo, fim_contrato: fim, dias_para_o_fim: fim ? dias : null },
});

describe("baseRenovacoes", () => {
  it("soma o total e ordena por valor, do maior ao menor", () => {
    const b = baseRenovacoes([linha("a", 100, "IPCA", "vigente"), linha("c", 300, "IPCA", "vigente"), linha("b", 200, "IPCA", "vigente")]);
    expect(b.total).toBe(600);
    expect(b.lista.map((c) => c.contrato_id)).toEqual(["c", "b", "a"]);
    expect(b.lista[0].pct).toBeCloseTo(50, 6);
    expect(b.lista[2].pctAcum).toBeCloseTo(100, 6);
  });

  it("agrupa os ciclos com os rótulos da view e junta vencido/sem data", () => {
    const b = baseRenovacoes([
      linha("a", 10, "IPCA", "a_vencer_120d", "2026-12-01", 30),
      linha("b", 20, "IPCA", "a_vencer_12m", "2027-06-01", 200),
      linha("c", 30, "IPCA", "vigente"),
      linha("d", 40, "IPCA", "vencido_sem_renovacao", null),
    ]);
    expect(b.porCiclo.map((c) => [c.chave, c.n, c.valor])).toEqual([
      ["a_vencer_120d", 1, 10], ["a_vencer_12m", 1, 20], ["vigente", 1, 30], ["sem_data", 1, 40],
    ]);
    expect(b.vencem120.n + b.vencem12m.n).toBe(2);
  });

  it("omite o grupo Vencido ou Sem Data quando não há contratos", () => {
    const b = baseRenovacoes([linha("a", 10, "IPCA", "vigente")]);
    expect(b.porCiclo.some((c) => c.chave === "sem_data")).toBe(false);
  });

  it("trata contrato sem índice como Fixo e ordena índices por valor", () => {
    const b = baseRenovacoes([linha("a", 100, null, "vigente"), linha("b", 300, "IPCA", "vigente"), linha("c", 50, "NENHUM", "vigente")]);
    expect(b.porIndice.map((g) => [g.indice, g.n, g.valor])).toEqual([["IPCA", 1, 300], ["FIXO", 2, 150]]);
  });

  it("classifica a curva ABC pelo % acumulado antes de cada contrato (A < 80, B < 95, C restante)", () => {
    const b = baseRenovacoes([linha("a", 70, "IPCA", "vigente"), linha("b", 15, "IPCA", "vigente"), linha("c", 10, "IPCA", "vigente"), linha("d", 5, "IPCA", "vigente")]);
    expect(b.lista.map((c) => c.classe)).toEqual(["A", "A", "B", "C"]);
  });

  it("top 10 soma os maiores contratos e mantém # e % acumulado da lista completa", () => {
    const ls = Array.from({ length: 12 }, (_, i) => linha(String(i + 1), (12 - i) * 100, "IPCA", "vigente"));
    const b = baseRenovacoes(ls);
    expect(b.top10).toHaveLength(10);
    expect(b.top10Valor).toBe((12 + 11 + 10 + 9 + 8 + 7 + 6 + 5 + 4 + 3) * 100);
    const ultimo = b.lista[11];
    expect(ultimo.pctAcum).toBeCloseTo(100, 6);
  });
});
