// Edge Function: market-search
// Fluxo em 2 etapas:
//   1. SerpAPI -> coleta URLs de ANÚNCIOS INDIVIDUAIS (filtra listagens)
//   2. Firecrawl -> faz scrape de cada anúncio (HTML renderizado, contorna anti-bot)
//      e extrai preço, metragem e tempo no mercado.
// Persiste em market_listings + market_metrics + market_conclusions.
 
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
 
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
 
// Limites de processamento
const MAX_URLS_POR_PORTAL = 10;
const MAX_SERP_POR_PORTAL = 20;
const SCRAPE_CONCURRENCY = 3;
 
interface MarketSearchRow {
  id: string;
  created_by: string;
  uf: string;
  cidade: string;
  bairro: string | null;
  endereco_alvo: string | null;
  tipologias: string[];
  m2_min: number | null;
  m2_max: number | null;
  margem_pct: number;
  portais: string[];
  finalidade: string;
  raio_metros: number;
  nome_predio?: string | null; // NOVO: pesquisa por nome do prédio
}
 
interface ListingDraft {
  search_id: string;
  titulo: string;
  endereco: string;
  m2: number;
  dorms: number;
  vagas: number;
  preco: number;
  preco_m2: number | null;
  portal: string;
  tipologia: string;
  url: string;
  lat: number | null;
  lng: number | null;
  dias_no_mercado: number | null;
}
 
// ---------- Portais ----------
interface PortalSpec {
  domain: string;
  individualUrlPattern: RegExp;
  inurl: string;
  // Padrão que identifica páginas de condomínio/listagem (para EXCLUIR)
  condominioPattern?: RegExp;
}
 
const PORTALS: Record<string, PortalSpec> = {
  vivareal: {
    domain: "vivareal.com.br",
    individualUrlPattern: /\/imovel\//i,
    inurl: "imovel",
    condominioPattern: /\/condominio\//i,
  },
  zap: {
    domain: "zapimoveis.com.br",
    // FIX: ZAP usa UUID hexadecimal no formato id-XXXXXXXX-XXXX
    // Anúncios individuais: /venda/imoveis/... ou /aluguel/imoveis/...
    // Condomínios: /condominio/...
    individualUrlPattern: /\/(venda|aluguel)\/imoveis\/.+id-[0-9a-f]{6,}/i,
    inurl: "imoveis",
    condominioPattern: /\/condominio\//i,
  },
  zapimoveis: {
    domain: "zapimoveis.com.br",
    individualUrlPattern: /\/(venda|aluguel)\/imoveis\/.+id-[0-9a-f]{6,}/i,
    inurl: "imoveis",
    condominioPattern: /\/condominio\//i,
  },
  quintoandar: {
    domain: "quintoandar.com.br",
    individualUrlPattern: /\/imovel\/\d+/i,
    inurl: "imovel",
    condominioPattern: /\/edificio\//i,
  },
  imovelweb: {
    domain: "imovelweb.com.br",
    individualUrlPattern: /-\d{6,}\.html/i,
    inurl: ".html",
  },
  olx: {
    domain: "olx.com.br",
    individualUrlPattern: /\/imoveis\/.+\/[\w-]+-\d+/i,
    inurl: "imoveis",
  },
  loft: {
    domain: "loft.com.br",
    individualUrlPattern: /\/venda\/imovel\//i,
    inurl: "venda",
  },
  chavesnamao: {
    domain: "chavesnamao.com.br",
    individualUrlPattern: /\/(imovel|imoveis)\/.+\/[\w-]+-\d+/i,
    inurl: "imovel",
  },
};
 
function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
 
function getPortalSpec(portal: string): PortalSpec | null {
  return PORTALS[normKey(portal)] ?? null;
}
 
// ---------- Finalidade & limites ----------
type Finalidade = "venda" | "locacao";
 
const LIMITS = {
  venda: {
    precoMin: 50_000,
    precoMax: 20_000_000,
    precoM2Min: 3_000,
    precoM2Max: 30_000,
  },
  locacao: {
    precoMin: 500,
    precoMax: 50_000,
    precoM2Min: 10,
    precoM2Max: 300,
  },
} as const;
 
function normalizeFinalidade(f: string | undefined | null): Finalidade {
  const v = (f ?? "").toLowerCase();
  if (v.startsWith("loc") || v.startsWith("alug") || v.startsWith("rent")) return "locacao";
  return "venda";
}
 
