import { describe, expect, it } from "vitest";
import { filtrar, itensAviso, pendentesAnteriores, type EventoAgenda } from "./agenda";
const ev = (p: Partial<EventoAgenda>): EventoAgenda => ({ edificio_id: "e", contrato_id: "c", tipo: "reajuste", data_evento: "2026-11-01", status: "a_vencer", registrado: false, unidades: "Sala 1", locatario: "X", indice: "IPCA", valor_atual: 1, mes_referencia: null, percentual_sugerido: null, valor_sugerido: null, vigencia_sugerida: null, indice_estimado: false, valor_novo: null, observacao: null, documento_id: null, registrado_em: null, ...p });
describe("agenda", () => {
  it("aviso conta pendentes e a vencer em 60 dias, sem degraus", () => {
    const evs = [ev({ status: "pendente", data_evento: "2026-09-01" }), ev({ data_evento: "2026-12-20" }), ev({ data_evento: "2027-02-01" }), ev({ tipo: "degrau", data_evento: "2026-12-01" })];
    expect(itensAviso(evs, "2026-11-26")).toHaveLength(2);
  });
  it("pendentes de meses anteriores ignoram o mês exibido", () => {
    const evs = [ev({ status: "pendente", data_evento: "2026-09-01" }), ev({ status: "pendente", data_evento: "2026-11-01" })];
    expect(pendentesAnteriores(evs, "2026-11")).toHaveLength(1);
  });
  it("filtro do mês por situação", () => {
    const evs = [ev({ status: "em_andamento" }), ev({ status: "realizado" }), ev({ status: "em_andamento", data_evento: "2026-12-01" })];
    expect(filtrar(evs, "2026-11", "em_andamento", "2026-11-26")).toHaveLength(1);
  });
});
