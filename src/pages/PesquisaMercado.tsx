import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import MarketSearchForm from "@/components/market/MarketSearchForm";
import { mockSearchResult, type MarketSearchParams } from "@/data/marketSearchMock";
import { useState } from "react";
import { toast } from "sonner";

export default function PesquisaMercado() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (params: MarketSearchParams) => {
    setLoading(true);
    // Simula chamada à Edge Function — por ora retorna mock
    setTimeout(() => {
      // Persiste params no sessionStorage para que a página de resultado leia
      const id = mockSearchResult.id;
      const merged = { ...mockSearchResult, params };
      sessionStorage.setItem(`market-search:${id}`, JSON.stringify(merged));
      setLoading(false);
      toast.success("Pesquisa concluída", {
        description: `${mockSearchResult.metricas.total} anúncios encontrados em raio de ${params.raio < 1000 ? params.raio + "m" : params.raio / 1000 + "km"}.`,
      });
      navigate(`/pesquisa-mercado/resultado/${id}`);
    }, 700);
  };

  return (
    <>
      <PageHeader
        title="Pesquisa de Mercado"
        subtitle="Mapeie a oferta regional de imóveis e estime o valor de um ativo-alvo a partir de portais."
      />
      <MarketSearchForm onSubmit={handleSubmit} loading={loading} />
    </>
  );
}