// ---------- Tipologia ----------
const COMERCIAIS = new Set([
  "Sala comercial", "Loja", "Andar corporativo", "Galpão", "Pavilhão",
]);
const TERRENOS = new Set(["Terreno", "Lote em condomínio", "Área industrial"]);
 
type Categoria = "residencial" | "comercial" | "terreno";
function categoriaDe(tipologia: string): Categoria {
  if (COMERCIAIS.has(tipologia)) return "comercial";
  if (TERRENOS.has(tipologia)) return "terreno";
  return "residencial";
}
 
function termoBusca(tipologia: string, cat: Categoria): string {
  const t = tipologia.trim();
  if (cat === "residencial") {
    if (/studio|kitnet|kitinete/i.test(t)) return `apartamento (studio OR kitnet)`;
    const mDorm = t.match(/^(\d+)\s*dorm/i);
    if (mDorm) {
      const n = mDorm[1];
      return `apartamento (${n} dormitorios OR ${n} quartos OR ${n} dorm)`;
    }
    return t.toLowerCase();
  }
  return t.toLowerCase();
}
 
// ---------- Parsers ----------
function normalizeNumberPtBr(rawNum: string): number {
  let normalized: string;
  if (rawNum.includes(",")) {
    normalized = rawNum.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = rawNum.replace(/\./g, "");
  }
  return parseFloat(normalized);
}
 
function applySuffix(value: number, suf: string): number {
  const s = suf.toLowerCase();
  if (s.startsWith("mi") || s.startsWith("milh")) return value * 1_000_000;
  if (s === "mil") return value * 1_000;
  return value;
}
 
const RENT_SUFFIX = /\/\s*m[eê]s|por\s*m[eê]s|mensa(l|is)|ao\s*m[eê]s|\/m[eê]s/i;
 
function parsePrecoVenda(text: string): number | null {
  const patterns: RegExp[] = [
    /R\$\s*([\d.,]+)\s*(mi|milh[õo]es|mil)\b/i,
    /R\$\s*([\d.,]+)/i,
    /([\d.,]+)\s*(mi|milh[õo]es|mil)\s*(de\s*)?reais?/i,
  ];
  const { precoMin, precoMax } = LIMITS.venda;
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    let value = normalizeNumberPtBr(m[1]);
    if (isNaN(value)) continue;
    value = applySuffix(value, m[2] ?? "");
    value = Math.round(value);
    const idx = m.index ?? 0;
    const around = text.slice(Math.max(0, idx - 5), idx + m[0].length + 20);
    if (RENT_SUFFIX.test(around)) continue;
    if (value >= precoMin && value <= precoMax) return value;
  }
  return null;
}
 
function parsePrecoLocacao(text: string): number | null {
  const patterns: RegExp[] = [
    /R\$\s*([\d.,]+)\s*(?:\/\s*m[eê]s|por\s*m[eê]s|mensa(?:l|is)|ao\s*m[eê]s)/i,
    /R\$\s*([\d.,]+)/i,
  ];
  const { precoMin, precoMax } = LIMITS.locacao;
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const value = Math.round(normalizeNumberPtBr(m[1]));
    if (isNaN(value)) continue;
    if (value >= precoMin && value <= precoMax) return value;
  }
  return null;
}
 
function parsePreco(text: string, finalidade: Finalidade): number | null {
  return finalidade === "locacao" ? parsePrecoLocacao(text) : parsePrecoVenda(text);
}
 
function parseM2(text: string): number | null {
  const candidates: number[] = [];
  const re1 = /(\d{2,4})\s*(?:m²|m2|metros?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(text)) !== null) {
    const v = parseInt(m[1], 10);
    if (v >= 15 && v <= 2000) candidates.push(v);
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a - b);
  return candidates[Math.floor(candidates.length / 2)];
}
 
function parseDorms(text: string): number {
  const m = text.match(/(\d)\s*(dorm|quarto|qto|suíte|suite)/i);
  return m ? parseInt(m[1], 10) : 0;
}
 
function parseVagas(text: string): number {
  const m = text.match(/(\d)\s*(vaga|garagem)/i);
  return m ? parseInt(m[1], 10) : 0;
}
 
