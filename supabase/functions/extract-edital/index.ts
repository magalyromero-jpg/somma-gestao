import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      return new Response(JSON.stringify({ error: "pdfBase64 é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
              },
              {
                type: "text",
                text: `Você é um especialista em leilões imobiliários. Analise este edital e extraia os dados do imóvel. Retorne APENAS um JSON válido, sem texto adicional, sem markdown, sem backticks. Use exatamente estas chaves: { "nome": string, "endereco": string, "leilao": string, "tipo": string, "areaConst": number, "areaLote": number, "testada": number, "estrutura": "Alvenaria" ou "Metálica" ou "Mista" ou "Madeira", "estadoConservacao": "Ótimo" ou "Bom" ou "Regular" ou "Ruim", "matricula": string, "locatario": string, "lanceMinimoMil": number (valor total em reais), "investimentoTotalMil": 0, "aluguelMensalInicial": number (valor mensal em reais), "prazoLocacaoMeses": number, "valorVenalMil": number (valor total em reais), "valorMercadoMinMil": 0, "valorMercadoMaxMil": 0 }`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Erro na API Anthropic", details: data }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
    const clean = text.replace(/```json|```/g, "").trim();
    const extraido = JSON.parse(clean);

    return new Response(JSON.stringify({ data: extraido }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge Function error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
