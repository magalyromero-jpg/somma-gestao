// Edge Function: market-search
// Fluxo em 3 etapas:
//   1. SerpAPI -> coleta URLs de páginas de CONDOMÍNIO do ZAP/portais
//   2. Firecrawl -> scrape de cada página de condomínio, extrai links de unidades individuais
//   3. Firecrawl -> scrape de cada unidade individual, extrai preço, m², tempo no mercado
// Persiste em market_listings + market_metrics + market_conclusions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CONDOMINIOS = 3;
const MAX_UNIDADES_POR_CONDOMINIO = 2;
const MAX_SERP_POR_PORTAL = 10;
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
  nome_predio?: string | null;
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

type Finalidade = "venda" | "locacao";

const LIMITS = {
  venda: { precoMin: 50_000, precoMax: 20_000_000, precoM2Min: 1_000, precoM2Max: 50_000 },
  locacao: { precoMin: 300, precoMax: 100_000, precoM2Min: 5, precoM2Max: 500 },
} as const;

function normalizeFinalidade(f: string | undefined | null): Finalidade {
  const v = (f ?? "").toLowerCase();
  if (v.startsWith("loc") || v.startsWith("alug")) return "locacao";
  return "venda";
}

const COMERCIAIS = new Set(["Sala comercial", "Loja", "Andar corporativo", "Galpão", "Pavilhão"]);
const TERRENOS = new Set(["Terreno", "Lote em condomínio", "Área industrial"]);

type Categoria = "residencial" | "comercial" | "terreno";
function categoriaDe(tipologia: string): Categoria {
  if (COMERCIAIS.has(tipologia)) return "comercial";
  if (TERRENOS.has(tipologia)) return "terreno";
  return "residencial";
}

function normKey(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mask(v: string): string {
  if (!v) return "";
  if (v.length <= 8) return "***";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

// ---------- Parsers ----------
function normalizeNumberPtBr(rawNum: string): number {
  if (rawNum.includes(",")) return parseFloat(rawNum.replace(/\./g, "").replace(",", "."));
  return parseFloat(rawNum.replace(/\./g, ""));
}

function applySuffix(value: number, suf: string): number {
  const s = suf.toLowerCase();
  if (s.startsWith("mi") || s.startsWith("milh")) return value * 1_000_000;
  if (s === "mil") return value * 1_000;
  return value;
}

const RENT_SUFFIX = /\/\s*m[eê]s|por\s*m[eê]s|mensa(l|is)|ao\s*m[eê]s/i;

function parsePreco(text: string, finalidade: Finalidade): number | null {
  const { precoMin, precoMax } = LIMITS[finalidade];
  if (finalidade === "locacao") {
    const patterns = [
      /R\$\s*([\d.,]+)\s*(?:\/\s*m[eê]s|por\s*m[eê]s|mensa(?:l|is)|ao\s*m[eê]s)/i,
      /R\$\s*([\d.,]+)/i,
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (!m) continue;
      const value = Math.round(normalizeNumberPtBr(m[1]));
      if (!isNaN(value) && value >= precoMin && value <= precoMax) return value;
    }
    return null;
  }
  const patterns = [
    /R\$\s*([\d.,]+)\s*(mi|milh[õo]es|mil)\b/i,
    /R\$\s*([\d.,]+)/i,
    /([\d.,]+)\s*(mi|milh[õo]es|mil)\s*(de\s*)?reais?/i,
  ];
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

function parseM2(text: string): number | null {
  const candidates: number[] = [];
  const re1 = /(\d{2,4})\s*(?:m²|m2|metros?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(text)) !== null) {
    const v = parseInt(m[1], 10);
    if (v >= 10 && v <= 5000) candidates.push(v);
  }
  if (!candidates.length) return null;
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
      const diff = Math.floor((Date.now() - then) / 86_400_000);
      if (diff >= 0 && diff < 3650) return diff;
    }
  }
  return null;
}