function parseDiasNoMercado(text: string): number | null {
  const dias = text.match(/h[aá]\s+(\d+)\s*dias?/i);
  if (dias) return parseInt(dias[1], 10);
  const meses = text.match(/h[aá]\s+(\d+)\s*meses?/i);
  if (meses) return parseInt(meses[1], 10) * 30;
  if (/h[aá]\s+(um|1)\s*m[eê]s/i.test(text)) return 30;
  if (/h[aá]\s+\d+\s*horas?/i.test(text) || /publicado\s*hoje/i.test(text)) return 0;
  const data = text.match(/(?:atualizado|publicado)\s*(?:em\s*)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  if (data) {
    const dd = parseInt(data[1], 10);
    const mm = parseInt(data[2], 10) - 1;
    let yy = parseInt(data[3], 10);
    if (yy < 100) yy += 2000;
    const then = new Date(yy, mm, dd).getTime();
    if (!isNaN(then)) {
      const diff = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff < 3650) return diff;
    }
  }
  return null;
}
 
// ---------- Helpers ----------
function enderecoCore(end: string | null | undefined): string {
  if (!end) return "";
  const semNumeroFinal = end.replace(/,?\s*\d+\s*$/, "").trim();
  return semNumeroFinal.split(",")[0]?.trim() ?? semNumeroFinal;
}
 
function snippetMatchesLocal(
  text: string,
  bairro: string | null | undefined,
  enderecoAlvo: string | null | undefined,
  nomePredio: string | null | undefined,
): boolean {
  const haystack = normKey(text);
  // NOVO: se tem nome do prédio, prioriza match por nome
  if (nomePredio) {
    const np = normKey(nomePredio);
    if (np && haystack.includes(np)) return true;
  }
  if (enderecoAlvo) {
    const core = normKey(enderecoCore(enderecoAlvo));
    if (core && haystack.includes(core)) return true;
  }
  if (bairro) {
    const b = normKey(bairro);
    if (b && haystack.includes(b)) return true;
  }
  return !bairro && !enderecoAlvo && !nomePredio;
}
 
function mask(v: string): string {
  if (!v) return "";
  if (v.length <= 8) return "***";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}
 
// ============================================================
// ETAPA 1 — SerpAPI
// ============================================================
interface SerpItem {
  title?: string;
  snippet?: string;
  link?: string;
}
 
async function serpSearch(apiKey: string, query: string, num = 20): Promise<SerpItem[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", String(num));
  url.searchParams.set("hl", "pt");
  url.searchParams.set("gl", "br");
 
  const masked = new URL(url.toString());
  masked.searchParams.set("api_key", mask(apiKey));
  console.log("[serpapi] GET", masked.toString());
 
  const t0 = Date.now();
  const res = await fetch(url.toString());
  const body = await res.text();
  console.log(`[serpapi] ← ${res.status} (${Date.now() - t0}ms) ${body.length}b`);
 
  if (!res.ok) {
    console.error("[serpapi] error:", body.slice(0, 300));
    return [];
  }
  let data: { organic_results?: SerpItem[]; error?: string };
  try { data = JSON.parse(body); } catch { return []; }
  if (data.error) {
    console.error("[serpapi] api error:", data.error);
    return [];
  }
  return data.organic_results ?? [];
}
 
interface DiscoveredUrl {
  portal: string;
  spec: PortalSpec;
  tipologia: string;
  url: string;
  serpTitle: string;
  serpSnippet: string;
}
 
