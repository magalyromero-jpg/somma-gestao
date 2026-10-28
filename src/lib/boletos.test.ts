import { describe, expect, it } from "vitest";
import { agruparLinhas, lerLinhaBoleto, mesesPlanejamento } from "./boletos";

describe("leitura de boletos", () => {
  it("lê boleto pago com datas de emissão, vencimento e pagamento", () => {
    const b = lerLinhaBoleto("109 LUARA MEL VIEIRA 12.345.678/0001-90 BOLETO 123456 01/10/2026 05/10/2026 20/10/2026 6100.00 7282,00 paga");
    expect(b).toMatchObject({ nosso_numero: "123456", documento: "12.345.678/0001-90", data_emissao: "2026-10-01", data_vencimento: "2026-10-05", data_pagamento: "2026-10-20", data_baixa: null, valor_titulo: 6100, valor_pago: 7282, status: "paga" });
  });
  it("cancelada usa a terceira data como baixa", () => {
    const b = lerLinhaBoleto("109 FULANO 123.456.789-00 BOLETO 9 01/10/2026 05/11/2026 10/10/2026 100 0 cancelada");
    expect(b?.data_baixa).toBe("2026-10-10");
    expect(b?.data_pagamento).toBeNull();
  });
  it("'a vencer' vira a_vencer", () => {
    expect(lerLinhaBoleto("109 X LTDA 12.345.678/0001-90 BOLETO 7 01/10/2026 05/11/2026 500 0 a vencer")?.status).toBe("a_vencer");
  });
  it("ignora continuação do nome do pagador", () => {
    expect(lerLinhaBoleto("AVIAÇÃO LTDA")).toBeNull();
  });
  it("agrupa itens pela mesma altura, da esquerda para a direita", () => {
    expect(agruparLinhas([{ str: "C", x: 10, y: 120 }, { str: "B", x: 50, y: 100 }, { str: "A", x: 10, y: 100.4 }, { str: " ", x: 5, y: 100 }])).toEqual(["A B", "C"]);
  });
  it("planejamento vai do mês atual até dezembro", () => {
    expect(mesesPlanejamento("2026-10-28")).toEqual(["2026-10", "2026-11", "2026-12"]);
  });
});
