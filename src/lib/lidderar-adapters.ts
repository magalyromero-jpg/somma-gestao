// Adapters: normalize Lidderar API payloads into the app's domain types.
import { parseBRL } from "@/hooks/useLidderar";
import type { Classificacao, Familia, Imovel, StatusLocacao } from "@/data/mock";

const FAMILY_PALETTE = ["#2E3E44", "#CC8B15", "#4D6571", "#185FA5", "#2D7A4F", "#9A6B0A", "#C0392B"];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const colorFor = (id: string) => {
  const idx = Math.abs(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % FAMILY_PALETTE.length;
  return FAMILY_PALETTE[idx];
};

const pick = <T = unknown>(obj: any, keys: string[], fallback?: T): T => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return fallback as T;
};

const normalizeStatus = (raw: unknown): StatusLocacao => {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("locad")) return "Locado";
  if (s.includes("car")) return "Carencia";
  if (s.includes("vag")) return "Vago";
  if (s.includes("vend")) return "Vendido";
  if (s.includes("doad")) return "Doado";
  if (s.includes("desenvolv")) return "EmDesenvolvimento";
  if (s.includes("inativ")) return "Inativo";
  return "Inativo";
};

const normalizeClassificacao = (raw: unknown): Classificacao => {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("comerc")) return "Comercial";
  if (s.includes("terren") || s.includes("lote") || s.includes("gleba")) return "Terreno";
  if (s.includes("particip")) return "Participacao";
  return "Residencial";
};

/** Extract list from common Lidderar envelopes (handles nested {DADOS:{DADOS:[]}}). */
export const extractList = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.DADOS)) return payload.DADOS;
  // Nested: { TYPE, DADOS: { DADOS: [...] } }
  if (payload?.DADOS && typeof payload.DADOS === "object" && Array.isArray(payload.DADOS.DADOS)) {
    return payload.DADOS.DADOS;
  }
  if (Array.isArray(payload?.dados)) return payload.dados;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.imoveis)) return payload.imoveis;
  if (Array.isArray(payload?.contas)) return payload.contas;
  if (Array.isArray(payload?.clientes)) return payload.clientes;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

// ──────────────────────────────────────────────────────────────────────────
// Cliente adapter — from /cadastros/clientes/getall
// ──────────────────────────────────────────────────────────────────────────
export type PerfilCliente = "Family Office" | "Banco de Dados" | "Lidderar" | "Outro";

export interface Cliente {
  id: number;
  nome: string;
  perfil: PerfilCliente;
  tipo: "cliente" | "empresa";
}

const normalizePerfil = (raw: unknown): PerfilCliente => {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s.includes("family")) return "Family Office";
  if (s.includes("banco")) return "Banco de Dados";
  if (s.includes("lidderar")) return "Lidderar";
  return "Outro";
};

export const adaptCliente = (raw: any): Cliente => {
  const id = Number(pick(raw, ["id_cliente", "id_empresa", "id", "cod_cliente", "chave"], 0));
  const nome = String(pick(raw, ["nome", "razao_social", "fantasia", "nome_cliente"], "—"));
  const perfil = normalizePerfil(pick(raw, ["perfil", "perfil_cliente", "tipo_perfil", "categoria"]));
  const tipoRaw = String(pick(raw, ["tipo", "tipo_pessoa"], "")).toLowerCase();
  const tipo: "cliente" | "empresa" =
    tipoRaw.includes("empresa") || tipoRaw.includes("juridic") || raw?.id_empresa ? "empresa" : "cliente";
  return { id, nome, perfil, tipo };
};

/** Build lookup: id → perfil (separate maps for clientes and empresas). */
export const buildPerfilIndex = (clientes: Cliente[]) => {
  const clienteToPerfil = new Map<number, PerfilCliente>();
  const empresaToPerfil = new Map<number, PerfilCliente>();
  for (const c of clientes) {
    if (!c.id) continue;
    if (c.tipo === "empresa") empresaToPerfil.set(c.id, c.perfil);
    else clienteToPerfil.set(c.id, c.perfil);
  }
  return { clienteToPerfil, empresaToPerfil };
};
export type PerfilIndex = ReturnType<typeof buildPerfilIndex>;

// ──────────────────────────────────────────────────────────────────────────
// Família (conta) adapter — from /cadastros/conta/getall
// ──────────────────────────────────────────────────────────────────────────
export interface FamiliaConta extends Familia {
  cliente_ids: number[];
  empresa_ids: number[];
}

