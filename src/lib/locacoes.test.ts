import { describe, expect, it } from "vitest";
import { formatoPagamentoPermitido, projetarContrato, taxaProjetada } from "./locacoes";

const focus = { IPCA: { 2026: 5.01, 2027: 4.3 }, IGPM: { 2026: 5.27, 2027: 4.11 } };

describe("formatos de importação de pagamentos", () => {
  it("rejeita PDFs soltos", () => {
    expect(formatoPagamentoPermitido("contrato.pdf")).toBe(false);
    expect(formatoPagamentoPermitido("aditivo.PDF")).toBe(false);
  });
  it("rejeita ZIPs", () => {
    expect(formatoPagamentoPermitido("pagamentos.zip")).toBe(false);
    expect(formatoPagamentoPermitido("pagamentos.xlsx.zip")).toBe(false);
  });
  it("mantém os formatos de pagamentos existentes", () => {
    expect(formatoPagamentoPermitido("pagamentos.xlsx")).toBe(true);
    expect(formatoPagamentoPermitido("pagamentos.xls")).toBe(true);
    expect(formatoPagamentoPermitido("pagamentos.CSV")).toBe(true);
  });
});

describe("projeção de locações", () => {
  it("taxa ponderada pelo mês do reajuste", () => {
    // m=4 → 9/12·5,01 + 3/12·4,30
    expect(taxaProjetada(focus.IPCA, 2027, 4)).toBeCloseTo(4.8325, 4);
  });
  it("aplica ajuste de +1 p.p.", () => {
    expect(taxaProjetada(focus.IPCA, 2027, 1, 1)).toBeCloseTo(6.01, 4);
  });
  it("retenção de 4,8% deixa o caixa líquido (×0,952) e boleto paga o mês anterior", () => {
    const r = projetarContrato({ contrato_id: "x", valor_vigente: 1000, indice: "NENHUM", mes_reajuste: null, retencao_pct: 4.8, degraus: [] }, "2026-10", "2026-12", focus);
    expect(r.caixa.get("2026-12")).toBeCloseTo(952, 6);
  });
  it("degrau fixo substitui o índice e renovação define novo valor", () => {
    const r = projetarContrato({ contrato_id: "x", valor_vigente: 0, indice: "IPCA", mes_reajuste: 7, retencao_pct: 0, degraus: [], renovacao: { em: "2027-07-01", valor: 25600 } }, "2026-10", "2027-08", focus);
    expect(r.ref.get("2027-07")).toBe(25600);
  });
});
