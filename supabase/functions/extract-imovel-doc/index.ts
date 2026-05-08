import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  name: "registrar_dados_imovel",
  description: "Extrai datas de certidões e dados de utilidades de um documento do imóvel.",
  input_schema: {
    type: "object",
    properties: {
      tipo_documento: {
        type: "string",
        description:
          "Classifique o documento entre: cnd_condominio, cnd_iptu, cnd_energia, certidao_onus, matricula, conta_energia, conta_agua, carne_iptu, ir, outro",
      },
      certidao: {
        type: "object",
        description: "Datas da certidão se for um documento de CND/Certidão/Matrícula.",
        properties: {
          data_emissao: { type: ["string", "null"], description: "Data de emissão em formato YYYY-MM-DD" },
          validade: { type: ["string", "null"], description: "Data de validade em formato YYYY-MM-DD" },
        },
      },
      utilidades: {
        type: "object",
        description: "Dados de utilidades extraídos. Use null para campos não encontrados.",
        properties: {
          unidade_consumidora: { type: ["string", "null"] },
          distribuidora: { type: ["string", "null"], description: "Ex: Enel, CPFL, Cemig, Celesc, Elektro" },
          mes_referencia: { type: ["string", "null"], description: "Formato MM/YYYY" },
          hidrometro: { type: ["string", "null"] },
          matricula_agua: { type: ["string", "null"] },
          inscricao_municipal: { type: ["string", "null"] },
        },
      },
    },
    required: ["tipo_documento"],
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file, hint } = await req.json();
    if (!file?.base64) {
      return new Response(JSON.stringify({ error: "file.base64 é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mediaType = file.mimeType || "application/pdf";
    const userContent: any[] = [];
    if (mediaType === "application/pdf") {
      userContent.push({ type: "document", source: { type: "base64", media_type: mediaType, data: file.base64 } });
    } else {
      userContent.push({ type: "image", source: { type: "base64", media_type: mediaType, data: file.base64 } });
    }
    userContent.push({
      type: "text",
      text: `Analise este documento brasileiro relacionado a um imóvel${hint ? ` (categoria sugerida: ${hint})` : ""}.

1) Identifique o tipo do documento.
2) Se for CND/Certidão/Matrícula, extraia data_emissao e validade no formato YYYY-MM-DD.
3) Se o documento contiver dados de utilidades, extraia: unidade_consumidora, distribuidora (Enel/CPFL/Cemig/Celesc/Elektro/etc), mes_referencia (MM/YYYY), hidrometro, matricula_agua, inscricao_municipal.
4) Retorne null para qualquer campo não encontrado. Não invente.`,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: userContent }],
        tools: [TOOL],
        tool_choice: { type: "tool", name: "registrar_dados_imovel" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(JSON.stringify({ error: "Erro Anthropic", details: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolUse = Array.isArray(data?.content) ? data.content.find((b: any) => b?.type === "tool_use") : null;
    if (!toolUse?.input) {
      return new Response(JSON.stringify({ error: "Sem retorno estruturado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: toolUse.input }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