async function descobrirUrls(
  s: MarketSearchRow,
  serpKey: string,
): Promise<DiscoveredUrl[]> {
  const portaisInput = s.portais.length ? s.portais : ["Viva Real", "ZAP Imóveis"];
  const portais = portaisInput
    .map((p) => ({ portal: p, spec: getPortalSpec(p) }))
    .filter((x): x is { portal: string; spec: PortalSpec } => !!x.spec);
 
  const ignorados = portaisInput.filter((p) => !getPortalSpec(p));
  if (ignorados.length) console.warn("[etapa1] portais sem spec (ignorados):", ignorados);
 
  const tipologias = s.tipologias.length ? s.tipologias : ["2 dorm"];
  const finalidade = normalizeFinalidade(s.finalidade);
  const sufFin = finalidade === "locacao" ? "aluguel" : "venda";
 
  // NOVO: se tem nome do prédio, monta query específica por prédio
  const temNomePredio = !!s.nome_predio?.trim();
  const enderecoQuery = enderecoCore(s.endereco_alvo);
 
  const localPieces = [
    temNomePredio
      ? `"${s.nome_predio!.trim()}"` // busca exata pelo nome do prédio
      : enderecoQuery ? `"${enderecoQuery}"` : "",
    s.bairro && !temNomePredio ? `"${s.bairro}"` : "",
    s.cidade,
    s.uf,
  ].filter(Boolean);
  const localQuery = localPieces.join(" ");
 
  const out: DiscoveredUrl[] = [];
 
  for (const { portal, spec } of portais) {
    const aceitosPortal = new Set<string>();
 
    for (const tipologia of tipologias) {
      const cat = categoriaDe(tipologia);
      const termo = temNomePredio
        ? tipologia.toLowerCase() // quando busca por prédio, termo simples
        : termoBusca(tipologia, cat);
 
      // FIX: para ZAP, usa -inurl:condominio para excluir páginas de condomínio
      const excludeCondominio = spec.condominioPattern ? " -inurl:condominio" : "";
      const query =
        `${termo} ${sufFin} ${localQuery} site:${spec.domain} inurl:${spec.inurl}${excludeCondominio}`
          .replace(/\s+/g, " ")
          .trim();
 
      console.log(`[etapa1] query: ${query}`);
      const items = await serpSearch(serpKey, query, MAX_SERP_POR_PORTAL);
      let aceitosTipologia = 0;
 
      for (const it of items) {
        const link = it.link ?? "";
        if (!link) continue;
        if (!link.includes(spec.domain)) continue;
 
        // FIX: exclui explicitamente páginas de condomínio
        if (spec.condominioPattern && spec.condominioPattern.test(link)) {
          console.log(`[etapa1] descartado (condomínio): ${link}`);
          continue;
        }
 
        if (!spec.individualUrlPattern.test(link)) {
          console.log(`[etapa1] descartado (não individual): ${link}`);
          continue;
        }
 
        if (aceitosPortal.has(link)) continue;
        aceitosPortal.add(link);
        out.push({
          portal,
          spec,
          tipologia,
          url: link,
          serpTitle: it.title ?? "",
          serpSnippet: it.snippet ?? "",
        });
        aceitosTipologia++;
        if (aceitosPortal.size >= MAX_URLS_POR_PORTAL) break;
      }
 
      console.log(
        `[etapa1] ${portal} / ${tipologia}: serp=${items.length} aceitos=${aceitosTipologia} total_portal=${aceitosPortal.size}`,
      );
      if (aceitosPortal.size >= MAX_URLS_POR_PORTAL) break;
    }
  }
 
  console.log(`[etapa1] total URLs descobertas: ${out.length}`);
  return out;
}
 
// ============================================================
// ETAPA 2 — Firecrawl
// ============================================================
interface FirecrawlScrapeResult {
  markdown?: string;
  html?: string;
  metadata?: { title?: string };
}
 
