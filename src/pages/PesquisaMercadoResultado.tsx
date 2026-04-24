import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MarketResultsDashboard from "@/components/market/MarketResultsDashboard";
import MarketMapView from "@/components/market/MarketMapView";
import { LoadingSkeleton } from "@/components/LoadingState";
import { mockSearchResult, type MarketSearchResult, type Finalidade } from "@/data/marketSearchMock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PesquisaMercadoResultado() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<MarketSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [searchRes, listingsRes, metricsRes, conclusionsRes] = await Promise.all([
        supabase.from("market_searches").select("*").eq("id", id).maybeSingle(),
        supabase.from("market_listings").select("*").eq("search_id", id),
        supabase.from("market_metrics").select("*").eq("search_id", id).maybeSingle(),
        supabase.from("market_conclusions").select("*").eq("search_id", id).maybeSingle(),
      ]);

      if (cancelled) return;

      const data = searchRes.data;
      if (searchRes.error || !data) {
        toast.error("Pesquisa não encontrada");
        setResult(null);
        setLoading(false);
        return;
      }

      const params = {
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

      const listings = listingsRes.data ?? [];
      const hasRealData = listings.length > 0 && metricsRes.data && conclusionsRes.data;

      if (hasRealData) {
        const m = metricsRes.data!;
        const c = conclusionsRes.data!;
        setResult({
          id: data.id,
          params,
          listings: listings.map((l) => ({
            id: l.id,
            titulo: l.titulo ?? "",
            endereco: l.endereco ?? "",
            m2: Number(l.m2 ?? 0),
            dorms: l.dorms ?? 0,
            vagas: l.vagas ?? 0,
            preco: Number(l.preco ?? 0),
            precoM2: Number(l.preco_m2 ?? 0),
            portal: l.portal ?? "",
            tipologia: l.tipologia ?? "",
            url: l.url ?? "",
            lat: l.lat != null ? Number(l.lat) : 0,
            lng: l.lng != null ? Number(l.lng) : 0,
          })),
          metricas: {
            media: Number(m.media ?? 0),
            mediana: Number(m.mediana ?? 0),
            minimo: { valor: Number(m.minimo_valor ?? 0), m2: Number(m.minimo_m2 ?? 0), tipologia: m.minimo_tipologia ?? "" },
            maximo: { valor: Number(m.maximo_valor ?? 0), m2: Number(m.maximo_m2 ?? 0), tipologia: m.maximo_tipologia ?? "" },
            total: m.total ?? 0,
            desvioPadrao: Number(m.desvio_padrao ?? 0),
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
        setIsMock(false);
      } else {
        setResult({ ...mockSearchResult, id: data.id, params });
        setIsMock(true);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingSkeleton rows={6} />;
  if (!result) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground font-light">Pesquisa não encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/pesquisa-mercado")}>
          Voltar
        </Button>
      </div>
    );
  }

  const { params } = result;

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

      {isMock && (
        <Alert className="mb-6 border-warning/40 bg-warning/5">
          <Info className="h-4 w-4 text-warning" strokeWidth={1.75} />
          <AlertDescription className="font-light text-sm">
            <strong className="font-medium">Dados de exemplo.</strong> A busca real
            não retornou anúncios — verifique se a Custom Search JSON API está
            habilitada no projeto Google Cloud associado à chave configurada.
          </AlertDescription>
        </Alert>
      )}

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

      <div className="space-y-6">
        <MarketMapView result={result} />
        <MarketResultsDashboard result={result} />
      </div>
    </>
  );
}
