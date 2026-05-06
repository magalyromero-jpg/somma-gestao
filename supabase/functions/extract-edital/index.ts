import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você receberá o PDF de um edital de leilão imobiliário brasileiro.
Extraia APENAS os campos abaixo se estiverem EXPLICITAMENTE no texto do documento.
Se um campo não existir no documento, retorne null. NUNCA invente ou assuma valores.

CAMPOS A EXTRAIR:
- nome: string — identificação do lote (ex: "LOTE 14 - São Bento do Sul")
- endereco: string — endereço completo do imóvel
- leilao: string — número do leilão (ex: "2026/260004V(9055)")
- matricula: string — número da matrícula do CRI
- locatario: string — nome do locatário (geralmente "BANCO DO BRASIL S/A")
- prazoLocacaoMeses: number — prazo em meses
- aluguelMensalInicial: number — valor mensal em R$ como número puro (ex: 41924)
- lanceMinimoMil: number — lance mínimo em R$ como número puro (ex: 6449855)
- tipo: string — tipo do imóvel se mencionado (ex: "Prédio Comercial")

REGRA CRÍTICA: Os campos abaixo NUNCA aparecem no edital. Retorne sempre null para eles:
- areaConst, areaLote, testada (vêm do IPTU ou matrícula)
- estrutura, estadoConservacao (vêm de vistoria presencial)
- valorVenalMil, valorMercadoMinMil, valorMercadoMaxMil (requerem pesquisa externa)
- investimentoTotalMil, aluguelMensalInicial quando não houver valor explícito

Para valores monetários: remova pontos de milhar e vírgulas decimais, retorne sempre como número inteiro em reais (não em milhares).

Responda SOMENTE com JSON válido, sem texto adicional, sem markdown, sem explicações.`;

const tool = {
  type: "function",
  function: {
    name: "extrair_edital",
    description: "Extrai dados de um edital de leilão imobiliário",
    parameters: {
      type: "object",
      properties: {
        nome: { type: ["string", "null"] },
        endereco: { type: ["string", "null"] },
        leilao: { type: ["string", "null"] },
        matricula: { type: ["string", "null"] },
        locatario: { type: ["string", "null"] },
        tipo: { type: ["string", "null"] },
        prazoLocacaoMeses: { type: ["number", "null"] },
        aluguelMensalInicial: { type: ["number", "null"] },
        lanceMinimoMil: { type: ["number", "null"], description: "Lance mínimo em REAIS (inteiro)" },
      },
      required: [
        "nome", "endereco", "leilao", "matricula", "locatario", "tipo",
        "prazoLocacaoMeses", "aluguelMensalInicial", "lanceMinimoMil",
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
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
              { type: "text", text: "Extraia os dados deste edital seguindo estritamente as regras." },
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
