import { useNavigate, useParams } from "react-router-dom";
import { useMemo } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MarketResultsDashboard from "@/components/market/MarketResultsDashboard";
import MarketMapView from "@/components/market/MarketMapView";
import { mockSearchResult, type MarketSearchResult } from "@/data/marketSearchMock";

export default function PesquisaMercadoResultado() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const result: MarketSearchResult = useMemo(() => {
    if (id) {
      const stored = sessionStorage.getItem(`market-search:${id}`);
      if (stored) {
        try {
          return JSON.parse(stored) as MarketSearchResult;
        } catch {
          /* fallthrough */
        }
      }
    }
    return mockSearchResult;
  }, [id]);

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
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
            {params.bairro} · {params.cidade}/{params.uf} — raio de{" "}
            {params.raio < 1000 ? `${params.raio}m` : `${params.raio / 1000}km`}
          </span> as unknown as string
        }
      />

      {/* Resumo dos parâmetros */}
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
