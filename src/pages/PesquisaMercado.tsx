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
        nome_predio: params.nomePredio ?? null,
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

      if (error) {
        console.error("market_searches insert error", error);
        throw error;
      }

      toast.info("Processando dados de mercado…", {
        description: "Buscando anúncios nos portais selecionados.",
      });

      const { error: fnError } = await supabase.functions.invoke("market-search", {
        body: { search_id: data.id },
      });

      if (fnError) {
        console.error("market-search invoke error", fnError);
        throw fnError;
      }

      toast.success("Pesquisa concluída");
      navigate(`/pesquisa-mercado/resultado/${data.id}`);
    } catch (err: unknown) {
      console.error("PesquisaMercado handleSubmit error", err);
      const e = err as { message?: string; code?: string; details?: string; hint?: string; status?: number; name?: string };
      const parts = [
        e?.code ? `code: ${e.code}` : null,
        e?.status ? `status: ${e.status}` : null,
        e?.message ?? (typeof err === "string" ? err : null) ?? "Erro desconhecido",
        e?.details ? `details: ${e.details}` : null,
        e?.hint ? `hint: ${e.hint}` : null,
      ].filter(Boolean);
      toast.error("Falha na pesquisa de mercado", {
        description: parts.join(" • "),
        duration: 10000,
      });
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
