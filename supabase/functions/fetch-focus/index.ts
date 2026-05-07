import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const prompt = `Busque os valores mais recentes do Boletim Focus do Banco Central do Brasil e retorne APENAS um JSON com:
{
  "cdiAtual": number,
  "cdiProjeto2026": number,
  "cdiProjeto2027": number,
  "cdiProjeto2028plus": number,
  "ipcaProjeto2026": number,
  "ipcaProjeto2027": number,
  "ipcaProjeto2028plus": number
}
Sem texto adicional, sem markdown.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Anthropic error:", resp.status, t);
      return new Response(JSON.stringify({ error: "Falha ao buscar Focus", details: t }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    // Extract last text block
    const textBlocks = (data.content || []).filter((b: any) => b.type === "text");
    const text = textBlocks.map((b: any) => b.text).join("\n").trim();
    const clean = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    // Find JSON object
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Resposta sem JSON: " + clean.slice(0, 200));
    const parsed = JSON.parse(match[0]);

    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fetch-focus error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
