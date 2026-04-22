import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: config, error: configError } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "lidderar_bearer_token")
      .maybeSingle();

    if (configError) throw configError;
    const token = config?.valor;
    if (!token) {
      return new Response(
        JSON.stringify({
          error:
            "Token Lidderar não configurado. Salve em /configuracoes (chave: lidderar_bearer_token).",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { endpoint, params } = body as {
      endpoint?: string;
      params?: Record<string, string>;
    };

    if (!endpoint || typeof endpoint !== "string" || !endpoint.startsWith("/")) {
      return new Response(
        JSON.stringify({ error: "Parâmetro 'endpoint' inválido. Use ex: /imoveis/getall" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const qs =
      params && Object.keys(params).length > 0
        ? "?" + new URLSearchParams(params).toString()
        : "";

    const url = `https://sistema.lidderar.com.br/api${endpoint}${qs}`;

    console.log("[lidderar-proxy] →", url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://sistema.lidderar.com.br/",
        Origin: "https://sistema.lidderar.com.br",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log("[lidderar-proxy] ←", response.status, text.slice(0, 300));

    // Sempre 200 para o cliente conseguir ler o corpo + diagnóstico
    return new Response(
      JSON.stringify({
        ok: response.ok,
        upstream_status: response.status,
        upstream_url: url,
        data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[lidderar-proxy] erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
