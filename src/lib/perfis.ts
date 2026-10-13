export type Perfil = "admin" | "gestor" | "consulta" | "familia";

export const PERFIL_LABEL: Record<Perfil, string> = {
  admin: "Admin",
  gestor: "Gestor",
  consulta: "Consulta",
  familia: "Cliente",
};

/** Ordem de precedência quando o usuário tem mais de um papel. */
export const PERFIL_ORDEM: Perfil[] = ["admin", "gestor", "consulta", "familia"];

export const EQUIPE: Perfil[] = ["admin", "gestor", "consulta"];
export const EDICAO: Perfil[] = ["admin", "gestor"];

export const podeEditar = (r: Perfil | null | undefined) => !!r && EDICAO.includes(r);

/** Modo do portal do edifício para cada perfil. */
export function modoPortal(r: Perfil | null | undefined): "admin" | "consulta" | "cliente" {
  if (r === "admin" || r === "gestor") return "admin";
  if (r === "consulta") return "consulta";
  return "cliente";
}

export const slugEdificio = (nome: string) =>
  nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Rota após login. */
export function rotaInicial(r: Perfil | null | undefined, edificios: { nome: string }[]): string {
  if (r && EQUIPE.includes(r)) return "/dashboard";
  if (r === "familia") return edificios.length ? `/carteira/${slugEdificio(edificios[0].nome)}` : "/carteira";
  return "/login";
}
