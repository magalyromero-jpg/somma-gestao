import { describe, expect, it } from "vitest";
import {
  CLASSE_SITUACAO,
  SITUACOES_COBRANCA,
  gradeCobranca,
  totaisCobranca,
  type CobrancaMes,
  type SituacaoCobranca,
} from "./cobrancaMensal";

const linha = (contrato: string, mes: string, esperado: number, situacao: SituacaoCobranca): CobrancaMes => ({
  contrato_id: contrato,
  mes,
  esperado,
  recebido: 0,
  boleto_a_vencer: 0,
  boleto_vencido: 0,
  boleto_pago: 0,
  situacao,
});

describe("gradeCobranca", () => {
  it("posiciona cada contrato e mês na coluna jan..dez", () => {
    const g = gradeCobranca([linha("a", "2026-01-01", 100, "recebido"), linha("a", "2026-11-01", 200, "boleto_emitido")]);
    const arr = g.get("a")!;
    expect(arr).toHaveLength(12);
    expect(arr[0]?.esperado).toBe(100);
    expect(arr[10]?.situacao).toBe("boleto_emitido");
    expect(arr[5]).toBeNull();
  });

  it("ignora meses fora do ano de 12 colunas", () => {
    const g = gradeCobranca([linha("a", "2026-13-01", 100, "recebido")]);
    expect(g.has("a")).toBe(false);
  });
});

describe("totaisCobranca", () => {
  it("agrupa o rodapé conforme o desenho: emitido, sem boleto e fora do boleto", () => {
    const linhas = [
      linha("a", "2026-11-01", 477267.86, "boleto_emitido"),
      linha("b", "2026-11-01", 1000, "pago_no_boleto"),
      linha("c", "2026-11-01", 500, "vencido"),
      linha("d", "2026-11-01", 65200, "sem_boleto"),
      linha("e", "2026-11-01", 300, "sem_registro"),
      linha("f", "2026-11-01", 122965.79, "fora_do_boleto"),
      linha("g", "2026-11-01", 900, "recebido"),
      linha("h", "2026-11-01", 800, "parcial"),
    ];
    const { meses, ano } = totaisCobranca(linhas);
    const nov = meses[10];
    expect(nov.boletoEmitido).toBeCloseTo(477267.86 + 1000 + 500, 2);
    expect(nov.semBoleto).toBeCloseTo(65200 + 300, 2);
    expect(nov.fora).toBeCloseTo(122965.79, 2);
    // Recebido e Parcial entram só no Total Esperado, nunca nas outras linhas do rodapé.
    expect(nov.esperado).toBeCloseTo(477267.86 + 1000 + 500 + 65200 + 300 + 122965.79 + 900 + 800, 2);
    expect(ano).toEqual(nov);
  });

  it("soma o ano a partir dos meses", () => {
    const { ano } = totaisCobranca([
      linha("a", "2026-01-01", 10, "boleto_emitido"),
      linha("a", "2026-02-01", 20, "sem_boleto"),
      linha("a", "2026-03-01", 40, "fora_do_boleto"),
    ]);
    expect(ano).toEqual({ esperado: 70, boletoEmitido: 10, semBoleto: 20, fora: 40 });
  });
});

describe("rótulos e classes", () => {
  it("toda situação devolvida pelo banco tem rótulo e classe visual", () => {
    for (const s of Object.keys(SITUACOES_COBRANCA) as SituacaoCobranca[]) {
      expect(SITUACOES_COBRANCA[s].length).toBeGreaterThan(0);
      expect(CLASSE_SITUACAO[s]).toBeDefined();
    }
  });
});