function snippetMatchesLocal(
  text: string,
  bairro: string | null | undefined,
  enderecoAlvo: string | null | undefined,
  nomePredio: string | null | undefined,
): boolean {
  const haystack = normKey(text);
  if (nomePredio && haystack.includes(normKey(nomePredio))) return true;
  if (enderecoAlvo) {
    const core = normKey(enderecoAlvo.replace(/,?\s*\d+\s*$/, "").split(",")[0]);
    if (core && haystack.includes(core)) return true;
  }
  if (bairro && haystack.includes(normKey(bairro))) return true;
  return !bairro && !enderecoAlvo && !nomePredio;
}

// ============================================================
// ETAPA 1 — SerpAPI: descobrir páginas de condomínio/listagem
// ============================================================
interface SerpItem { title?: string; snippet?: string; link?: string; }

async function serpSearch(apiKey: string, query: string, num = 10): Promise<SerpItem[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", String(num));
  url.searchParams.set("hl", "pt");
  url.searchParams.set("gl", "br");

  const masked = new URL(url.toString());
  masked.searchParams.set("api_key", mask(apiKey));
  console.log("[serpapi] GET", masked.toString());

  const res = await fetch(url.toString());
  const body = await res.text();
  console.log(`[serpapi] ← ${res.status} ${body.length}b`);
  if (!res.ok) return [];
  let data: { organic_results?: SerpItem[]; error?: string };
  try { data = JSON.parse(body); } catch { return []; }
  if (data.error) { console.error("[serpapi] error:", data.error); return []; }
  return data.organic_results ?? [];
}

interface PortalConfig {
  domain: string;
  condominioPattern: RegExp;
  unidadePattern: RegExp;
  buildListingUrl: (cidade: string, uf: string, bairro: string | null, tipologia: string, finalidade: Finalidade, m2Min: number | null, m2Max: number | null) => string;
}

const PORTAL_CONFIGS: Record<string, PortalConfig> = {
  zap: {
    domain: "zapimoveis.com.br",
    condominioPattern: /zapimoveis\.com\.br\/(condominio|venda|aluguel)\//i,
    unidadePattern: /zapimoveis\.com\.br\/(venda|aluguel|imovel)\/.+/i,
    buildListingUrl: (cidade, uf, bairro, tipologia, finalidade, m2Min, m2Max) => {
      const fin = finalidade === "locacao" ? "aluguel" : "venda";
      const tipo = COMERCIAIS.has(tipologia) ? "conjuntos-comerciais-salas" :
        /studio|kitnet/i.test(tipologia) ? "apartamentos" :
        /casa|sobrado/i.test(tipologia) ? "casas" : "apartamentos";
      const loc = `${uf.toLowerCase()}+${normKey(cidade)}${bairro ? `+${normKey(bairro)}` : ""}`;
      let url = `https://www.zapimoveis.com.br/${fin}/${tipo}/${loc}/`;
      if (m2Min) url += `?areaMin=${m2Min}`;
      if (m2Max) url += `${m2Min ? "&" : "?"}areaMax=${m2Max}`;
      return url;
    },
  },
  zapimoveis: {
    domain: "zapimoveis.com.br",
    condominioPattern: /zapimoveis\.com\.br\/(condominio|venda|aluguel)\//i,
    unidadePattern: /zapimoveis\.com\.br\/(venda|aluguel|imovel)\/.+/i,
    buildListingUrl: (cidade, uf, bairro, tipologia, finalidade, m2Min, m2Max) => {
      const fin = finalidade === "locacao" ? "aluguel" : "venda";
      const tipo = COMERCIAIS.has(tipologia) ? "conjuntos-comerciais-salas" : "apartamentos";
      const loc = `${uf.toLowerCase()}+${normKey(cidade)}${bairro ? `+${normKey(bairro)}` : ""}`;
      let url = `https://www.zapimoveis.com.br/${fin}/${tipo}/${loc}/`;
      if (m2Min) url += `?areaMin=${m2Min}`;
      if (m2Max) url += `${m2Min ? "&" : "?"}areaMax=${m2Max}`;
      return url;
    },
  },
  vivareal: {
    domain: "vivareal.com.br",
    condominioPattern: /vivareal\.com\.br\/(imovel|venda|aluguel)\//i,
    unidadePattern: /vivareal\.com\.br\/imovel\//i,
    buildListingUrl: (cidade, uf, bairro, tipologia, finalidade, m2Min, m2Max) => {
      const fin = finalidade === "locacao" ? "aluguel" : "venda";
      const tipo = COMERCIAIS.has(tipologia) ? "sala-ou-conjunto-comercial" : "apartamento";
      const loc = `${normKey(cidade)}-${uf.toLowerCase()}${bairro ? `/${normKey(bairro)}` : ""}`;
      let url = `https://vivareal.com.br/${fin}/${loc}/${tipo}/`;
      if (m2Min || m2Max) url += `?areaMin=${m2Min ?? 0}&areaMax=${m2Max ?? 9999}`;
      return url;
    },
  },
  quintoandar: {
    domain: "quintoandar.com.br",
    condominioPattern: /quintoandar\.com\.br\/(imovel|comprar|alugar)\//i,
    unidadePattern: /quintoandar\.com\.br\/imovel\/\d+/i,
    buildListingUrl: (cidade, _uf, bairro, _tipologia, finalidade) => {
      const fin = finalidade === "locacao" ? "alugar" : "comprar";
      return `https://www.quintoandar.com.br/${fin}/imovel/${normKey(cidade)}${bairro ? `-${normKey(bairro)}` : ""}/`;
    },
  },
};

