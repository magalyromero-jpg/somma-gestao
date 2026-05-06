import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const tool = {
  type: "function",
  function: {
    name: "extrair_edital",
    description: "Extrai dados de um edital de leilão imobiliário",
    parameters: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Identificação do lote/imóvel" },
        endereco: { type: "string" },
        leilao: { type: "string", description: "Número/identificação do leilão" },
        tipo: { type: "string", description: "Ex: Galpão, Apartamento, Sala Comercial" },
        areaConst: { type: "number", description: "Área construída em m²" },
        areaLote: { type: "number", description: "Área do lote em m² (0 se não houver)" },
        testada: { type: "number", description: "Testada em metros (0 se não houver)" },
        estrutura: { type: "string", enum: ["Alvenaria", "Metálica", "Mista", "Madeira"] },
        estadoConservacao: { type: "string", enum: ["Ótimo", "Bom", "Regular", "Ruim"] },
        matricula: { type: "string" },
        locatario: { type: "string" },
        lanceMinimoMil: { type: "number", description: "Lance mínimo em REAIS (valor completo, não dividido por mil)" },
        aluguelMensalInicial: { type: "number", description: "Aluguel mensal em REAIS" },
        prazoLocacaoMeses: { type: "number" },
        valorVenalMil: { type: "number", description: "Valor venal em REAIS (0 se não houver)" },
      },
      required: [
        "nome", "endereco", "leilao", "tipo", "areaConst", "areaLote", "testada",
        "estrutura", "estadoConservacao", "matricula", "locatario",
        "lanceMinimoMil", "aluguelMensalInicial", "prazoLocacaoMeses", "valorVenalMil",
      ],
      additionalProperties: false,
    },
  },
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

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content:
              "Você é um especialista em leilões imobiliários. Extraia os dados do edital chamando a função extrair_edital. Use 0 quando o dado não estiver disponível e string vazia para campos textuais ausentes.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
              { type: "text", text: "Extraia os dados deste edital." },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "extrair_edital" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro no AI Gateway", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Não foi possível extrair os dados do PDF", details: data }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const extraido = JSON.parse(call.function.arguments);

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
