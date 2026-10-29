import { describe, expect, it } from "vitest";
import { compararUnidades, parcelaDevida, situacaoIptu, type IptuLinha } from "./iptu";

const hoje = new Date(2026, 9, 29); // 29/10/2026

describe("parcelaDevida", () => {
  it("parcela 8 vence em 15/10 e é devida a partir de 16/10/2026", () => {
    expect(parcelaDevida(8, 2026, new Date(2026, 9, 15))).toBe(false);
    expect(parcelaDevida(8, 2026, new Date(2026, 9, 16))).toBe(true);
    expect(parcelaDevida(8, 2026, hoje)).toBe(true);
  });
  it("parcelas 9 e 10 ainda não são devidas em 29/10/2026", () => {
    expect(parcelaDevida(9, 2026, hoje)).toBe(false);
    expect(parcelaDevida(10, 2026, hoje)).toBe(false);
  });
  it("parcela 1 é devida a partir de 16/03 do ano", () => {
    expect(parcelaDevida(1, 2026, new Date(2026, 2, 15))).toBe(false);
    expect(parcelaDevida(1, 2026, new Date(2026, 2, 16))).toBe(true);
  });
});

describe("situacaoIptu", () => {
  const base: IptuLinha = { unidade: "Sala 1301", locatario: "Desafio Jovem", forma: "parcelado", valor_sala: 489.42, valor_garagem: null, pago_em: null, observacao: null };
  it("Sala 1301 tem 4 pendentes (01 a 03 e 08) em 29/10/2026", () => {
    const s = situacaoIptu(base, new Set([4, 5, 6, 7]), 2026, hoje);
    expect(s.pendentes).toEqual([1, 2, 3, 8]);
    expect(s.texto).toBe("4 Parcelas Pendentes");
  });
  it("unidade com todas as devidas pagas fica Em Dia", () => {
    const s = situacaoIptu(base, new Set([1, 2, 3, 4, 5, 6, 7, 8]), 2026, hoje);
    expect(s.texto).toBe("Em Dia");
  });
  it("à vista, sem registro e própria têm situação fixa", () => {
    expect(situacaoIptu({ ...base, forma: "avista" }, new Set(), 2026, hoje).texto).toBe("Pago à Vista");
    expect(situacaoIptu({ ...base, forma: "sem_registro" }, new Set(), 2026, hoje).texto).toBe("Sem Registro");
    expect(situacaoIptu({ ...base, forma: "proprio" }, new Set(), 2026, hoje).texto).toBe("Própria");
  });
});

describe("compararUnidades", () => {
  it("Lojas antes das Salas, em ordem numérica", () => {
    const lista = ["Sala 801", "Loja 11", "Sala 1201", "Loja 02", "Loja 220", "Sala 602"];
    expect([...lista].sort(compararUnidades)).toEqual(["Loja 02", "Loja 11", "Loja 220", "Sala 602", "Sala 801", "Sala 1201"]);
  });
});
