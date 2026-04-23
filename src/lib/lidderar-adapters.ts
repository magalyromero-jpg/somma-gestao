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

/** Extract list from common Lidderar envelopes ({DADOS:[]}, {data:[]}, []). */
export const extractList = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.DADOS)) return payload.DADOS;
  if (Array.isArray(payload?.dados)) return payload.dados;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.imoveis)) return payload.imoveis;
  if (Array.isArray(payload?.contas)) return payload.contas;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

export const adaptFamilia = (raw: any): Familia => {
  const id = String(pick(raw, ["id", "cod_conta", "codigo", "chave"], slugify(pick(raw, ["nome", "razao_social"], "familia"))));
  const nome = String(pick(raw, ["nome", "razao_social", "fantasia"], "Família"));
  const colorIdx = Math.abs(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % FAMILY_PALETTE.length;
  return {
    id,
    nome: nome.startsWith("Família") ? nome : `Família ${nome}`,
    cor_avatar: FAMILY_PALETTE[colorIdx],
    membros: [],
  };
};

export const adaptImovel = (raw: any): Imovel => {
  const cod_imovel = Number(pick(raw, ["cod_imovel", "codigo", "id", "chave"], 0));
  const valor_compra = parseBRL(pick(raw, ["valor_aquisitivo", "valor_compra", "valor_aquisicao"]));
  const valor_mercado = parseBRL(pick(raw, ["valor_mercado", "valor_venda", "valorMercado"])) || valor_compra;
  const aluguel = parseBRL(pick(raw, ["valor_aluguel_mercado", "valor_aluguel", "aluguel"]));
  const status = normalizeStatus(pick(raw, ["statusImovel.status", "status_imovel", "status"]) ?? raw?.statusImovel?.status);
  const lat = Number(pick(raw, ["latitude", "lat"], 0)) || -30.0346;
  const lng = Number(pick(raw, ["longitude", "lng"], 0)) || -51.2177;
  const fotos: string[] = Array.isArray(raw?.fotos_imovel)
    ? raw.fotos_imovel.map((f: any) => f?.url || f?.foto || f).filter(Boolean)
    : [];
  const participacoes: Array<{ nome: string; valor_part: number }> = Array.isArray(raw?.participacoes)
    ? raw.participacoes.map((p: any) => ({
        nome: String(pick(p, ["nome", "razao_social", "fantasia", "cliente", "nome_conta"], "—")),
        valor_part: parseBRL(pick(p, ["valormercado_part", "valor_mercado_part", "valor_part"])),
      }))
    : [];
  const familiaNome = participacoes[0]?.nome || "Sem família";
  const familia_id = slugify(familiaNome) || "sem-familia";

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
    familia_nome: familiaNome,
  };
};

/** Derive families dynamically from imoveis (group by participacoes[0].nome). */
export const deriveFamiliasFromImoveis = (imoveis: Imovel[]): Familia[] => {
  const map = new Map<string, string>();
  for (const i of imoveis) {
    if (!map.has(i.familia_id)) {
      map.set(i.familia_id, i.familia_nome || "Sem família");
    }
  }
  return Array.from(map.entries()).map(([id, nome]) => {
    const colorIdx = Math.abs(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % FAMILY_PALETTE.length;
    return { id, nome, cor_avatar: FAMILY_PALETTE[colorIdx], membros: [] };
  });
};

/** Group properties by family and compute KPIs (replaces mock helpers). */
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
