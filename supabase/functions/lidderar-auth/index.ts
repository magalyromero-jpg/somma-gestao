import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BROWSER_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "X-Requested-With": "XMLHttpRequest",
  Referer: "https://sistema.lidderar.com.br/",
  Origin: "https://sistema.lidderar.com.br",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

/**
 * Tenta extrair um token de uma resposta heterogênea.
 * Lidderar pode retornar token em diversos campos — testamos os mais comuns.
 */
function extractToken(data: unknown, headers: Headers): string | null {
  // 1. Header Authorization
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
    obj?.user?.token,
    obj?.usuario?.token,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 10) return c;
  }
  return null;
}

/** Endpoints candidatos — Lidderar não tem doc pública, então tentamos vários. */
const LOGIN_ENDPOINTS = [
  "/auth/login",
  "/login",
  "/usuarios/login",
  "/usuario/login",
  "/cadastros/usuario/login",
];

/** Variações de payload que diferentes APIs aceitam. */
function payloadVariants(usuario: string, senha: string): Array<Record<string, string>> {
  return [
    { usuario, senha },
    { email: usuario, senha },
    { email: usuario, password: senha },
    { login: usuario, senha },
    { login: usuario, password: senha },
    { user: usuario, password: senha },
  ];
}

export async function attemptLogin(
  usuario: string,
  senha: string,
): Promise<{ token: string; endpoint: string; payloadKeys: string[] } | null> {
  for (const endpoint of LOGIN_ENDPOINTS) {
    const url = `https://sistema.lidderar.com.br/api${endpoint}`;
    for (const payload of payloadVariants(usuario, senha)) {
      try {
        console.log(
          "[lidderar-auth] tentando",
          url,
          "com chaves:",
          Object.keys(payload).join(","),
        );
        const res = await fetch(url, {
          method: "POST",
          headers: BROWSER_HEADERS,
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        console.log(
          "[lidderar-auth] resposta",
          res.status,
          "body[:300]:",
          text.slice(0, 300),
        );

        if (!res.ok) continue;

        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          continue;
        }

        const token = extractToken(data, res.headers);
        if (token) {
          console.log(
            "[lidderar-auth] token encontrado em",
            endpoint,
            "(primeiros 20):",
            token.slice(0, 20),
          );
          return { token, endpoint, payloadKeys: Object.keys(payload) };
        }
      } catch (e) {
        console.error("[lidderar-auth] erro em", url, e);
      }
    }
  }
  return null;
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

    // Se não vieram no body, busca em configuracoes (modo automático).
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
            "Credenciais Lidderar não configuradas. Salve usuário e senha em /configuracoes.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await attemptLogin(usuario, senha);
    if (!result) {
      return new Response(
        JSON.stringify({
          error:
            "Falha ao autenticar na Lidderar. Verifique usuário/senha ou veja os logs da função para o endpoint correto.",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Persiste token + credenciais (upsert).
    await supabase.from("configuracoes").upsert([
      { chave: "lidderar_bearer_token", valor: result.token },
      { chave: "lidderar_usuario", valor: usuario },
      { chave: "lidderar_senha", valor: senha },
      { chave: "lidderar_token_atualizado_em", valor: new Date().toISOString() },
    ]);

    return new Response(
      JSON.stringify({
        ok: true,
        endpoint_usado: result.endpoint,
        payload_keys: result.payloadKeys,
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
