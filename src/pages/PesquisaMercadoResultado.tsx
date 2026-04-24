import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, SearchX } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import MarketResultsDashboard from "@/components/market/MarketResultsDashboard";
import MarketMapView from "@/components/market/MarketMapView";
import { LoadingSkeleton } from "@/components/LoadingState";
import type { MarketSearchParams, MarketSearchResult, Finalidade } from "@/data/marketSearchMock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PesquisaMercadoResultado() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useState<MarketSearchParams | null>(null);
  const [result, setResult] = useState<MarketSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const PENDING_STATUSES = new Set(["pendente", "processando"]);
    const MAX_POLLS = 40; // ~60s @ 1.5s
    const POLL_INTERVAL = 1500;

    const fetchAll = async () => {
      const [searchRes, listingsRes, metricsRes, conclusionsRes] = await Promise.all([
        supabase.from("market_searches").select("*").eq("id", id).maybeSingle(),
        supabase.from("market_listings").select("*").eq("search_id", id),
        supabase.from("market_metrics").select("*").eq("search_id", id).maybeSingle(),
        supabase.from("market_conclusions").select("*").eq("search_id", id).maybeSingle(),
      ]);
      return { searchRes, listingsRes, metricsRes, conclusionsRes };
    };

    (async () => {
      setLoading(true);

      let snapshot = await fetchAll();
      if (cancelled) return;

      // Se a pesquisa ainda está processando, faz polling até concluir
      let attempts = 0;
      while (
        !cancelled &&
        snapshot.searchRes.data &&
        PENDING_STATUSES.has(snapshot.searchRes.data.status) &&
        attempts < MAX_POLLS
      ) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        if (cancelled) return;
        snapshot = await fetchAll();
        attempts++;
      }

      const { searchRes, listingsRes, metricsRes, conclusionsRes } = snapshot;
      const data = searchRes.data;
      if (searchRes.error || !data) {
        toast.error("Pesquisa não encontrada");
        setNotFound(true);
        setLoading(false);
        return;
      }

      const p: MarketSearchParams = {
        uf: data.uf,
        cidade: data.cidade,
        bairro: data.bairro ?? "",
        enderecoAlvo: data.endereco_alvo ?? "",
        tipologias: data.tipologias ?? [],
        m2Min: Number(data.m2_min ?? 0),
        m2Max: Number(data.m2_max ?? 0),
        margem: Number(data.margem ?? 0),
        portais: data.portais ?? [],
        finalidade: (data.finalidade as Finalidade) ?? "venda",
        raio: data.raio ?? 500,
      };
      setParams(p);

      const listings = listingsRes.data ?? [];
      const hasRealData = listings.length > 0 && metricsRes.data && conclusionsRes.data;

      if (hasRealData) {
        const m = metricsRes.data!;
        const c = conclusionsRes.data!;
        setResult({
          id: data.id,
          params: p,
          listings: listings.map((l) => ({
            id: l.id,
            titulo: l.titulo ?? "",
            endereco: l.endereco ?? "",
            m2: Number(l.m2 ?? 0),
            dorms: l.dorms ?? 0,
            vagas: l.vagas ?? 0,
            preco: Number(l.preco ?? 0),
            precoM2: l.preco_m2 != null ? Number(l.preco_m2) : null,
            portal: l.portal ?? "",
            tipologia: l.tipologia ?? "",
            url: l.url ?? "",
            lat: l.lat != null ? Number(l.lat) : 0,
            lng: l.lng != null ? Number(l.lng) : 0,
            diasNoMercado: (l as { dias_no_mercado?: number | null }).dias_no_mercado ?? null,
          })),
          metricas: {
            media: Number(m.media ?? 0),
            mediana: Number(m.mediana ?? 0),
            minimo: { valor: Number(m.minimo_valor ?? 0), m2: Number(m.minimo_m2 ?? 0), tipologia: m.minimo_tipologia ?? "" },
            maximo: { valor: Number(m.maximo_valor ?? 0), m2: Number(m.maximo_m2 ?? 0), tipologia: m.maximo_tipologia ?? "" },
            total: m.total ?? 0,
            desvioPadrao: Number(m.desvio_padrao ?? 0),
            tempoMedioMercado: (m as { tempo_medio_mercado?: number | null }).tempo_medio_mercado ?? null,
          },
          tipologias: (m.tipologias as Array<{ tipo: string; count: number; pct: number }>) ?? [],
          portais: (m.portais as Array<{ portal: string; count: number }>) ?? [],
          conclusoes: {
            posicionamento: c.posicionamento ?? "",
            ofertaDemanda: c.oferta_demanda ?? "",
            tipologiaDominante: c.tipologia_dominante ?? "",
            competitividade: c.competitividade ?? "",
            estimativaAtivo: Number(c.estimativa_ativo ?? 0),
          },
        });
      } else {
        setResult(null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingSkeleton rows={6} />;

  if (notFound || !params) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground font-light">Pesquisa não encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/pesquisa-mercado")}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/pesquisa-mercado")}
        className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Nova pesquisa
      </Button>

      <PageHeader
        title="Resultado da pesquisa"
        subtitle={`${params.bairro} · ${params.cidade}/${params.uf} — raio de ${
          params.raio < 1000 ? `${params.raio}m` : `${params.raio / 1000}km`
        }`}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {params.tipologias.map((t) => (
          <Badge key={t} variant="secondary" className="font-light">{t}</Badge>
        ))}
        <Badge variant="outline" className="font-light">
          {params.m2Min}–{params.m2Max} m² {params.margem > 0 ? `(±${params.margem}%)` : ""}
        </Badge>
        <Badge variant="outline" className="font-light capitalize">{params.finalidade}</Badge>
        {params.portais.map((p) => (
          <Badge key={p} variant="outline" className="font-light">{p}</Badge>
        ))}
      </div>

      {result ? (
        <div className="space-y-6">
          <MarketMapView result={result} />
          <MarketResultsDashboard result={result} />
        </div>
      ) : (
        <Card className="border-border/60">
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted grid place-items-center">
              <SearchX className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-light tracking-tight text-foreground">
              Nenhum anúncio encontrado
            </h3>
            <p className="text-sm font-light text-muted-foreground max-w-md">
              Não localizamos anúncios para os parâmetros informados. Tente
              ajustar a metragem, o bairro ou os portais selecionados.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => navigate("/pesquisa-mercado")}
            >
              Ajustar pesquisa
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
