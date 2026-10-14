import { describe, expect, it } from "vitest";
import { compararReforecast, motivoReforecast, previstoPorMes } from "./reforecast";

describe("Reforecast contratual", () => {
  const valores = (id: string, meses: number[], numeros: number[]) => meses.map((m, i) => ({ contrato_id: id, mes: `2026-${String(m).padStart(2, "0")}-01`, valor: numeros[i] }));
  it("Sala 1602 mantém previsto de março, abril, julho e agosto, independentemente do realizado", () => {
    expect(previstoPorMes(valores("nac", [3, 4, 7, 8], [25600, 25600, 25600, 16516]), new Set(["nac"]), "2026")).toEqual([0, 0, 25600, 25600, 0, 0, 25600, 16516, 0, 0, 0, 0]);
  });
  it("Salas 1401 + 1402 somam os contratos da mesma unidade", () => {
    const previsto = [...valores("a", [2, 3, 4, 5], [12000, 12000, 12000, 12000]), ...valores("b", [2, 3, 4, 5], [11872, 11872, 11872, 11872])];
    expect(previstoPorMes(previsto, new Set(["a", "b"]), "2026")).toEqual([0, 23872, 23872, 23872, 23872, 0, 0, 0, 0, 0, 0, 0]);
  });
  it("Sala 902 conserva todos os degraus de julho a novembro", () => {
    expect(previstoPorMes(valores("902", [7, 8, 9, 10, 11], [16000, 16000, 18762, 20144, 21525]), new Set(["902"]), "2026")).toEqual([0, 0, 0, 0, 0, 0, 16000, 16000, 18762, 20144, 21525, 0]);
  });
  it("ignora diferenças menores que R$ 1,00 sem eliminar o impacto anual", () => {
    expect(compararReforecast(100, 100.99)).toEqual({ diferenca: 0.99, estado: "igual" });
    expect(compararReforecast(100, 99.01).estado).toBe("igual");
    expect(compararReforecast(100, 101).estado).toBe("acima");
  });
  it("classifica acima do orçado", () => { expect(compararReforecast(100, 110).estado).toBe("acima"); });
  it("classifica abaixo do orçado, inclusive previsão zero", () => { expect(compararReforecast(100, 0).estado).toBe("abaixo"); });
  it("classifica contrato novo sem orçado", () => { expect(compararReforecast(0, 25600).estado).toBe("novo"); });
  it("calcula a diferença anual pela soma dos 12 meses", () => {
    const previsto = previstoPorMes(valores("nac", [3, 4, 7, 8], [25600, 25600, 25600, 16516]), new Set(["nac"]), "2026");
    expect(compararReforecast(16516 * 12, previsto.reduce((a, b) => a + b, 0)).diferenca).toBe(-104876);
  });
  it("prioriza a observação da vigência mais recente fora do orçado", () => {
    expect(motivoReforecast([{ id: "a", no_orcamento: false }], [{ contrato_id: "a", seq: 1, no_orcamento: false, observacao: "Antiga" }, { contrato_id: "a", seq: 2, no_orcamento: false, observacao: "Acordo contratual" }])).toBe("Acordo contratual");
  });
  it("usa a data de assinatura do contrato novo", () => {
    expect(motivoReforecast([{ id: "a", no_orcamento: false }], [{ contrato_id: "a", seq: 1, data_documento: "2026-02-01" }])).toBe("Contrato novo, assinado em 01/02/2026");
  });
  it("não usa observações de vigências que fazem parte do orçado", () => {
    expect(motivoReforecast([{ id: "a", no_orcamento: true }], [{ contrato_id: "a", seq: 1, no_orcamento: true, observacao: "Não usar" }])).toBe("Diferença entre o previsto pelos contratos e o orçado");
  });
});