const toIdList = (raw: any): number[] => {
  if (raw === null || raw === undefined || raw === "") return [];
  if (Array.isArray(raw)) return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
  // Allow CSV strings like "12,34,56"
  return String(raw)
    .split(/[,;|]/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
};

export const adaptFamiliaConta = (raw: any): FamiliaConta => {
  const id = String(
    pick(raw, ["id_conta", "id", "cod_conta", "codigo", "chave"], slugify(String(pick(raw, ["nome_conta", "nome"], "familia")))),
  );
  const nomeRaw = String(pick(raw, ["nome_conta", "nome", "razao_social", "fantasia"], "Família"));
  const nome = /^fam[ií]lia/i.test(nomeRaw) ? nomeRaw : `Família ${nomeRaw}`;

  // Try common shapes: arrays of ids, arrays of objects with id, or csv.
  const clientesRaw =
    raw?.clientes ?? raw?.cliente_ids ?? raw?.cliente_part ?? raw?.id_clientes ?? raw?.clientes_part;
  const empresasRaw =
    raw?.empresas ?? raw?.empresa_ids ?? raw?.empresa_part ?? raw?.id_empresas ?? raw?.empresas_part;

  const flatten = (v: any): any[] =>
    Array.isArray(v)
      ? v.flatMap((x) =>
          x && typeof x === "object" ? [x.id_cliente ?? x.id_empresa ?? x.id ?? x.chave] : [x],
        )
      : [v];

  const cliente_ids = toIdList(flatten(clientesRaw));
  const empresa_ids = toIdList(flatten(empresasRaw));

  return {
    id,
    nome,
    cor_avatar: colorFor(id),
    membros: [],
    cliente_ids,
    empresa_ids,
  };
};

/** Build lookup: entity id (cliente or empresa) → familia_id. */
export const buildFamiliaIndex = (contas: FamiliaConta[]) => {
  const clienteToFamilia = new Map<number, string>();
  const empresaToFamilia = new Map<number, string>();
  const byId = new Map<string, FamiliaConta>();
  for (const c of contas) {
    byId.set(c.id, c);
    c.cliente_ids.forEach((id) => clienteToFamilia.set(id, c.id));
    c.empresa_ids.forEach((id) => empresaToFamilia.set(id, c.id));
  }
  return { clienteToFamilia, empresaToFamilia, byId };
};

export type FamiliaIndex = ReturnType<typeof buildFamiliaIndex>;

// ──────────────────────────────────────────────────────────────────────────
// Imóvel adapter
// ──────────────────────────────────────────────────────────────────────────
export const adaptFamilia = (raw: any): Familia => {
  const id = String(pick(raw, ["id", "cod_conta", "codigo", "chave"], slugify(pick(raw, ["nome", "razao_social"], "familia"))));
  const nome = String(pick(raw, ["nome", "razao_social", "fantasia"], "Família"));
  return {
    id,
    nome: nome.startsWith("Família") ? nome : `Família ${nome}`,
    cor_avatar: colorFor(id),
    membros: [],
  };
};

/**
 * Adapt a Lidderar property record. Sums monetary fields across ALL participacoes.
 * Family resolution priority:
 *   1. Lidderar conta index (cliente_part / empresa_part → conta)
 *   2. Supabase familia_membros mapping (lidderar_entity_id → familia_id)
 *   3. Fallback to first participação name
 * Also tags the property with the set of perfis (Family Office / Banco de Dados / Lidderar)
 * derived from its participantes.
 */
export const adaptImovel = (
  raw: any,
  familiaIndex?: FamiliaIndex,
  perfilIndex?: PerfilIndex,
  membrosIndex?: { clienteToFamilia: Map<number, string>; empresaToFamilia: Map<number, string> },
): Imovel => {
  const cod_imovel = Number(pick(raw, ["cod_imovel", "codigo", "id", "chave"], 0));

  const rootValorMercado = parseBRL(pick(raw, ["valor_mercado", "valor_venda", "valorMercado"]));
  const rootValorCompra = parseBRL(pick(raw, ["valor_aquisitivo", "valor_compra", "valor_aquisicao"]));
  const rootAluguel = parseBRL(pick(raw, ["valor_aluguel_mercado", "valor_aluguel", "aluguel"]));

  const participacoesRaw: any[] = Array.isArray(raw?.participacoes) ? raw.participacoes : [];

  let sumMercado = 0;
  let sumCompra = 0;
  let sumAluguel = 0;
  const participacoes: Array<{ nome: string; valor_part: number }> = [];
  const familiaCandidates = new Map<string, number>();
  const perfisSet = new Set<string>();

  for (const p of participacoesRaw) {
    const valor_part = parseBRL(pick(p, ["valormercado_part", "valor_mercado_part", "valor_part"]));
    const compra_part = parseBRL(pick(p, ["valoraquisitivo_part", "valor_aquisitivo_part", "valor_aquisicao_part"]));
    const aluguel_part = parseBRL(pick(p, ["valormercadoaluguel_part", "valor_aluguel_part", "valor_aluguel_mercado_part"]));
    sumMercado += valor_part;
    sumCompra += compra_part;
    sumAluguel += aluguel_part;

    const nome = String(pick(p, ["nome", "razao_social", "fantasia", "cliente", "nome_conta"], "—"));
    participacoes.push({ nome, valor_part });

    const cid = Number(pick(p, ["cliente_part", "id_cliente", "cliente_id", "cod_cliente"], 0));
    const eid = Number(pick(p, ["empresa_part", "id_empresa", "empresa_id", "cod_empresa"], 0));

    // 1. Lidderar conta mapping
    if (familiaIndex) {
      const fid =
        (cid && familiaIndex.clienteToFamilia.get(cid)) ||
        (eid && familiaIndex.empresaToFamilia.get(eid)) ||
        null;
      if (fid) familiaCandidates.set(fid, (familiaCandidates.get(fid) ?? 0) + (valor_part || 1));
    }
    // 2. Supabase familia_membros override (manual mapping)
    if (membrosIndex) {
      const fid =
        (cid && membrosIndex.clienteToFamilia.get(cid)) ||
        (eid && membrosIndex.empresaToFamilia.get(eid)) ||
        null;
      if (fid) familiaCandidates.set(fid, (familiaCandidates.get(fid) ?? 0) + (valor_part || 1) + 1000);
    }
    // 3. Perfil tagging
    if (perfilIndex) {
      const perfil =
        (cid && perfilIndex.clienteToPerfil.get(cid)) ||
        (eid && perfilIndex.empresaToPerfil.get(eid)) ||
        null;
      if (perfil) perfisSet.add(perfil);
    }
  }

  const valor_mercado = sumMercado || rootValorMercado;
  const valor_compra = sumCompra || rootValorCompra;
  const aluguel = sumAluguel || rootAluguel;

  const status = normalizeStatus(
    pick(raw, ["statusImovel.status", "status_imovel", "status"]) ?? raw?.statusImovel?.status,
  );
  const lat = Number(pick(raw, ["latitude", "lat"], 0)) || -30.0346;
  const lng = Number(pick(raw, ["longitude", "lng"], 0)) || -51.2177;
  const fotos: string[] = Array.isArray(raw?.fotos_imovel)
    ? raw.fotos_imovel.map((f: any) => f?.url || f?.foto || f).filter(Boolean)
    : [];

  let familia_id = "sem-familia";
  let familia_nome = "Sem família";
  if (familiaCandidates.size > 0) {
    const [winnerId] = Array.from(familiaCandidates.entries()).sort((a, b) => b[1] - a[1])[0];
    familia_id = winnerId;
    familia_nome = familiaIndex?.byId.get(winnerId)?.nome ?? winnerId;
  } else if (participacoes[0]?.nome && participacoes[0].nome !== "—") {
    familia_nome = participacoes[0].nome;
    familia_id = slugify(familia_nome) || "sem-familia";
  }

  return {
    cod_imovel,
    cod_interno: String(pick(raw, ["cod_interno", "codigo_interno"], `IM-${cod_imovel}`)),
    endereco: String(pick(raw, ["endereco", "logradouro", "nome_imovel"], "—")),
    bairro: String(pick(raw, ["bairro"], "—")),
    cidade: String(pick(raw, ["cidade"], "—")),
    estado: String(pick(raw, ["estado", "uf"], "—")),
    classificacao: normalizeClassificacao(pick(raw, ["classificacao", "tipo_imovel"])),
    tipo: String(pick(raw, ["tipo", "subtipo"], "Imóvel")),
    uso: String(pick(raw, ["uso", "finalidade"], "—")),
    area_m2: Number(parseBRL(pick(raw, ["area_total", "area_m2", "area_privativa"]))) || 0,
    status,
    valor_mercado,
    valor_compra,
    valor_aluguel_mensal: aluguel,
    valorizacao_pct:
      valor_compra > 0 ? Math.round(((valor_mercado - valor_compra) / valor_compra) * 1000) / 10 : 0,
    lat,
    lng,
    fotos,
    familia_id,
    familia_nome,
    perfis: Array.from(perfisSet),
  };
};

/** Derive families dynamically from imoveis (fallback when no contas endpoint). */
export const deriveFamiliasFromImoveis = (imoveis: Imovel[]): Familia[] => {
  const map = new Map<string, string>();
  for (const i of imoveis) {
    if (!map.has(i.familia_id)) {
      map.set(i.familia_id, i.familia_nome || "Sem família");
    }
  }
  return Array.from(map.entries()).map(([id, nome]) => ({
    id,
    nome,
    cor_avatar: colorFor(id),
    membros: [],
  }));
};

/** Group properties by family and compute KPIs. */
export const computeFamiliaKpis = (imoveis: Imovel[], familiaId: string) => {
  const list = imoveis.filter((i) => i.familia_id === familiaId);
  const valor_mercado = list.reduce((s, i) => s + i.valor_mercado, 0);
  const valor_compra = list.reduce((s, i) => s + i.valor_compra, 0);
  const receita_mensal = list.reduce(
    (s, i) => s + (i.status === "Locado" ? i.valor_aluguel_mensal : 0),
    0,
  );
  const valorizacao = valor_compra > 0 ? ((valor_mercado - valor_compra) / valor_compra) * 100 : 0;
  return {
    total: list.length,
    valor_mercado,
    valor_compra,
    receita_mensal,
    valorizacao,
    locados: list.filter((i) => i.status === "Locado").length,
    vagos: list.filter((i) => i.status === "Vago").length,
    carencia: list.filter((i) => i.status === "Carencia").length,
    inativos: list.filter((i) => ["Inativo", "Vendido", "Doado"].includes(i.status)).length,
  };
};
