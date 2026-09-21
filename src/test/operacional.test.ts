import { describe, expect, it } from "vitest";
import { emAndamentoNoDia, faixaIdade, faixaPrazo, tipoDaTarefa } from "@/lib/operacional";

const tarefa = {
  bitrix_id: 1,
  titulo: "Teste",
  familia_titulo: "Família",
  status: "pending",
  prioridade: "average",
  prazo: "2026-09-21T12:00:00Z",
  criado_em: "2026-09-01T12:00:00Z",
  concluido_em: null,
  alterado_em: null,
  responsavel_nome: "Pessoa",
  marcadores: ["Analítico", "Operacional"],
  link_bitrix: null,
  synced_at: "2026-09-21T12:00:00Z",
};

describe("regras operacionais", () => {
  it("usa o primeiro tipo da ordem definida", () => expect(tipoDaTarefa(tarefa)).toBe("Operacional"));
  it("classifica prazo em faixas exclusivas", () => {
    expect(faixaPrazo({ ...tarefa, prazo: "2026-09-20T12:00:00Z" }, "2026-09-21")).toBe("atrasadas");
    expect(faixaPrazo(tarefa, "2026-09-21")).toBe("hoje");
    expect(faixaPrazo({ ...tarefa, prazo: "2026-09-27T12:00:00Z" }, "2026-09-21")).toBe("esta_semana");
    expect(faixaPrazo({ ...tarefa, prazo: "2026-09-28T12:00:00Z" }, "2026-09-21")).toBe("proxima_semana");
  });
  it("calcula a fila histórica no fechamento do dia", () => {
    expect(emAndamentoNoDia({ ...tarefa, concluido_em: "2026-09-10T12:00:00Z", status: "completed" }, "2026-09-09")).toBe(true);
    expect(emAndamentoNoDia({ ...tarefa, concluido_em: "2026-09-10T12:00:00Z", status: "completed" }, "2026-09-10")).toBe(false);
  });
  it("classifica idade", () => expect([faixaIdade(30), faixaIdade(31), faixaIdade(366)])).toEqual(["0-30", "31-90", "mais_de_1_ano"]));
});