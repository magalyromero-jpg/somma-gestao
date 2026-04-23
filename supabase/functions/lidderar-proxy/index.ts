import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const tokenPreview = (token: string | null | undefined) =>
  token ? token.slice(0, 20) : null;

const BROWSER_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "X-Requested-With": "XMLHttpRequest",
  Referer: "https://sistema.lidderar.com.br/",
  Origin: "https://sistema.lidderar.com.br",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

async function fetchLidderar(url: string, token: string) {
  return await fetch(url, {
    headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${token}` },
  });
}

/** Chama internamente a função lidderar-auth para renovar o token. */
async function renewToken(supabaseUrl: string, serviceKey: string): Promise<string | null> {
  try {
    console.log("[lidderar-proxy] tentando renovar token via lidderar-auth...");
    const res = await fetch(`${supabaseUrl}/functions/v1/lidderar-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({}), // usa credenciais da tabela configuracoes
    });
    const data = await res.json().catch(() => ({}));
    console.log("[lidderar-proxy] resposta lidderar-auth:", res.status, JSON.stringify(data).slice(0, 200));
    if (!res.ok || !(data as any).ok) return null;

    // Lê o novo token persistido
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: row } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "lidderar_bearer_token")
      .maybeSingle();
    return row?.valor ?? null;
  } catch (e) {
    console.error("[lidderar-proxy] erro ao renovar token:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: config, error: configError } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "lidderar_bearer_token")
      .maybeSingle();

    if (configError) throw configError;
    let token = config?.valor;
    console.log("[lidderar-proxy] token inicial (primeiros 20):", tokenPreview(token));

    if (!token) {
      // Tenta auto-login se houver credenciais salvas
      const renewed = await renewToken(SUPABASE_URL, SERVICE_KEY);
      if (!renewed) {
        return new Response(
          JSON.stringify({
            error:
              "Token Lidderar não configurado e auto-login falhou. Salve credenciais em /configuracoes.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      token = renewed;
    }

    const body = await req.json().catch(() => ({}));
    const { endpoint, params } = body as {
      endpoint?: string;
      params?: Record<string, string>;
    };

    if (!endpoint || typeof endpoint !== "string" || !endpoint.startsWith("/")) {
      return new Response(
        JSON.stringify({ error: "Parâmetro 'endpoint' inválido. Use ex: /imoveis/getall" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const qs =
      params && Object.keys(params).length > 0
        ? "?" + new URLSearchParams(params).toString()
        : "";
    const url = `https://sistema.lidderar.com.br/api${endpoint}${qs}`;

    console.log("[lidderar-proxy] →", url);
    let response = await fetchLidderar(url, token!);
    console.log("[lidderar-proxy] status:", response.status);

    // Se 401/403 → tenta renovar e refaz a requisição UMA vez
    if (response.status === 401 || response.status === 403) {
      console.log("[lidderar-proxy] token expirado, renovando...");
      const newToken = await renewToken(SUPABASE_URL, SERVICE_KEY);
      if (newToken) {
        token = newToken;
        console.log("[lidderar-proxy] retry com novo token:", tokenPreview(token));
        response = await fetchLidderar(url, token);
        console.log("[lidderar-proxy] status após retry:", response.status);
      } else {
        console.warn("[lidderar-proxy] não foi possível renovar token automaticamente");
      }
    }

    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log("[lidderar-proxy] ←", response.status, text.slice(0, 300));

    return new Response(
      JSON.stringify({
        ok: response.ok,
        upstream_status: response.status,
        upstream_url: url,
        data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[lidderar-proxy] erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
