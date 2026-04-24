// Edge Function: market-search
// Recebe { search_id }, busca anúncios via Google Custom Search API,
// parseia preço/metragem dos snippets, calcula métricas e persiste em
// market_listings + market_metrics + market_conclusions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MarketSearchRow {
  id: string;
  user_id: string;
  uf: string;
  cidade: string;
  bairro: string | null;
  endereco_alvo: string | null;
  tipologias: string[];
  m2_min: number | null;
  m2_max: number | null;
  margem: number;
  portais: string[];
  finalidade: string;
  raio: number;
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

// ---- Filtros para distinguir anúncio individual de página de listagem ----
const URL_LISTAGEM = /\/(busca|search|resultado|resultados|lista|listagem)(\/|\?|$)/i;
const URL_ANUNCIO = /(\/imovel\/|\/imoveis\/|\/anuncio\/|\/id-|\/ap-|\/casa-|\/apartamento-|\/MLB-|\/imovel-|\/p\/|\/property\/|-id-\d+)/i;
// Títulos como "29 Kitnets à venda em Centro" ou "48 Apartamentos ..."
const TITULO_LISTAGEM = /^\s*\d+\s+[A-Za-zÀ-ÿ]+/;

function isUrlAnuncioIndividual(url: string): boolean {
  if (!url) return false;
  if (URL_LISTAGEM.test(url)) return false;
  return URL_ANUNCIO.test(url);
}

function isTituloListagem(titulo: string): boolean {
  return TITULO_LISTAGEM.test(titulo);
}

function parseDiasNoMercado(text: string): number | null {
  // "Publicado há 3 dias", "Atualizado há 12 dias", "há 1 mês", "há 2 meses"
  const dias = text.match(/h[aá]\s+(\d+)\s*dias?/i);
  if (dias) return parseInt(dias[1], 10);
  const meses = text.match(/h[aá]\s+(\d+)\s*meses?|h[aá]\s+(um|1)\s*m[eê]s/i);
  if (meses) {
    const n = meses[1] ? parseInt(meses[1], 10) : 1;
    return n * 30;
  }
  const horas = text.match(/h[aá]\s+(\d+)\s*horas?/i);
  if (horas) return 0;
  return null;
}

// ---------- Mapeamento Portal -> domínio ----------
// Chaves normalizadas (lowercase, sem acento, sem espaços).
const PORTAL_DOMAINS: Record<string, string> = {
  "vivareal": "vivareal.com.br",
  "zap": "zapimoveis.com.br",
  "zapimoveis": "zapimoveis.com.br",
  "quintoandar": "quintoandar.com.br",
  "imovelweb": "imovelweb.com.br",
  "olx": "olx.com.br",
  "loft": "loft.com.br",
  "chavesnamao": "chavesnamao.com.br",
  "mercadolivre": "mercadolivre.com.br",
};

function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function portalDomain(portal: string): string | null {
  const key = normKey(portal);
  return PORTAL_DOMAINS[key] ?? null;
}

// ---------- Parsers ----------
type Finalidade = "venda" | "locacao";

// Limites de sanidade por finalidade
// preco_total: range esperado de valores absolutos
// precoM2:    range esperado de R$/m² no Brasil
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

const RENT_SUFFIX = /\/\s*m[eê]s|por\s*m[eê]s|mensa(l|is)|ao\s*m[eê]s|\/m[eê]s/i;

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

function parsePrecoVenda(text: string): number | null {
  const patterns: RegExp[] = [
    /R\$\s*([\d.,]+)\s*(mi|milh[õo]es|mil)\b/i,
    /R\$\s*([\d.,]+)/i,
    /([\d.,]+)\s*(mi|milh[õo]es|mil)\s*(de\s*)?reais?/i,
    /([\d.,]+)\s*reais?/i,
  ];
  const { precoMin, precoMax } = LIMITS.venda;

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    let value = normalizeNumberPtBr(m[1]);
    if (isNaN(value)) continue;
    value = applySuffix(value, m[2] ?? "");
    value = Math.round(value);

    // Se houver indicador de aluguel ao redor do match, descarta
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
    let value = normalizeNumberPtBr(m[1]);
    if (isNaN(value)) continue;
    value = Math.round(value);
    if (value >= precoMin && value <= precoMax) return value;
  }
  return null;
}

