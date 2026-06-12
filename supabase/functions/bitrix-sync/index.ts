// v2 - usa bitrix_familias_ids
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

    const { data: webhookConfig } = await supabase.from("configuracoes").select("valor").eq("chave", "bitrix_webhook_url").single();
    if (!webhookConfig?.valor) throw new Error("Webhook não configurado");
    const BITRIX_URL = webhookConfig.valor.replace(/\/$/, "");

    // Busca IDs das famílias cadastrados no banco
    const { data: familiasConfig } = await supabase.from("configuracoes").select("valor").eq("chave", "bitrix_familias_ids").single();
    if (!familiasConfig?.valor) throw new Error("IDs de famílias não configurados");

    const familiaIds = familiasConfig.valor.split(",").map((id: string) => id.trim()).filter(Boolean);

    // Busca detalhes de cada família em paralelo
    const familias = await Promise.all(familiaIds.map(async (id: string) => {
      const res = await fetch(`${BITRIX_URL}/tasks.task.get.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: parseInt(id) }),
      });
      const data = await res.json();
      return { id, title: data?.result?.task?.title ?? id };
    }));

    console.log(`Sincronizando ${familias.length} famílias: ${familias.map(f => f.title).join(", ")}`);

    let totalSincronizadas = 0;

    // Processa cada família
    for (const familia of familias) {
      const todasTarefas: any[] = [];
      let next: number | null = 0;

      // Busca TODAS as subtarefas (abertas e concluídas)
      while (next !== null) {
        const res = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filter: { "PARENT_ID": parseInt(familia.id) },
            select: ["ID", "TITLE", "DESCRIPTION", "STATUS", "PRIORITY", "DEADLINE", "RESPONSIBLE_ID", "CREATED_DATE", "CLOSED_DATE", "CHANGED_DATE", "TAGS"],
            order: { "ID": "ASC" },
            params: { START: next },
          }),
        });
        if (!res.ok) break;
        const data = await res.json();
        const tasks = data?.result?.tasks ?? [];
        todasTarefas.push(...tasks);
        next = data?.next ?? null;
      }

      console.log(`${familia.title}: ${todasTarefas.length} tarefas encontradas`);

      if (todasTarefas.length === 0) continue;

      // Busca nomes dos responsáveis
      const ids = [...new Set(todasTarefas.map((t: any) => t.responsibleId).filter(Boolean))];
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

      // Formata registros
      const registros = todasTarefas.map((t: any) => ({
        bitrix_id: parseInt(t.id),
        bitrix_parent_id: parseInt(familia.id),
        familia_bitrix_id: parseInt(familia.id),
        familia_titulo: familia.title,
        titulo: t.title,
        descricao: t.description ?? null,
        status: mapStatus(t.status),
        prioridade: mapPrioridade(t.priority),
        responsavel_id: t.responsibleId ?? null,
        responsavel_nome: respMap[t.responsibleId] ?? null,
        criado_em: t.createdDate ?? null,
        prazo: t.deadline ?? null,
        concluido_em: t.closedDate ?? null,
        alterado_em: t.changedDate ?? null,
        marcadores: Object.values(t.tags ?? {}).map((tag: any) => tag.title),
        link_bitrix: `https://sommainvestimentos.bitrix24.com.br/company/personal/user/1884/tasks/task/view/${t.id}/`,
        synced_at: new Date().toISOString(),
      }));

      // Upsert em lotes de 100
      for (let j = 0; j < registros.length; j += 100) {
        const { error } = await supabase.from("bitrix_tarefas").upsert(registros.slice(j, j + 100), { onConflict: "bitrix_id" });
        if (error) console.error(`Upsert error ${familia.title}:`, error);
      }

      totalSincronizadas += registros.length;
    }

    return new Response(
      JSON.stringify({ sucesso: true, familias: familias.length, tarefas_sincronizadas: totalSincronizadas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("bitrix-sync error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
