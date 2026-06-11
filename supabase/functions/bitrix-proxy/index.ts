import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function mapStatus(s: string): string {
  return ({ "2": "pending", "3": "in_progress", "4": "awaiting_control", "5": "completed", "6": "deferred" } as any)[s] ?? "pending";
}
function mapPrioridade(p: string): string {
  return ({ "2": "high", "1": "average", "0": "low" } as any)[p] ?? "average";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: config } = await supabase
      .from("configuracoes").select("valor").eq("chave", "bitrix_webhook_url").single();

    if (!config?.valor) {
      return new Response(
        JSON.stringify({ error: "Webhook Bitrix não configurado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const BITRIX_URL = config.valor.replace(/\/$/, "");
    const body = await req.json();
    const { action, familia_id, bitrix_task_id, forceRefresh } = body;

    // ── 1. LISTAR FAMÍLIAS (tarefas principais sem hífen no título) ────────
    if (action === "listar_familias_bitrix") {
      const allTasks: any[] = [];
      let start = 0;
      while (true) {
        const res = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filter: { "GROUP_ID": 25, "PARENT_ID": 0 },
            select: ["ID", "TITLE", "RESPONSIBLE_ID", "DEADLINE"],
            order: { "TITLE": "ASC" },
            params: { START: start },
          }),
        });
        const data = await res.json();
        const tasks = data?.result?.tasks ?? [];
        allTasks.push(...tasks);
        if (!data?.next) break;
        start = data.next;
      }

      const tarefas = allTasks
        .filter((t: any) => !t.title.includes(' - '))
        .map((t: any) => ({
          id: t.id,
          titulo: t.title,
          responsavel_id: t.responsibleId,
        }));

      return new Response(
        JSON.stringify({ familias_bitrix: tarefas }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 1b. DASHBOARD BITRIX ───────────────────────────────────────────────
    if (action === "dashboard_bitrix") {
      const todasFamilias: any[] = [];
      let next: number | null = 0;
      while (next !== null) {
        const res = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filter: { "GROUP_ID": 25, "PARENT_ID": 0 },
            select: ["ID", "TITLE", "RESPONSIBLE_ID", "ACTIVITY_DATE"],
            order: { "ID": "ASC" },
            params: { START: next },
          }),
        });
        const data = await res.json();
        const tasks = data?.result?.tasks ?? [];
        todasFamilias.push(...tasks.filter((t: any) => !t.title.includes(' - ')));
        next = data?.next ?? null;
      }

      // Resolve nomes dos responsáveis
      const ids = [...new Set(todasFamilias.map((t: any) => t.responsibleId).filter(Boolean))];
      const respMap: Record<string, string> = {};
      if (ids.length > 0) {
        const res = await fetch(`${BITRIX_URL}/user.get.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filter: { ID: ids } }),
        });
        if (res.ok) {
          const ud = await res.json();
          for (const u of ud?.result ?? []) {
            respMap[u.ID] = `${u.NAME} ${u.LAST_NAME}`.trim();
          }
        }
      }

      const familias = todasFamilias.map((t: any) => ({
        id: t.id,
        titulo: t.title,
        responsavel_nome: respMap[t.responsibleId] ?? null,
        ultima_atividade: t.activityDate ?? null,
        total_abertas: 0,
        atrasadas: 0,
        alta_prioridade: 0,
        hoje: 0,
      }));

      return new Response(
        JSON.stringify({
          familias,
          totais: {
            total_familias: familias.length,
            total_abertas: 0,
            total_atrasadas: 0,
            total_alta_prioridade: 0,
            total_hoje: 0,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. SUBTAREFAS (demandas) DE UMA FAMÍLIA ───────────────────────────
    if (action === "tarefas_por_familia") {
      if (!familia_id || !bitrix_task_id) {
        return new Response(
          JSON.stringify({ error: "familia_id e bitrix_task_id são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!forceRefresh) {
        const { data: cached } = await supabase
          .from("bitrix_tarefas_cache")
          .select("*")
          .eq("familia_id", familia_id)
          .gte("synced_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .order("prazo", { ascending: true, nullsFirst: false });
        if (cached && cached.length > 0) {
          return new Response(
            JSON.stringify({ tarefas: cached, fonte: "cache" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const allTasks: any[] = [];
      let start = 0;
      while (true) {
        const res = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filter: { "PARENT_ID": bitrix_task_id, "!STATUS": "5" },
            select: ["ID", "TITLE", "DESCRIPTION", "STATUS", "PRIORITY", "DEADLINE", "RESPONSIBLE_ID", "TAGS", "CREATED_DATE"],
            order: { "DEADLINE": "ASC" },
            params: { START: start },
          }),
        });
        if (!res.ok) break;
        const data = await res.json();
        const tasks = data?.result?.tasks ?? [];
        allTasks.push(...tasks);
        if (tasks.length < 50) break;
        start += 50;
      }

      const ids = [...new Set(allTasks.map((t: any) => t.responsibleId).filter(Boolean))];
      const respMap: Record<string, { nome: string; foto: string }> = {};
      if (ids.length > 0) {
        const res = await fetch(`${BITRIX_URL}/user.get.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filter: { ID: ids } }),
        });
        if (res.ok) {
          const ud = await res.json();
          for (const u of ud?.result ?? []) {
            respMap[u.ID] = { nome: `${u.NAME} ${u.LAST_NAME}`.trim(), foto: u.PERSONAL_PHOTO ?? "" };
          }
        }
      }

      const tarefas = allTasks.map((t: any) => ({
        familia_id,
        bitrix_task_id: parseInt(t.id),
        titulo: t.title,
        descricao: t.description ?? null,
        status: mapStatus(t.status),
        prioridade: mapPrioridade(t.priority),
        responsavel_nome: respMap[t.responsibleId]?.nome ?? null,
        responsavel_foto: respMap[t.responsibleId]?.foto ?? null,
        prazo: t.deadline ?? null,
        marcadores: t.tags ?? [],
        link_bitrix: `https://sommainvestimentos.bitrix24.com.br/company/personal/user/1884/tasks/task/view/${t.id}/`,
        synced_at: new Date().toISOString(),
      }));

      if (tarefas.length > 0) {
        await supabase.from("bitrix_tarefas_cache")
          .upsert(tarefas, { onConflict: "familia_id,bitrix_task_id" });
      } else {
        await supabase.from("bitrix_tarefas_cache").delete().eq("familia_id", familia_id);
      }

      return new Response(
        JSON.stringify({ tarefas, fonte: "bitrix", total: tarefas.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "tarefas_concluidas") {
      if (!bitrix_task_id) {
        return new Response(JSON.stringify({ error: "bitrix_task_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const allTasks: any[] = [];
      let next: number | null = 0;
      while (next !== null) {
        const res = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filter: { "PARENT_ID": bitrix_task_id, "STATUS": "5" },
            select: ["ID", "TITLE", "STATUS", "PRIORITY", "DEADLINE", "RESPONSIBLE_ID", "CLOSED_DATE", "CHANGED_DATE"],
            order: { "CLOSED_DATE": "DESC" },
            params: { START: next },
          }),
        });
        if (!res.ok) break;
        const data = await res.json();
        const tasks = data?.result?.tasks ?? [];
        allTasks.push(...tasks);
        next = data?.next ?? null;
      }
      const ids = [...new Set(allTasks.map((t: any) => t.responsibleId).filter(Boolean))];
      const respMap: Record<string, string> = {};
      if (ids.length > 0) {
        const res = await fetch(`${BITRIX_URL}/user.get.json`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filter: { ID: ids } }),
        });
        if (res.ok) {
          const ud = await res.json();
          for (const u of ud?.result ?? []) respMap[u.ID] = `${u.NAME} ${u.LAST_NAME}`.trim();
        }
      }
      const tarefas = allTasks.map((t: any) => ({
        bitrix_task_id: parseInt(t.id),
        titulo: t.title,
        status: "completed",
        prioridade: mapPrioridade(t.priority),
        responsavel_nome: respMap[t.responsibleId] ?? null,
        prazo: t.deadline ?? null,
        data_conclusao: t.closedDate ?? t.changedDate ?? null,
        link_bitrix: `https://sommainvestimentos.bitrix24.com.br/company/personal/user/1884/tasks/task/view/${t.id}/`,
      }));
      return new Response(JSON.stringify({ tarefas, total: tarefas.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── 3. COMENTÁRIOS ────────────────────────────────────────────────────
    if (action === "comentarios_tarefa") {
      const { task_id } = body;
      if (!task_id) {
        return new Response(
          JSON.stringify({ error: "task_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const res = await fetch(`${BITRIX_URL}/task.commentitem.getlist.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ TASKID: task_id, ORDER: { POST_DATE: "ASC" } }),
      });
      const data = await res.json();
      return new Response(
        JSON.stringify({ comentarios: data?.result ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. RESUMO DASHBOARD ───────────────────────────────────────────────
    if (action === "resumo_dashboard") {
      const { data: tarefas } = await supabase
        .from("bitrix_tarefas_cache")
        .select("status, prioridade, familia_id, titulo, prazo, responsavel_nome")
        .neq("status", "completed");

      const resumo = {
        total: tarefas?.length ?? 0,
        pendentes: tarefas?.filter(t => t.status === "pending").length ?? 0,
        em_andamento: tarefas?.filter(t => t.status === "in_progress").length ?? 0,
        alta_prioridade: tarefas?.filter(t => t.prioridade === "high").length ?? 0,
        atrasadas: tarefas?.filter(t => t.prazo && new Date(t.prazo) < new Date()).length ?? 0,
      };

      return new Response(
        JSON.stringify({ resumo, tarefas }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Ação desconhecida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("bitrix-proxy error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
