import { describe, expect, it } from "vitest";
import { baseRealizado } from "./locacoes";

const pagamentos = [{ contrato_id: "desafio", data_pagamento: "2026-07-06", valor_liquido: 6650 }, { contrato_id: null, imovel_nome: "Zen Tower - Heliponto", data_pagamento: "2026-07-01", valor_liquido: 1548 }];
const julho = { competencia: "2026-07-01", multa: 132.75, juros: 82.02, ja_no_realizado: false };
const outubro = [{ competencia: "2026-10-01", multa: 1125.70, juros: 56.29, ja_no_realizado: false }, { competencia: "2026-10-01", multa: 1433.10, juros: 14.33, ja_no_realizado: false }];

describe("encargos no Realizado compartilhado", () => {
  it("julho acrescenta Multa 132,75 e Juros 82,02 às Outras Receitas", () => {
    const b = baseRealizado(pagamentos, [julho], 2026);
    expect(b.meses[6].multa).toBe(132.75);
    expect(b.meses[6].juros).toBe(82.02);
    expect(b.meses[6].total).toBeCloseTo(8412.77, 2);
    expect(b.outras.reduce((s, o) => s + (o.real[6] ?? 0), 0)).toBeCloseTo(1762.77, 2);
  });
  it("não duplica encargos já contidos no aluguel importado", () => {
    const b = baseRealizado(pagamentos, [{ ...julho, ja_no_realizado: true }], 2026);
    expect(b.meses[6].total).toBe(8198);
    expect(b.meses[6].multa + b.meses[6].juros).toBe(0);
  });
  it("outubro não entra antes da importação do Lidderar", () => {
    const b = baseRealizado(pagamentos, outubro, 2026);
    expect(b.meses[9].fechado).toBe(false);
    expect(b.meses[9].total).toBe(0);
    expect(b.outras.find((o) => o.un === "Multa")?.real[9]).toBeNull();
  });
  it("Luara e Independent entram em outubro somente após importação", () => {
    const b = baseRealizado([...pagamentos, { contrato_id: "luara", data_pagamento: "2026-10-10", valor_liquido: 6650 }], outubro, 2026);
    expect(b.meses[9].multa).toBeCloseTo(2558.80, 2);
    expect(b.meses[9].juros).toBeCloseTo(70.62, 2);
    expect(b.meses[9].total).toBeCloseTo(9279.42, 2);
  });
  it("ignora encargos de outro ano e segue a mesma janela das demais receitas", () => {
    const b = baseRealizado(pagamentos, [{ ...julho, competencia: "2025-07-01" }], 2026);
    expect(b.meses[6].total).toBe(8198);
    expect(b.ultimoMes).toBe("2026-07");
  });
});