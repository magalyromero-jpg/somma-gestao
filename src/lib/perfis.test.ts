import { describe, it, expect } from "vitest";
import { podeEditar, modoPortal, rotaInicial, PERFIL_LABEL, slugEdificio } from "./perfis";

describe("perfis", () => {
  it("só admin e gestor editam", () => {
    expect(podeEditar("admin")).toBe(true);
    expect(podeEditar("gestor")).toBe(true);
    expect(podeEditar("consulta")).toBe(false);
    expect(podeEditar("familia")).toBe(false);
  });
  it("modo do portal", () => {
    expect(modoPortal("gestor")).toBe("admin");
    expect(modoPortal("consulta")).toBe("consulta");
    expect(modoPortal("familia")).toBe("cliente");
  });
  it("familia aparece como Cliente", () => {
    expect(PERFIL_LABEL.familia).toBe("Cliente");
  });
  it("rota inicial", () => {
    expect(rotaInicial("consulta", [])).toBe("/dashboard");
    expect(rotaInicial("admin", [])).toBe("/dashboard");
    expect(rotaInicial("familia", [{ nome: "Zen Tower" }])).toBe("/carteira/zen-tower");
    expect(slugEdificio("Zen Tower")).toBe("zen-tower");
  });
});