function parsePreco(text: string, finalidade: Finalidade): number | null {
  return finalidade === "locacao" ? parsePrecoLocacao(text) : parsePrecoVenda(text);
}

function parseM2(text: string): number | null {
  const m = text.match(/(\d{2,4})\s?(m²|m2|metros)/i);
  if (!m) return null;
  const v = parseInt(m[1], 10);
  return v >= 15 && v <= 2000 ? v : null;
}

function parseDorms(text: string): number {
  const m = text.match(/(\d)\s*(dorm|quarto|qto)/i);
  return m ? parseInt(m[1], 10) : 2;
}

function parseVagas(text: string): number {
  const m = text.match(/(\d)\s*(vaga|garagem)/i);
  return m ? parseInt(m[1], 10) : 1;
}

// ---------- SerpAPI ----------
interface SerpItem {
  title?: string;
  snippet?: string;
  link?: string;
}

function mask(v: string): string {
  if (!v) return "";
  if (v.length <= 8) return "***";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

async function googleSearch(
  apiKey: string,
  _cx: string,
  query: string,
): Promise<SerpItem[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", "10");
  url.searchParams.set("hl", "pt");
  url.searchParams.set("gl", "br");

  const maskedUrl = new URL(url.toString());
  maskedUrl.searchParams.set("api_key", mask(apiKey));
  console.log("[serpapi] GET", maskedUrl.toString());

  const started = Date.now();
  const res = await fetch(url.toString());
  const elapsed = Date.now() - started;
  const body = await res.text();
  console.log(`[serpapi] ← status=${res.status} (${elapsed}ms) bytes=${body.length}`);

  if (!res.ok) {
    console.error("[serpapi] error body:", body);
    return [];
  }

  let data: {
    organic_results?: SerpItem[];
    search_information?: { total_results?: number };
    error?: string;
  };
  try {
    data = JSON.parse(body);
  } catch (e) {
    console.error("[serpapi] JSON parse failed:", e, "body:", body.slice(0, 500));
    return [];
  }

  if (data.error) {
    console.error("[serpapi] api error:", data.error);
    return [];
  }

  const items = Array.isArray(data.organic_results) ? data.organic_results : [];
  console.log(
    `[serpapi] total_results=${data.search_information?.total_results ?? "?"} items=${items.length}`,
  );
  return items;
}

// ---------- Categorização de tipologia ----------
const COMERCIAIS = new Set([
  "Sala comercial", "Loja", "Andar corporativo", "Galpão", "Pavilhão",
]);
const TERRENOS = new Set([
  "Terreno", "Lote em condomínio", "Área industrial",
]);

type Categoria = "residencial" | "comercial" | "terreno";
function categoriaDe(tipologia: string): Categoria {
  if (COMERCIAIS.has(tipologia)) return "comercial";
  if (TERRENOS.has(tipologia)) return "terreno";
  return "residencial";
}

function termoBusca(tipologia: string, cat: Categoria): string {
  const t = tipologia.trim();
  if (cat === "residencial") {
    if (/studio|kitnet|kitinete/i.test(t)) {
      return `apartamento (studio OR kitnet)`;
    }
    const mDorm = t.match(/^(\d+)\s*dorm/i);
    if (mDorm) {
      const n = mDorm[1];
      return `apartamento (${n} dormitorios OR ${n} quartos OR ${n} dorm)`;
    }
    return t.toLowerCase();
  }
  return t.toLowerCase();
}

// Extrai um "núcleo" curto do endereço (até a vírgula ou número),
// para inserir na query e como termo de filtro.
function enderecoCore(end: string | null | undefined): string {
  if (!end) return "";
  const semNumeroFinal = end.replace(/,?\s*\d+\s*$/, "").trim();
  const antesVirgula = semNumeroFinal.split(",")[0]?.trim() ?? semNumeroFinal;
  return antesVirgula;
}

function snippetMatchesLocal(
  text: string,
  bairro: string | null | undefined,
  enderecoAlvo: string | null | undefined,
): boolean {
  const haystack = normKey(text);
  if (enderecoAlvo) {
    const core = normKey(enderecoCore(enderecoAlvo));
    if (core && haystack.includes(core)) return true;
  }
  if (bairro) {
    const b = normKey(bairro);
    if (b && haystack.includes(b)) return true;
  }
  return !bairro && !enderecoAlvo;
}

async function fetchListings(
  s: MarketSearchRow,
  apiKey: string,
  cx: string,
): Promise<ListingDraft[]> {
  // Estrito: usa apenas portais selecionados; ignora portais sem domínio mapeado.
  const portaisInput = s.portais.length ? s.portais : ["Viva Real", "ZAP Imóveis"];
  const portaisResolvidos = portaisInput
    .map((p) => ({ portal: p, domain: portalDomain(p) }))
    .filter((p): p is { portal: string; domain: string } => !!p.domain);
  const portaisIgnorados = portaisInput.filter((p) => !portalDomain(p));
  if (portaisIgnorados.length) {
    console.warn("[parser] portais sem domínio mapeado (ignorados):", portaisIgnorados);
  }
  console.log("[parser] portais ativos:", portaisResolvidos.map((p) => `${p.portal}=>${p.domain}`));

  const tipologias = s.tipologias.length ? s.tipologias : ["2 dorm"];
  const m2Mid =
    s.m2_min && s.m2_max ? Math.round((Number(s.m2_min) + Number(s.m2_max)) / 2) : 90;
  const finalidade = normalizeFinalidade(s.finalidade);
  const limits = LIMITS[finalidade];
  console.log(`[parser] finalidade=${finalidade} limites=`, limits);

  const enderecoQuery = enderecoCore(s.endereco_alvo);
  const localQuery = [
    enderecoQuery,
    s.bairro ?? "",
    s.cidade,
    s.uf,
  ]
    .filter(Boolean)
    .join(" ");

  const listings: ListingDraft[] = [];
  let descartadosSemPreco = 0;
  let descartadosForaLocal = 0;
  let descartadosDominio = 0;
  let descartadosUrlListagem = 0;
  let descartadosTituloListagem = 0;
  let descartadosPrecoM2Invalido = 0;

  for (const { portal, domain } of portaisResolvidos) {
    for (const tipologia of tipologias) {
      const cat = categoriaDe(tipologia);
      const termo = termoBusca(tipologia, cat);
      const sufixoFinalidade = finalidade === "locacao" ? "aluguel" : "venda";
      const baseQuery = `${termo} ${sufixoFinalidade} ${localQuery}`
        .replace(/\s+/g, " ")
        .trim();
      // Forçar páginas de anúncio individual (não listagem)
      const query = `${baseQuery} site:${domain} (inurl:imovel OR inurl:anuncio OR inurl:imoveis)`;
      console.log("Query:", query);

      const items = await googleSearch(apiKey, cx, query);
      for (const item of items) {
        const titulo = item.title ?? "";
        const text = `${titulo} ${item.snippet ?? ""}`;
        const link = item.link ?? "";

        // 1. Domínio do portal selecionado
        if (link && !link.includes(domain)) {
          descartadosDominio++;
          continue;
        }

        // 2. URL deve ser de anúncio individual, não listagem
        if (!isUrlAnuncioIndividual(link)) {
          descartadosUrlListagem++;
          console.log(`[parser] descartado URL listagem/inválida: ${link}`);
          continue;
        }

        // 3. Título não pode começar com "N <plural>" (página de listagem)
        if (isTituloListagem(titulo)) {
          descartadosTituloListagem++;
          console.log(`[parser] descartado título listagem: "${titulo}"`);
          continue;
        }

        // 4. Filtro local (bairro / endereço alvo)
        if (!snippetMatchesLocal(text, s.bairro, s.endereco_alvo)) {
          descartadosForaLocal++;
          continue;
        }

        // 5. Preço deve estar presente e parseável
        const preco = parsePreco(text, finalidade);
        const m2 = parseM2(text) ?? m2Mid;
        if (!preco) {
          descartadosSemPreco++;
          continue;
        }

        // 6. preco_m2 sempre calculado; se fora do range, salva null
        let precoM2: number | null = m2 > 0 ? Math.round(preco / m2) : null;
        const valido =
          precoM2 != null &&
          precoM2 >= limits.precoM2Min &&
          precoM2 <= limits.precoM2Max;
        if (!valido) {
          descartadosPrecoM2Invalido++;
          precoM2 = null;
        }
        console.log(
          `[listing] ${titulo.slice(0, 80)} | preco_total=${preco} | m2=${m2} | preco_m2=${precoM2} | válido=${valido}`,
        );

        const dias = parseDiasNoMercado(text);

        listings.push({
          search_id: s.id,
          titulo: titulo.slice(0, 280),
          endereco: `${s.endereco_alvo ? s.endereco_alvo + " — " : ""}${s.bairro ? s.bairro + ", " : ""}${s.cidade}/${s.uf}`,
          m2,
          dorms: cat === "residencial" ? parseDorms(text) : 0,
          vagas: cat === "terreno" ? 0 : parseVagas(text),
          preco,
          preco_m2: precoM2,
          portal,
          tipologia,
          url: link,
          lat: null,
          lng: null,
          dias_no_mercado: dias,
        });
      }
    }
  }

  console.log(
    `[parser/${finalidade}] aceitos=${listings.length} sem_preco=${descartadosSemPreco} fora_local=${descartadosForaLocal} dominio=${descartadosDominio} url_listagem=${descartadosUrlListagem} titulo_listagem=${descartadosTituloListagem} preco_m2_invalido=${descartadosPrecoM2Invalido}`,
  );
  return listings;
}


// ---------- Métricas ----------
function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeMetrics(search_id: string, listings: ListingDraft[]) {
  // Para média/mediana de R$/m² ignoramos preco_m2=null (fora de range)
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

  const dias = listings
    .map((l) => l.dias_no_mercado)
    .filter((v): v is number => v != null && v >= 0);
  const tempoMedioMercado = dias.length
    ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length)
    : null;

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
    tempo_medio_mercado: tempoMedioMercado,
    tipologias: Array.from(tipoMap, ([tipo, count]) => ({
      tipo,
      count,
      pct: Math.round((count / listings.length) * 100),
    })),
    portais: Array.from(portalMap, ([portal, count]) => ({ portal, count })),
  };
}