async function firecrawlScrape(
  fcKey: string,
  url: string,
): Promise<FirecrawlScrapeResult | null> {
  const t0 = Date.now();
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fcKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 1500,
        location: { country: "BR", languages: ["pt-BR"] },
      }),
    });
    const body = await res.text();
    console.log(`[firecrawl] ${res.status} (${Date.now() - t0}ms) ${url}`);
    if (!res.ok) {
      console.error(`[firecrawl] erro ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }
    const json = JSON.parse(body);
    const data = json.data ?? json;
    return {
      markdown: data.markdown,
      html: data.html,
      metadata: data.metadata,
    };
  } catch (e) {
    console.error(`[firecrawl] exception ${url}:`, e);
    return null;
  }
}
 
async function scrapeBatch(
  fcKey: string,
  urls: DiscoveredUrl[],
): Promise<Array<DiscoveredUrl & { scrape: FirecrawlScrapeResult | null }>> {
  const results: Array<DiscoveredUrl & { scrape: FirecrawlScrapeResult | null }> = [];
  for (let i = 0; i < urls.length; i += SCRAPE_CONCURRENCY) {
    const batch = urls.slice(i, i + SCRAPE_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (u) => ({ ...u, scrape: await firecrawlScrape(fcKey, u.url) })),
    );
    results.push(...batchResults);
  }
  return results;
}
 
// ============================================================
// Construção dos listings
// ============================================================
function buildListings(
  s: MarketSearchRow,
  scraped: Array<DiscoveredUrl & { scrape: FirecrawlScrapeResult | null }>,
): { listings: ListingDraft[]; descartes: Record<string, number> } {
  const finalidade = normalizeFinalidade(s.finalidade);
  const limits = LIMITS[finalidade];
  const m2Mid =
    s.m2_min && s.m2_max ? Math.round((Number(s.m2_min) + Number(s.m2_max)) / 2) : 0;
 
  const listings: ListingDraft[] = [];
  const descartes = {
    sem_scrape: 0,
    sem_preco: 0,
    sem_m2: 0,
    fora_local: 0,
    preco_m2_invalido: 0,
  };
 
  for (const item of scraped) {
    const titulo = item.scrape?.metadata?.title ?? item.serpTitle;
    const fullText = [
      titulo,
      item.scrape?.markdown ?? "",
      item.serpTitle,
      item.serpSnippet,
    ].join("\n");
 
    if (!item.scrape && !item.serpSnippet) {
      descartes.sem_scrape++;
      continue;
    }
 
    // FIX: passa nome_predio para o filtro de localidade
    if (!snippetMatchesLocal(fullText, s.bairro, s.endereco_alvo, s.nome_predio)) {
      descartes.fora_local++;
      continue;
    }
 
    const preco = parsePreco(fullText, finalidade);
    if (!preco) {
      descartes.sem_preco++;
      console.log(`[build] sem preço: ${item.url}`);
      continue;
    }
 
    let m2 = parseM2(fullText);
    if (!m2) {
      if (m2Mid > 0) {
        m2 = m2Mid;
      } else {
        descartes.sem_m2++;
        continue;
      }
    }
 
    let precoM2: number | null = m2 > 0 ? Math.round(preco / m2) : null;
    const valido =
      precoM2 != null &&
      precoM2 >= limits.precoM2Min &&
      precoM2 <= limits.precoM2Max;
    if (!valido) {
      descartes.preco_m2_invalido++;
      precoM2 = null;
    }
 
    const dias = parseDiasNoMercado(fullText);
    const cat = categoriaDe(item.tipologia);
 
    console.log(
      `[listing] ${(titulo ?? "").slice(0, 60)} | preco=${preco} | m2=${m2} | preco_m2=${precoM2} | dias=${dias} | válido=${valido}`,
    );
 
    listings.push({
      search_id: s.id,
      titulo: (titulo ?? "").slice(0, 280),
      endereco: `${s.endereco_alvo ? s.endereco_alvo + " — " : ""}${s.bairro ? s.bairro + ", " : ""}${s.cidade}/${s.uf}`,
      m2,
      dorms: cat === "residencial" ? parseDorms(fullText) : 0,
      vagas: cat === "terreno" ? 0 : parseVagas(fullText),
      preco,
      preco_m2: precoM2,
      portal: item.portal,
      tipologia: item.tipologia,
      url: item.url,
      lat: null,
      lng: null,
      dias_no_mercado: dias,
    });
  }
 
  return { listings, descartes };
}
 
// ============================================================
// Métricas e conclusões
// ============================================================
function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
 
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
 
function computeMetrics(search_id: string, listings: ListingDraft[]) {
  const precosM2Validos = listings
    .map((l) => l.preco_m2)
    .filter((v): v is number => v != null && v > 0);
  const precos = listings.map((l) => l.preco);
  const media = precosM2Validos.length
    ? precosM2Validos.reduce((a, b) => a + b, 0) / precosM2Validos.length
    : 0;
  const mediana = median(precosM2Validos);
 
  const min = listings.reduce((a, b) => (a.preco < b.preco ? a : b));
  const max = listings.reduce((a, b) => (a.preco > b.preco ? a : b));
 
  const tipoMap = new Map<string, number>();
  for (const l of listings) tipoMap.set(l.tipologia, (tipoMap.get(l.tipologia) ?? 0) + 1);
  const portalMap = new Map<string, number>();
  for (const l of listings) portalMap.set(l.portal, (portalMap.get(l.portal) ?? 0) + 1);
 
  const dias = listings.map((l) => l.dias_no_mercado).filter((v): v is number => v != null && v >= 0);
  const tempoMedio = dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : null;
 
  return {
    search_id,
    media: Math.round(media),
    mediana: Math.round(mediana),
    minimo_valor: min.preco,
    minimo_m2: min.m2,
    minimo_tipologia: min.tipologia,
    maximo_valor: max.preco,
    maximo_m2: max.m2,
    maximo_tipologia: max.tipologia,
    total: listings.length,
    desvio_padrao: Math.round(stddev(precos)),
    tempo_medio_mercado: tempoMedio,
    tipologias: Array.from(tipoMap, ([tipo, count]) => ({
      tipo,
      count,
      pct: Math.round((count / listings.length) * 100),
    })),
    portais: Array.from(portalMap, ([portal, count]) => ({ portal, count })),
  };
}
 
function computeConclusions(search_id: string, listings: ListingDraft[]) {
  const precosM2 = listings.map((l) => l.preco_m2).filter((v): v is number => v != null && v > 0);
  const mediaM2 = precosM2.length ? precosM2.reduce((a, b) => a + b, 0) / precosM2.length : 0;
  const tipoMap = new Map<string, number>();
  for (const l of listings) tipoMap.set(l.tipologia, (tipoMap.get(l.tipologia) ?? 0) + 1);
  const dominante = [...tipoMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const m2Medio = listings.reduce((a, b) => a + b.m2, 0) / (listings.length || 1);
  const estimativa = precosM2.length ? Math.round(m2Medio * median(precosM2)) : 0;
 
  return {
    search_id,
    posicionamento: `Preço médio do m² na região: R$ ${Math.round(mediaM2).toLocaleString("pt-BR")}.`,
    oferta_demanda: `${listings.length} anúncios ativos coletados nos portais selecionados.`,
    tipologia_dominante: `Tipologia mais ofertada: ${dominante}.`,
    competitividade: `Amostra com desvio padrão moderado — mercado com oferta diversificada.`,
    estimativa_ativo: estimativa,
  };
}
 
// ============================================================
// Handler
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 
  try {
    const { search_id } = await req.json().catch(() => ({}));
    if (!search_id || typeof search_id !== "string") {
      return new Response(JSON.stringify({ error: "search_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
 
    const serpKey = Deno.env.get("SERPAPI_KEY");
    if (!serpKey) {
      return new Response(JSON.stringify({ error: "SERPAPI_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!fcKey) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
 
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
 
    const { data: search, error: searchErr } = await supabase
      .from("market_searches")
      .select("id, created_by, uf, cidade, bairro, endereco_alvo, tipologias, m2_min, m2_max, margem_pct, portais, finalidade, raio_metros, nome_predio")
      .eq("id", search_id)
      .maybeSingle();
 
    if (searchErr) throw searchErr;
    if (!search) {
      return new Response(JSON.stringify({ error: "Pesquisa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
 
    await supabase.from("market_searches").update({ status: "processando" }).eq("id", search_id);
    const s = search as MarketSearchRow;
 
    const urls = await descobrirUrls(s, serpKey);
    const scraped = urls.length ? await scrapeBatch(fcKey, urls) : [];
    console.log(`[etapa2] scraped=${scraped.length} (sucesso=${scraped.filter((x) => x.scrape).length})`);
 
    const { listings, descartes } = buildListings(s, scraped);
    console.log(`[build] listings=${listings.length} descartes=${JSON.stringify(descartes)}`);
 
    await supabase.from("market_listings").delete().eq("search_id", search_id);
    await supabase.from("market_metrics").delete().eq("search_id", search_id);
    await supabase.from("market_conclusions").delete().eq("search_id", search_id);
 
    if (listings.length === 0) {
      await supabase
        .from("market_searches")
        .update({ status: "sem_resultados", updated_at: new Date().toISOString() })
        .eq("id", search_id);
      return new Response(
        JSON.stringify({
          success: true,
          search_id,
          listings_count: 0,
          urls_descobertas: urls.length,
          descartes,
          message: "Nenhum anúncio encontrado.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
 
    const { error: insListErr } = await supabase.from("market_listings").insert(listings);
    if (insListErr) throw insListErr;
 
    const metrics = computeMetrics(search_id, listings);
    const { error: insMetricsErr } = await supabase.from("market_metrics").insert(metrics);
    if (insMetricsErr) throw insMetricsErr;
 
    const conclusions = computeConclusions(search_id, listings);
    const { error: insConclErr } = await supabase.from("market_conclusions").insert(conclusions);
    if (insConclErr) throw insConclErr;
 
    await supabase
      .from("market_searches")
      .update({ status: "concluida", updated_at: new Date().toISOString() })
      .eq("id", search_id);
 
    return new Response(
      JSON.stringify({
        success: true,
        search_id,
        listings_count: listings.length,
        urls_descobertas: urls.length,
        descartes,
        metrics_summary: { total: metrics.total, media: metrics.media, mediana: metrics.mediana },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("market-search error:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
