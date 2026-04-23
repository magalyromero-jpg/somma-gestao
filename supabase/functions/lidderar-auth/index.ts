import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOGIN_URL = "https://sistema.sommamfo.com.br/api/auth/login";

const BROWSER_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "X-Requested-With": "XMLHttpRequest",
  Referer: "https://sistema.sommamfo.com.br/",
  Origin: "https://sistema.sommamfo.com.br",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

function extractToken(data: unknown, headers: Headers): string | null {
  const auth = headers.get("authorization") || headers.get("Authorization");
  if (auth) {
    const m = auth.match(/Bearer\s+(.+)/i);
    if (m) return m[1].trim();
    return auth.trim();
  }
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, any>;
  const candidates = [
    obj.token,
    obj.TOKEN,
    obj.access_token,
    obj.accessToken,
    obj.bearer,
    obj.jwt,
    obj?.data?.token,
    obj?.DADOS?.token,
    obj?.DADOS?.TOKEN,
    obj?.DADOS?.access_token,
    obj?.dados?.token,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 10) return c;
  }
  return null;
}

export async function attemptLogin(
  usuario: string,
  senha: string,
): Promise<{ token: string; raw: unknown } | null> {
  try {
    console.log("[lidderar-auth] POST", LOGIN_URL, "usuario:", usuario);
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: BROWSER_HEADERS,
      body: JSON.stringify({ usuario, senha }),
    });
    const text = await res.text();
    console.log("[lidderar-auth] status", res.status, "body[:500]:", text.slice(0, 500));
    if (!res.ok) return null;

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }
    const token = extractToken(data, res.headers);
    if (token) {
      console.log("[lidderar-auth] token obtido (20):", token.slice(0, 20));
      return { token, raw: data };
    }
    console.warn("[lidderar-auth] login OK mas token não encontrado na resposta");
    return null;
  } catch (e) {
    console.error("[lidderar-auth] erro:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    let { usuario, senha } = body as { usuario?: string; senha?: string };

    if (!usuario || !senha) {
      const [{ data: u }, { data: s }] = await Promise.all([
        supabase.from("configuracoes").select("valor").eq("chave", "lidderar_usuario").maybeSingle(),
        supabase.from("configuracoes").select("valor").eq("chave", "lidderar_senha").maybeSingle(),
      ]);
      usuario = usuario || u?.valor || undefined;
      senha = senha || s?.valor || undefined;
    }

    if (!usuario || !senha) {
      return new Response(
        JSON.stringify({
          error:
            "Credenciais não configuradas. Salve usuário e senha em /configuracoes.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await attemptLogin(usuario, senha);
    if (!result) {
      return new Response(
        JSON.stringify({
          error:
            "Falha ao autenticar. Verifique usuário/senha ou veja os logs da função.",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase.from("configuracoes").upsert([
      { chave: "lidderar_bearer_token", valor: result.token },
      { chave: "lidderar_usuario", valor: usuario },
      { chave: "lidderar_senha", valor: senha },
      { chave: "lidderar_token_atualizado_em", valor: new Date().toISOString() },
    ]);

    return new Response(
      JSON.stringify({
        ok: true,
        endpoint_usado: LOGIN_URL,
        token_preview: result.token.slice(0, 20),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[lidderar-auth] erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