function computeConclusions(search_id: string, listings: ListingDraft[]) {
  const precosM2 = listings
    .map((l) => l.preco_m2)
    .filter((v): v is number => v != null && v > 0);
  const mediaM2 = precosM2.length
    ? precosM2.reduce((a, b) => a + b, 0) / precosM2.length
    : 0;
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

// ---------- Handler ----------
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

    const apiKey = Deno.env.get("SERPAPI_KEY");
    const cx = ""; // não usado pela SerpAPI
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "SERPAPI_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Carrega a pesquisa
    const { data: search, error: searchErr } = await supabase
      .from("market_searches")
      .select(
        "id, user_id, uf, cidade, bairro, endereco_alvo, tipologias, m2_min, m2_max, margem, portais, finalidade, raio",
      )
      .eq("id", search_id)
      .maybeSingle();

    if (searchErr) throw searchErr;
    if (!search) {
      return new Response(JSON.stringify({ error: "Pesquisa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("market_searches")
      .update({ status: "processando" })
      .eq("id", search_id);

    // 2. Busca real via Google Custom Search
    const listings = await fetchListings(search as MarketSearchRow, apiKey, cx);
    console.log(`Total listings parseados: ${listings.length}`);

    // 3. Limpa dados antigos
    await supabase.from("market_listings").delete().eq("search_id", search_id);
    await supabase.from("market_metrics").delete().eq("search_id", search_id);
    await supabase.from("market_conclusions").delete().eq("search_id", search_id);

    if (listings.length === 0) {
      await supabase
        .from("market_searches")
        .update({ status: "sem_resultados", updated_at: new Date().toISOString() })
        .eq("id", search_id);
      return new Response(
        JSON.stringify({ success: true, search_id, listings_count: 0, message: "Nenhum anúncio encontrado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: insListErr } = await supabase.from("market_listings").insert(listings);
    if (insListErr) throw insListErr;

    const metrics = computeMetrics(search_id, listings);
    const { error: insMetricsErr } = await supabase.from("market_metrics").insert(metrics);
    if (insMetricsErr) throw insMetricsErr;

    const conclusions = computeConclusions(search_id, listings);
    const { error: insConclErr } = await supabase
      .from("market_conclusions")
      .insert(conclusions);
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
