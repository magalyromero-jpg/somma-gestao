import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: config } = await supabase.from("configuracoes").select("valor").eq("chave", "bitrix_webhook_url").single();
    const BITRIX_URL = config.valor.replace(/\/$/, "");

    // Busca uma tarefa principal (sem pai) com TODOS os campos
    const res = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        select: ["*"],
        order: { "ID": "DESC" },
        filter: { "PARENT_ID": 0 },
        params: { "START": 0 }
      }),
    });
    const data = await res.json();
    const tarefas = data?.result?.tasks ?? [];

    // Pega a primeira tarefa e busca seus detalhes completos
    let detalhe = null;
    if (tarefas.length > 0) {
      const id = tarefas[0].id;
      const detRes = await fetch(`${BITRIX_URL}/tasks.task.get.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: id }),
      });
      const detData = await detRes.json();
      detalhe = detData?.result?.task ?? null;
    }

    return new Response(JSON.stringify({ total: tarefas.length, primeira_tarefa: tarefas[0] ?? null, detalhe_completo: detalhe }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
