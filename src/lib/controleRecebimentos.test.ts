import { describe, expect, it } from "vitest";
import { outrasRecebimentos, saldoReceber, totaisRecebimentos, type RecebimentoMes } from "./controleRecebimentos";
const linha = (situacao: RecebimentoMes["situacao"], a_receber: number, recebido = 0): RecebimentoMes => ({ contrato_id: "a", mes: "2026-11-01", recebido, a_receber, situacao, valor_boleto: 0 });
describe("Controle de Recebimentos", () => {
  it("ignora saldo de exatamente R$ 2,00", () => expect(saldoReceber(39400, 39398)).toBe(0));
  it("inclui saldo maior que R$ 2,00", () => expect(saldoReceber(39400, 39397.99)).toBe(2.01));
  it("não gera pendência para pagamento acima do esperado", () => expect(saldoReceber(39400, 40000)).toBe(0));
  it("composição soma exatamente recebido e pendências, agrupando sem registro em sem boleto", () => {
    const t = totaisRecebimentos([linha("boleto_emitido", 39400, 1234.56), linha("pago_no_boleto", 0.01), linha("vencido", 0.02), linha("sem_registro", 100), linha("fora_do_boleto", 200)]);
    expect(t.ano.total).toBe(40934.59);
    expect(t.ano.sem_boleto).toBe(100);
    expect(t.ano.recebido + t.ano.a_receber).toBeCloseTo(t.ano.total, 8);
    expect(t.ano.pago_no_boleto + t.ano.boleto_emitido + t.ano.vencido + t.ano.sem_boleto + t.ano.fora_do_boleto).toBeCloseTo(t.ano.a_receber, 8);
  });
  it("outras receitas usam mês do recebido e apenas boletos do mês atual em diante", () => {
    const o = outrasRecebimentos([{ un: "Heliponto", real: [0,0,0,1548] }], [{ outra_receita: "Heliponto", mes: "2026-04-01", emitido: 1548 }, { outra_receita: "Heliponto", mes: "2026-11-01", emitido: 1548 }], 2026, "2026-11");
    expect(o[0].meses[3].recebido).toBe(1548);
    expect(o[0].meses[3].a_receber).toBe(0);
    expect(o[0].meses[10].a_receber).toBe(1548);
  });
});