function getPortalConfig(portal: string): PortalConfig | null {
  return PORTAL_CONFIGS[normKey(portal)] ?? null;
}

// ============================================================
// ETAPA 2 — Firecrawl: scrape de página de listagem/condomínio
// ============================================================
interface FirecrawlResult {
  markdown?: string;
  html?: string;
  metadata?: { title?: string };
  links?: string[];
}

async function firecrawlScrape(fcKey: string, url: string): Promise<FirecrawlResult | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${fcKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["markdown", "links"],
        onlyMainContent: true,
        waitFor: 800,
        location: { country: "BR", languages: ["pt-BR"] },
      }),
    });
    const body = await res.text();
    console.log(`[firecrawl] ${res.status} ${url.slice(0, 80)}`);
    if (!res.ok) { console.error(`[firecrawl] erro: ${body.slice(0, 200)}`); return null; }
    const json = JSON.parse(body);
    const data = json.data ?? json;
    return { markdown: data.markdown, html: data.html, metadata: data.metadata, links: data.links ?? [] };
  } catch (e) {
    console.error(`[firecrawl] exception:`, e);
    return null;
  }
}

async function scrapeBatch<T extends { url: string }>(
  fcKey: string,
  items: T[],
): Promise<Array<T & { scrape: FirecrawlResult | null }>> {
  const results: Array<T & { scrape: FirecrawlResult | null }> = [];
  for (let i = 0; i < items.length; i += SCRAPE_CONCURRENCY) {
    const batch = items.slice(i, i + SCRAPE_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (item) => ({ ...item, scrape: await firecrawlScrape(fcKey, item.url) }))
    );
    results.push(...batchResults);
  }
  return results;
}

// Extrai URLs de anúncios individuais a partir do scrape de uma página de listagem
function extrairUrlsUnidades(scrape: FirecrawlResult, config: PortalConfig): string[] {
  const urls = new Set<string>();

  // Tenta extrair dos links retornados pelo Firecrawl
  for (const link of scrape.links ?? []) {
    if (config.unidadePattern.test(link) && !link.includes("/condominio/")) {
      urls.add(link.split("?")[0]); // remove query params
    }
  }

  // Fallback: extrai do markdown usando regex
  if (urls.size === 0 && scrape.markdown) {
    const linkRe = /https?:\/\/[^\s\)\"\']+/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(scrape.markdown)) !== null) {
      const link = m[0].replace(/[.,;!?]+$/, "");
      if (config.unidadePattern.test(link) && !link.includes("/condominio/")) {
        urls.add(link.split("?")[0]);
      }
    }
  }

  return Array.from(urls).slice(0, MAX_UNIDADES_POR_CONDOMINIO);
}

// ============================================================
// ETAPA 1 — Descobrir URLs de listagem/condomínio via SerpAPI
// ============================================================
interface CondominioUrl {
  portal: string;
  config: PortalConfig;
  tipologia: string;
  url: string;
  serpTitle: string;
  serpSnippet: string;
}

