import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import MarketSearchForm from "@/components/market/MarketSearchForm";
import { type MarketSearchParams } from "@/data/marketSearchMock";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

export default function PesquisaMercado() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (params: MarketSearchParams) => {
    if (!user) {
      toast.error("Sessão expirada", { description: "Faça login novamente." });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        user_id: user.id,
        status: "pendente",
        uf: params.uf,
        cidade: params.cidade,
        bairro: params.bairro,
        endereco_alvo: params.enderecoAlvo,
        tipologias: params.tipologias,
        m2_min: params.m2Min,
        m2_max: params.m2Max,
        margem: params.margem,
        portais: params.portais,
        finalidade: params.finalidade,
        raio: params.raio,
        params: params as unknown as Json,
      };
      const { data, error } = await supabase
        .from("market_searches")
        .insert([payload])
        .select("id")
        .single();

      if (error) throw error;

      toast.success("Pesquisa registrada", {
        description: "Processando dados de mercado…",
      });
      navigate(`/pesquisa-mercado/resultado/${data.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Falha ao salvar pesquisa", { description: message });
    } finally {
      setLoading(false);
    }
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
