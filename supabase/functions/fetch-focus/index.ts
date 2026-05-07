import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FOCUS_FALLBACK = {
  cdiAtual: 11.75,
  cdiProjeto2026: 10.5,
  cdiProjeto2027: 9.5,
  cdiProjeto2028plus: 9.0,
  ipcaProjeto2026: 4.0,
  ipcaProjeto2027: 3.75,
  ipcaProjeto2028plus: 3.5,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ data: FOCUS_FALLBACK, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Hoje é ${today}. Com base nas suas estimativas mais recentes do Boletim Focus do Banco Central do Brasil (CDI/Selic e IPCA), retorne os percentuais anuais. Use a ferramenta retornar_focus.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            type: "function",
            function: {
              name: "retornar_focus",
              description: "Retorna projeções do Boletim Focus em pontos percentuais anuais.",
              parameters: {
                type: "object",
                properties: {
                  cdiAtual: { type: "number" },
                  cdiProjeto2026: { type: "number" },
                  cdiProjeto2027: { type: "number" },
                  cdiProjeto2028plus: { type: "number" },
                  ipcaProjeto2026: { type: "number" },
                  ipcaProjeto2027: { type: "number" },
                  ipcaProjeto2028plus: { type: "number" },
                },
                required: [
                  "cdiAtual",
                  "cdiProjeto2026",
                  "cdiProjeto2027",
                  "cdiProjeto2028plus",
                  "ipcaProjeto2026",
                  "ipcaProjeto2027",
                  "ipcaProjeto2028plus",
                ],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "retornar_focus" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ data: FOCUS_FALLBACK, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      return new Response(JSON.stringify({ data: FOCUS_FALLBACK, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(args);
    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fetch-focus error:", err);
    return new Response(JSON.stringify({ data: FOCUS_FALLBACK, fallback: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
