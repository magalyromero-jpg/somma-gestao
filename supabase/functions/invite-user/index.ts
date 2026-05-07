import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Perfil = "admin" | "gestor" | "analista";
const PERFIS: Perfil[] = ["admin", "gestor", "analista"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const callerId = userData.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verifica se o chamador é admin
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Apenas administradores podem convidar usuários" }, 403);

    const body = await req.json().catch(() => ({}));
    const { email, nome, perfil } = body as { email?: string; nome?: string; perfil?: Perfil };
    if (!email || !nome || !perfil || !PERFIS.includes(perfil)) {
      return json({ error: "Dados inválidos: email, nome e perfil válido são obrigatórios" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "E-mail inválido" }, 400);
    }

    const origin = req.headers.get("origin") ?? SUPABASE_URL;
    const { data: invite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome, perfil },
      redirectTo: `${origin}/auth/set-password`,
    });
    if (inviteErr || !invite?.user) {
      return json({ error: inviteErr?.message ?? "Falha ao enviar convite" }, 400);
    }

    const newUserId = invite.user.id;

    // Garante profile (handle_new_user já cria — apenas atualiza nome/status)
    await admin.from("profiles").upsert(
      { user_id: newUserId, nome, email, status: "pendente" },
      { onConflict: "user_id" },
    );

    // Atribui o papel solicitado (handle_new_user adiciona 'familia' por padrão; substituímos)
    await admin.from("user_roles").delete().eq("user_id", newUserId);
    await admin.from("user_roles").insert({ user_id: newUserId, role: perfil });

    return json({ ok: true, user_id: newUserId });
  } catch (e) {
    console.error("invite-user error", e);
    return json({ error: (e as Error).message ?? "Erro interno" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