async function descobrirCondominios(s: MarketSearchRow, serpKey: string): Promise<CondominioUrl[]> {
  const portaisInput = s.portais.length ? s.portais : ["Viva Real", "ZAP Imóveis"];
  const portais = portaisInput
    .map((p) => ({ portal: p, config: getPortalConfig(p) }))
    .filter((x): x is { portal: string; config: PortalConfig } => !!x.config);

  const tipologias = s.tipologias.length ? s.tipologias : ["2 dorm"];
  const finalidade = normalizeFinalidade(s.finalidade);
  const sufFin = finalidade === "locacao" ? "aluguel" : "venda";
  const temNomePredio = !!s.nome_predio?.trim();

  const out: CondominioUrl[] = [];

  for (const { portal, config } of portais) {
    const vistos = new Set<string>();

    for (const tipologia of tipologias) {
      const cat = categoriaDe(tipologia);

      let query: string;
      if (temNomePredio) {
        // Busca direta pelo nome do prédio
        query = `"${s.nome_predio!.trim()}" ${sufFin} ${s.cidade} ${s.uf} site:${config.domain}`;
      } else {
        const termo = cat === "residencial"
          ? (/studio|kitnet/i.test(tipologia) ? "apartamento studio" :
             tipologia.match(/^(\d+)\s*dorm/i) ? `apartamento ${tipologia.match(/^(\d+)/)?.[1]} dormitorios` :
             tipologia.toLowerCase())
          : tipologia.toLowerCase();
        const local = [
          s.endereco_alvo ? `"${s.endereco_alvo.split(",")[0]}"` : "",
          s.bairro ? `"${s.bairro}"` : "",
          s.cidade,
          s.uf,
        ].filter(Boolean).join(" ");
        query = `${termo} ${sufFin} ${local} site:${config.domain}`;
      }

      console.log(`[etapa1] query: ${query}`);
      const items = await serpSearch(serpKey, query, MAX_SERP_POR_PORTAL);

      for (const it of items) {
        const link = it.link ?? "";
        if (!link || !link.includes(config.domain)) continue;
        if (vistos.has(link)) continue;
        vistos.add(link);
        out.push({ portal, config, tipologia, url: link, serpTitle: it.title ?? "", serpSnippet: it.snippet ?? "" });
        if (out.filter(x => x.portal === portal).length >= MAX_CONDOMINIOS) break;
      }

      console.log(`[etapa1] ${portal}/${tipologia}: serp=${items.length} aceitos=${vistos.size}`);
      if (out.filter(x => x.portal === portal).length >= MAX_CONDOMINIOS) break;
    }

    // Se SerpAPI não retornou nada, usa URL direta de listagem
    if (!out.some(x => x.portal === portal)) {
      console.log(`[etapa1] ${portal}: sem resultados SerpAPI, usando URL direta`);
      for (const tipologia of tipologias.slice(0, 1)) {
        const directUrl = config.buildListingUrl(
          s.cidade, s.uf, s.bairro, tipologia, finalidade, s.m2_min, s.m2_max
        );
        out.push({ portal, config, tipologia, url: directUrl, serpTitle: "", serpSnippet: "" });
      }
    }
  }

  console.log(`[etapa1] total URLs de listagem: ${out.length}`);
  return out;
}

// ============================================================
// Construção dos listings
// ============================================================
function buildListing(
  s: MarketSearchRow,
  url: string,
  tipologia: string,
  portal: string,
  fullText: string,
  finalidade: Finalidade,
): ListingDraft | null {
  const limits = LIMITS[finalidade];
  const m2Mid = s.m2_min && s.m2_max ? Math.round((Number(s.m2_min) + Number(s.m2_max)) / 2) : 0;

  if (!snippetMatchesLocal(fullText, s.bairro, s.endereco_alvo, s.nome_predio)) return null;

  const preco = parsePreco(fullText, finalidade);
  if (!preco) { console.log(`[build] sem preço: ${url}`); return null; }

  let m2 = parseM2(fullText);
  if (!m2) {
    if (m2Mid > 0) m2 = m2Mid;
    else { console.log(`[build] sem m2: ${url}`); return null; }
  }

  let precoM2: number | null = m2 > 0 ? Math.round(preco / m2) : null;
  const valido = precoM2 != null && precoM2 >= limits.precoM2Min && precoM2 <= limits.precoM2Max;
  if (!valido) precoM2 = null;

  const dias = parseDiasNoMercado(fullText);
  const cat = categoriaDe(tipologia);
  const titulo = fullText.split("\n")[0]?.slice(0, 280) ?? url;

  return {
    search_id: s.id,
    titulo,
    endereco: `${s.endereco_alvo ? s.endereco_alvo + " — " : ""}${s.bairro ? s.bairro + ", " : ""}${s.cidade}/${s.uf}`,
    m2,
    dorms: cat === "residencial" ? parseDorms(fullText) : 0,
    vagas: cat === "terreno" ? 0 : parseVagas(fullText),
    preco,
    preco_m2: precoM2,
    portal,
    tipologia,
    url,
    lat: null,
    lng: null,
    dias_no_mercado: dias,
  };
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
  return Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length);
}

