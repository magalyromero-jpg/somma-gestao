import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MarketResultsDashboard from "@/components/market/MarketResultsDashboard";
import MarketMapView from "@/components/market/MarketMapView";
import { LoadingState } from "@/components/LoadingState";
import { mockSearchResult, type MarketSearchResult, type Finalidade } from "@/data/marketSearchMock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PesquisaMercadoResultado() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<MarketSearchResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("market_searches")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        toast.error("Pesquisa não encontrada");
        setResult(null);
        setLoading(false);
        return;
      }

      // Combina parâmetros reais salvos no banco com o resultado mock
      // (métricas, listings e conclusões virão da Edge Function futuramente)
      setResult({
        ...mockSearchResult,
        id: data.id,
        params: {
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
        },
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingState />;
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
