// Edge Function: market-search
// Recebe { search_id }, busca anúncios (mock por enquanto), calcula métricas
// e persiste em market_listings + market_metrics. Atualiza market_searches.status.
//
// TODO: Substituir generateMockListings() por chamada real ao Google Custom
// Search API quando GOOGLE_SEARCH_API_KEY estiver configurada.

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

// ---------- Mock generator (a substituir pela API real) ----------
function generateMockListings(s: MarketSearchRow): ListingDraft[] {
  const portais = s.portais.length
    ? s.portais
    : ["Viva Real", "ZAP Imóveis", "QuintoAndar"];
  const tipologias = s.tipologias.length ? s.tipologias : ["2 dorm", "3 dorm"];
  const m2Mid =
    s.m2_min && s.m2_max ? (Number(s.m2_min) + Number(s.m2_max)) / 2 : 90;
  const m2Min = s.m2_min ? Number(s.m2_min) : Math.round(m2Mid * 0.9);
  const m2Max = s.m2_max ? Number(s.m2_max) : Math.round(m2Mid * 1.1);

  // Preço base por m² por cidade (mock didático)
  const baseM2: Record<string, number> = {
    "São Paulo": 13500,
    "Rio de Janeiro": 11200,
    "Belo Horizonte": 8400,
    "Curitiba": 8900,
    "Florianópolis": 11500,
    "Porto Alegre": 7800,
  };
  const base = baseM2[s.cidade] ?? 9000;

  const ruas = [
    "R. Bandeira Paulista",
    "Av. Brig. Faria Lima",
    "R. Joaquim Floriano",
    "Av. Nove de Julho",
    "R. Clodomiro Amazonas",
    "R. Pedroso Alvarenga",
    "Av. Juscelino Kubitschek",
    "R. Tabapuã",
  ];

  const listings: ListingDraft[] = [];
  const total = 24;
  for (let i = 0; i < total; i++) {
    const tipologia = tipologias[i % tipologias.length];
    const portal = portais[i % portais.length];
    const m2 = Math.round(m2Min + Math.random() * (m2Max - m2Min));
    const dorms = Number(tipologia.match(/\d/)?.[0] ?? 2);
    const vagas = Math.max(1, Math.min(3, dorms - 1 + (Math.random() > 0.6 ? 1 : 0)));

    const noise = 0.85 + Math.random() * 0.3; // ±15%
    const precoM2 = Math.round(base * noise);
    const preco = Math.round(precoM2 * m2);

    const rua = ruas[i % ruas.length];
    const numero = 100 + Math.floor(Math.random() * 1800);

    listings.push({
      search_id: s.id,
      titulo: `${tipologia} · ${m2}m² · ${s.bairro ?? s.cidade}`,
      endereco: `${rua}, ${numero} — ${s.bairro ?? ""}, ${s.cidade}/${s.uf}`,
      m2,
      dorms,
      vagas,
      preco,
      preco_m2: precoM2,
      portal,
      tipologia,
      url: `https://example.com/${portal.toLowerCase().replace(/\s+/g, "-")}/${s.id}-${i}`,
      lat: -23.585 + (Math.random() - 0.5) * 0.02,
      lng: -46.679 + (Math.random() - 0.5) * 0.02,
    });
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
  // Estimativa do ativo: m² médio da amostra * R$/m² mediano
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

    // 2. (Mock) Geração de anúncios. Quando GOOGLE_SEARCH_API_KEY estiver
    //    configurada, montar queries: `${cidade} ${bairro} ${tipologia} ${m2}m²`
    //    e chamar https://www.googleapis.com/customsearch/v1.
    const apiKey = Deno.env.get("GOOGLE_SEARCH_API_KEY");
    if (apiKey) {
      console.log("GOOGLE_SEARCH_API_KEY presente — usando mock até integração real estar pronta.");
    }
    const listings = generateMockListings(search as MarketSearchRow);

    // 3. Limpa dados antigos e insere novos
    await supabase.from("market_listings").delete().eq("search_id", search_id);
    await supabase.from("market_metrics").delete().eq("search_id", search_id);
    await supabase.from("market_conclusions").delete().eq("search_id", search_id);

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

    // 4. Atualiza status final
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