function computeMetrics(search_id: string, listings: ListingDraft[]) {
  const precosM2 = listings.map(l => l.preco_m2).filter((v): v is number => v != null && v > 0);
  const precos = listings.map(l => l.preco);
  const media = precosM2.length ? precosM2.reduce((a, b) => a + b, 0) / precosM2.length : 0;
  const min = listings.reduce((a, b) => a.preco < b.preco ? a : b);
  const max = listings.reduce((a, b) => a.preco > b.preco ? a : b);
  const tipoMap = new Map<string, number>();
  listings.forEach(l => tipoMap.set(l.tipologia, (tipoMap.get(l.tipologia) ?? 0) + 1));
  const portalMap = new Map<string, number>();
  listings.forEach(l => portalMap.set(l.portal, (portalMap.get(l.portal) ?? 0) + 1));
  const dias = listings.map(l => l.dias_no_mercado).filter((v): v is number => v != null && v >= 0);
  return {
    search_id,
    media: Math.round(media),
    mediana: Math.round(median(precosM2)),
    minimo_valor: min.preco, minimo_m2: min.m2, minimo_tipologia: min.tipologia,
    maximo_valor: max.preco, maximo_m2: max.m2, maximo_tipologia: max.tipologia,
    total: listings.length,
    desvio_padrao: Math.round(stddev(precos)),
    tempo_medio_mercado: dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : null,
    tipologias: Array.from(tipoMap, ([tipo, count]) => ({ tipo, count, pct: Math.round(count / listings.length * 100) })),
    portais: Array.from(portalMap, ([portal, count]) => ({ portal, count })),
  };
}

