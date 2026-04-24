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
  preco_m2: number;
  portal: string;
  tipologia: string;
  url: string;
  lat: number | null;
  lng: number | null;
}

// ---------- Mapeamento Portal -> domínio ----------
const PORTAL_DOMAINS: Record<string, string> = {
  "Viva Real": "vivareal.com.br",
  "VivaReal": "vivareal.com.br",
  "ZAP Imóveis": "zapimoveis.com.br",
  "ZAP": "zapimoveis.com.br",
  "QuintoAndar": "quintoandar.com.br",
  "Imovelweb": "imovelweb.com.br",
  "OLX": "olx.com.br",
  "Loft": "loft.com.br",
  "Chaves na Mão": "chavesnamao.com.br",
};

function portalDomain(portal: string): string {
  return PORTAL_DOMAINS[portal] ?? portal.toLowerCase().replace(/\s+/g, "") + ".com.br";
}

// ---------- Parsers ----------
function parsePreco(text: string): number | null {
  // Captura valores como "R$ 1.250.000", "R$ 850.000,00", "R$1.2 mi"
  const m = text.match(/R\$\s*([\d.,]+)(\s*(mi|milh[õo]es|mil))?/i);
  if (!m) return null;
  let raw = m[1].replace(/\./g, "").replace(",", ".");
  let value = parseFloat(raw);
  if (isNaN(value)) return null;
  const suf = (m[3] ?? "").toLowerCase();
  if (suf.startsWith("mi") || suf.startsWith("milh")) value *= 1_000_000;
  else if (suf === "mil") value *= 1_000;
  return value > 1000 ? Math.round(value) : null; // ignora preços irreais
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

// ---------- Google Custom Search ----------
interface GoogleItem {
  title?: string;
  snippet?: string;
  link?: string;
  pagemap?: Record<string, unknown>;
}

async function googleSearch(
  apiKey: string,
  cx: string,
  query: string,
): Promise<GoogleItem[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "10");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    console.error("Google Search error:", res.status, body);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
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
  if (cat === "residencial") {
    // "2 dorm" -> "apartamento 2 dorm"; tipos como Casa/Cobertura ficam diretos
    const isDorm = /\bdorm\b|studio/i.test(tipologia);
    return isDorm ? `apartamento ${tipologia}` : tipologia.toLowerCase();
  }
  if (cat === "comercial") return tipologia.toLowerCase();
  return tipologia.toLowerCase(); // terreno
}

async function fetchListings(
  s: MarketSearchRow,
  apiKey: string,
  cx: string,
): Promise<ListingDraft[]> {
  const portais = s.portais.length ? s.portais : ["Viva Real", "ZAP Imóveis"];
  const tipologias = s.tipologias.length ? s.tipologias : ["2 dorm"];
  const m2Mid =
    s.m2_min && s.m2_max ? Math.round((Number(s.m2_min) + Number(s.m2_max)) / 2) : 90;

  const listings: ListingDraft[] = [];

  for (const portal of portais) {
    const domain = portalDomain(portal);
    for (const tipologia of tipologias) {
      const cat = categoriaDe(tipologia);
      const termo = termoBusca(tipologia, cat);
      const baseQuery = `${termo} ${m2Mid}m² ${s.bairro ?? ""} ${s.cidade} ${s.uf}`
        .replace(/\s+/g, " ")
        .trim();
      const query = `${baseQuery} site:${domain}`;
      console.log("Query:", query);

      const items = await googleSearch(apiKey, cx, query);
      for (const item of items) {
        const text = `${item.title ?? ""} ${item.snippet ?? ""}`;
        const preco = parsePreco(text);
        const m2 = parseM2(text) ?? m2Mid;
        if (!preco) continue;

        const precoM2 = Math.round(preco / m2);
        listings.push({
          search_id: s.id,
          titulo: (item.title ?? "").slice(0, 280),
          endereco: `${s.bairro ? s.bairro + ", " : ""}${s.cidade}/${s.uf}`,
          m2,
          dorms: cat === "residencial" ? parseDorms(text) : 0,
          vagas: cat === "terreno" ? 0 : parseVagas(text),
          preco,
          preco_m2: precoM2,
          portal,
          tipologia,
          url: item.link ?? "",
          lat: null,
          lng: null,
        });
      }
    }
  }

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
  const precos = listings.map((l) => l.preco);
  const media = precos.reduce((a, b) => a + b, 0) / (precos.length || 1);

  const min = listings.reduce((a, b) => (a.preco < b.preco ? a : b));
  const max = listings.reduce((a, b) => (a.preco > b.preco ? a : b));

  const tipoMap = new Map<string, number>();
  for (const l of listings) tipoMap.set(l.tipologia, (tipoMap.get(l.tipologia) ?? 0) + 1);
  const portalMap = new Map<string, number>();
  for (const l of listings) portalMap.set(l.portal, (portalMap.get(l.portal) ?? 0) + 1);

  return {
    search_id,
    media: Math.round(media),
    mediana: Math.round(median(precos)),
    minimo_valor: min.preco,
    minimo_m2: min.m2,
    minimo_tipologia: min.tipologia,
    maximo_valor: max.preco,
    maximo_m2: max.m2,
    maximo_tipologia: max.tipologia,
    total: listings.length,
    desvio_padrao: Math.round(stddev(precos)),
    tipologias: Array.from(tipoMap, ([tipo, count]) => ({
      tipo,
      count,
      pct: Math.round((count / listings.length) * 100),
    })),
    portais: Array.from(portalMap, ([portal, count]) => ({ portal, count })),
  };
}

function computeConclusions(search_id: string, listings: ListingDraft[]) {
  const precosM2 = listings.map((l) => l.preco_m2);
  const mediaM2 = precosM2.reduce((a, b) => a + b, 0) / (precosM2.length || 1);
  const tipoMap = new Map<string, number>();
  for (const l of listings) tipoMap.set(l.tipologia, (tipoMap.get(l.tipologia) ?? 0) + 1);
  const dominante = [...tipoMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const m2Medio = listings.reduce((a, b) => a + b.m2, 0) / (listings.length || 1);
  const estimativa = Math.round(m2Medio * median(precosM2));

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

    const apiKey = Deno.env.get("GOOGLE_SEARCH_API_KEY");
    const cx = Deno.env.get("GOOGLE_SEARCH_CX");
    if (!apiKey || !cx) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_SEARCH_API_KEY ou GOOGLE_SEARCH_CX não configurados" }),
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
