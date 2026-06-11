import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function mapStatus(status: string): string {
  const map: Record<string, string> = { "2": "pending", "3": "in_progress", "4": "awaiting_control", "5": "completed", "6": "deferred" };
  return map[status] ?? "pending";
}

function mapPrioridade(priority: string): string {
  const map: Record<string, string> = { "2": "high", "1": "average", "0": "low" };
  return map[priority] ?? "average";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: config, error: configError } = await supabase
      .from("configuracoes").select("valor").eq("chave", "bitrix_webhook_url").single();

    if (configError || !config?.valor) {
      return new Response(
        JSON.stringify({ error: "Webhook Bitrix não configurado. Acesse Configurações e informe a URL." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const BITRIX_URL = config.valor.replace(/\/$/, "");
    const body = await req.json();
    const { action, familia_id, marcador, task_id, forceRefresh } = body;

    if (action === "tarefas_por_familia") {
      if (!familia_id || !marcador) {
        return new Response(
          JSON.stringify({ error: "familia_id e marcador são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!forceRefresh) {
        const { data: cached } = await supabase
          .from("bitrix_tarefas_cache").select("*").eq("familia_id", familia_id)
          .gte("synced_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .order("prazo", { ascending: true });
        if (cached && cached.length > 0) {
          return new Response(JSON.stringify({ tarefas: cached, fonte: "cache" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const allTasks: any[] = [];
      let start = 0;
      while (true) {
        const bitrixRes = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filter: { TAG: marcador, "!STATUS": "5" },
            select: ["ID", "TITLE", "DESCRIPTION", "STATUS", "PRIORITY", "DEADLINE", "RESPONSIBLE_ID", "TAG"],
            order: { DEADLINE: "ASC" },
            params: { START: start },
          }),
        });
        if (!bitrixRes.ok) break;
        const bitrixData = await bitrixRes.json();
        const tasks = bitrixData?.result?.tasks ?? [];
        allTasks.push(...tasks);
        if (tasks.length < 50) break;
        start += 50;
      }

      const responsavelIds = [...new Set(allTasks.map((t: any) => t.responsibleId).filter(Boolean))];
      const responsaveisMap: Record<string, { nome: string; foto: string }> = {};
      if (responsavelIds.length > 0) {
        const usersRes = await fetch(`${BITRIX_URL}/user.get.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filter: { ID: responsavelIds } }),
        });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          for (const u of usersData?.result ?? []) {
            responsaveisMap[u.ID] = { nome: `${u.NAME} ${u.LAST_NAME}`.trim(), foto: u.PERSONAL_PHOTO ?? "" };
          }
        }
      }

      const tarefasFormatadas = allTasks.map((t: any) => ({
        familia_id,
        bitrix_task_id: parseInt(t.id),
        titulo: t.title,
        descricao: t.description ?? null,
        status: mapStatus(t.status),
        prioridade: mapPrioridade(t.priority),
        responsavel_nome: responsaveisMap[t.responsibleId]?.nome ?? null,
        responsavel_foto: responsaveisMap[t.responsibleId]?.foto ?? null,
        prazo: t.deadline ?? null,
        marcadores: t.tag ?? [],
        link_bitrix: `https://sommainvestimentos.bitrix24.com.br/company/personal/user/1884/tasks/task/view/${t.id}/`,
        synced_at: new Date().toISOString(),
      }));

      if (tarefasFormatadas.length > 0) {
        await supabase.from("bitrix_tarefas_cache").upsert(tarefasFormatadas, { onConflict: "familia_id,bitrix_task_id" });
      } else {
        await supabase.from("bitrix_tarefas_cache").delete().eq("familia_id", familia_id);
      }

      return new Response(
        JSON.stringify({ tarefas: tarefasFormatadas, fonte: "bitrix", total: tarefasFormatadas.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "comentarios_tarefa") {
      if (!task_id) {
        return new Response(JSON.stringify({ error: "task_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const res = await fetch(`${BITRIX_URL}/task.commentitem.getlist.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ TASKID: task_id, ORDER: { POST_DATE: "ASC" } }),
      });
      if (!res.ok) throw new Error("Erro ao buscar comentários do Bitrix");
      const data = await res.json();
      return new Response(JSON.stringify({ comentarios: data?.result ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "resumo_dashboard") {
      const { data: tarefas } = await supabase
        .from("bitrix_tarefas_cache").select("status, prioridade, familia_id, titulo, prazo, responsavel_nome")
        .neq("status", "completed");
      const resumo = {
        total: tarefas?.length ?? 0,
        pendentes: tarefas?.filter(t => t.status === "pending").length ?? 0,
        em_andamento: tarefas?.filter(t => t.status === "in_progress").length ?? 0,
        alta_prioridade: tarefas?.filter(t => t.prioridade === "high").length ?? 0,
        atrasadas: tarefas?.filter(t => t.prazo && new Date(t.prazo) < new Date()).length ?? 0,
      };
      return new Response(JSON.stringify({ resumo, tarefas }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("bitrix-proxy error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