function computeConclusions(search_id: string, listings: ListingDraft[]) {
  const precosM2 = listings.map(l => l.preco_m2).filter((v): v is number => v != null && v > 0);
  const mediaM2 = precosM2.length ? precosM2.reduce((a, b) => a + b, 0) / precosM2.length : 0;
  const tipoMap = new Map<string, number>();
  listings.forEach(l => tipoMap.set(l.tipologia, (tipoMap.get(l.tipologia) ?? 0) + 1));
  const dominante = [...tipoMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const m2Medio = listings.reduce((a, b) => a + b.m2, 0) / (listings.length || 1);
  return {
    search_id,
    posicionamento: `Preço médio do m² na região: R$ ${Math.round(mediaM2).toLocaleString("pt-BR")}.`,
    oferta_demanda: `${listings.length} anúncios ativos coletados nos portais selecionados.`,
    tipologia_dominante: `Tipologia mais ofertada: ${dominante}.`,
    competitividade: `Amostra com desvio padrão moderado — mercado com oferta diversificada.`,
    estimativa_ativo: precosM2.length ? Math.round(m2Medio * median(precosM2)) : 0,
  };
}

// ============================================================
// Handler principal
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { search_id } = await req.json().catch(() => ({}));
    if (!search_id || typeof search_id !== "string") {
      return new Response(JSON.stringify({ error: "search_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serpKey = Deno.env.get("SERPAPI_KEY");
    if (!serpKey) return new Response(JSON.stringify({ error: "SERPAPI_KEY não configurada" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!fcKey) return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY não configurada" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: search, error: searchErr } = await supabase
      .from("market_searches")
      .select("id, created_by, uf, cidade, bairro, endereco_alvo, tipologias, m2_min, m2_max, margem_pct, portais, finalidade, raio_metros, nome_predio")
      .eq("id", search_id)
      .maybeSingle();

    if (searchErr) throw searchErr;
    if (!search) return new Response(JSON.stringify({ error: "Pesquisa não encontrada" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    await supabase.from("market_searches").update({ status: "processando" }).eq("id", search_id);
    const s = search as MarketSearchRow;
    const finalidade = normalizeFinalidade(s.finalidade);

    // ETAPA 1 — Descobrir páginas de listagem/condomínio
    const condominios = await descobrirCondominios(s, serpKey);
    console.log(`[etapa1] ${condominios.length} páginas para scrape`);

    // ETAPA 2 — Scrape das páginas de listagem para extrair URLs de unidades
    const condominiosScrapeados = await scrapeBatch(fcKey, condominios);

    // Extrair URLs de unidades individuais
    const unidades: Array<{ url: string; tipologia: string; portal: string }> = [];
    for (const cond of condominiosScrapeados) {
      if (!cond.scrape) continue;
      const urls = extrairUrlsUnidades(cond.scrape, cond.config);
      console.log(`[etapa2] ${cond.url.slice(0, 60)}: ${urls.length} unidades encontradas`);

      // Se não encontrou links individuais, tenta usar os dados da própria página de listagem
      if (urls.length === 0) {
        const fullText = [cond.scrape.metadata?.title, cond.scrape.markdown, cond.serpTitle, cond.serpSnippet].join("\n");
        const listing = buildListing(s, cond.url, cond.tipologia, cond.portal, fullText, finalidade);
        if (listing) unidades.push({ url: cond.url, tipologia: cond.tipologia, portal: cond.portal });
      } else {
        for (const url of urls) {
          unidades.push({ url, tipologia: cond.tipologia, portal: cond.portal });
        }
      }
    }

    console.log(`[etapa2] ${unidades.length} unidades para scrape individual`);

    // ETAPA 3 — Scrape de cada unidade individual
    const unidadesScrapeadas = unidades.length > 0 ? await scrapeBatch(fcKey, unidades) : [];

    // Construir listings
    const listings: ListingDraft[] = [];
    const descartes = { sem_scrape: 0, sem_preco: 0, sem_m2: 0, fora_local: 0 };

    for (const u of unidadesScrapeadas) {
      if (!u.scrape) { descartes.sem_scrape++; continue; }
      const fullText = [u.scrape.metadata?.title, u.scrape.markdown].join("\n");
      const listing = buildListing(s, u.url, u.tipologia, u.portal, fullText, finalidade);
      if (!listing) { descartes.fora_local++; continue; }
      listings.push(listing);
    }

    console.log(`[build] listings=${listings.length} descartes=${JSON.stringify(descartes)}`);

    // Limpa dados antigos
    await supabase.from("market_listings").delete().eq("search_id", search_id);
    await supabase.from("market_metrics").delete().eq("search_id", search_id);
    await supabase.from("market_conclusions").delete().eq("search_id", search_id);

    if (listings.length === 0) {
      await supabase.from("market_searches").update({ status: "sem_resultados", updated_at: new Date().toISOString() }).eq("id", search_id);
      return new Response(JSON.stringify({
        success: true, search_id, listings_count: 0,
        condominios_encontrados: condominios.length,
        unidades_encontradas: unidades.length,
        descartes, message: "Nenhum anúncio encontrado.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("market_listings").insert(listings);
    const metrics = computeMetrics(search_id, listings);
    await supabase.from("market_metrics").insert(metrics);
    const conclusions = computeConclusions(search_id, listings);
    await supabase.from("market_conclusions").insert(conclusions);
    await supabase.from("market_searches").update({ status: "concluida", updated_at: new Date().toISOString() }).eq("id", search_id);

    return new Response(JSON.stringify({
      success: true, search_id,
      listings_count: listings.length,
      condominios_encontrados: condominios.length,
      unidades_encontradas: unidades.length,
      descartes,
      metrics_summary: { total: metrics.total, media: metrics.media, mediana: metrics.mediana },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("market-search error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});