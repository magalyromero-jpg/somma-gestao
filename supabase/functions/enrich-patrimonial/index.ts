import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em análise patrimonial.
Você receberá:
1. O mapa patrimonial atual de um cliente (JSON)
2. Um novo documento para análise

Sua tarefa é retornar APENAS as atualizações necessárias no JSON via a ferramenta retornar_patch,
no formato de patch parcial.

REGRAS:
- Não repita dados que já existem e não mudaram.
- Se o documento confirma um dado já existente, NÃO inclua no patch.
- Se o documento corrige um dado errado, inclua o dado correto e justifique em "fonte".
- Se o documento adiciona novos dados, inclua-os.

FORMATO DO PATCH PARA ARRAYS (membros, imoveis, holdings, veiculos, dividas, alertas_gerais):
Use sempre operações:
{ "action": "add" | "update" | "remove", "id": "id-do-item", "data": { ...campos... } }

FORMATO DO PATCH PARA OBJETOS SIMPLES (familia, investimentos, rendimentos,
checklist_documentos, patrimonio_liquido):
Retorne apenas os campos que mudam.

SEMPRE atualizar:
- meta.documentos_analisados: adicionar o novo documento à lista existente.
- checklist_documentos: atualizar status dos itens satisfeitos pelo novo documento.
- meta.confianca: reavaliar com base no conjunto total.

REGRAS DE QUALIDADE:
- Benfeitorias NÃO são imóveis independentes (registrar em "benfeitorias" do imóvel).
- Holdings encerradas (participação zerada) = tipo "encerrada".
- Divergência PF/PJ no mesmo imóvel = alerta "critico".
- Imóvel alienado (valor zerado no ano atual) = "alienado: true".`;

const arrayOpSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["add", "update", "remove"] },
      id: { type: "string" },
      data: { type: "object", additionalProperties: true },
    },
    required: ["action", "id"],
  },
};

const PATCH_TOOL = {
  type: "function",
  function: {
    name: "retornar_patch",
    description: "Retorna o patch parcial com as atualizações ao mapa patrimonial.",
    parameters: {
      type: "object",
      properties: {
        familia: { type: "object", additionalProperties: true },
        membros: arrayOpSchema,
        holdings: arrayOpSchema,
        imoveis: arrayOpSchema,
        veiculos: arrayOpSchema,
        dividas: arrayOpSchema,
        alertas_gerais: arrayOpSchema,
        investimentos: { type: "object", additionalProperties: true },
        rendimentos: { type: "object", additionalProperties: true },
        checklist_documentos: { type: "object", additionalProperties: true },
        patrimonio_liquido: { type: "object", additionalProperties: true },
        meta: { type: "object", additionalProperties: true },
      },
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { currentData, file } = await req.json();
    if (!currentData || !file?.base64) {
      return new Response(JSON.stringify({ error: "currentData e file são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataUrl = `data:${file.mimeType || "application/pdf"};base64,${file.base64}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUrl } },
              {
                type: "text",
                text: `Mapa patrimonial atual do cliente:\n${JSON.stringify(currentData, null, 2)}\n\nNovo documento: ${file.name ?? "documento"}.\nChame retornar_patch com SOMENTE as atualizações.`,
              },
            ],
          },
        ],
        tools: [PATCH_TOOL],
        tool_choice: { type: "function", function: { name: "retornar_patch" } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      const status = response.status === 429 || response.status === 402 ? response.status : 500;
      return new Response(JSON.stringify({ error: "Erro no AI Gateway", details: text }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Modelo não retornou patch", raw: data }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patch = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ patch }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("enrich-patrimonial error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
