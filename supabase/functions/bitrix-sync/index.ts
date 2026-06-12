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
    if (!config?.valor) throw new Error("Webhook não configurado");
    const BITRIX_URL = config.valor.replace(/\/$/, "");

    const body = await req.json().catch(() => ({}));
    const { modo = "incremental" } = body;

    // Passo 1: busca todas as famílias (tarefas principais stageId=153)
    const familias: any[] = [];
    let next: number | null = 0;
    while (next !== null) {
      const res = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter: { "GROUP_ID": 25, "PARENT_ID": 0 },
          select: ["ID", "TITLE", "RESPONSIBLE_ID"],
          order: { "ID": "ASC" },
          params: { START: next },
        }),
      });
      const data = await res.json();
      const tasks = data?.result?.tasks ?? [];
      familias.push(...tasks.filter((t: any) => !t.title.includes(' - ')));
      next = data?.next ?? null;
    }

    // Passo 2: para cada família, busca TODAS as subtarefas (abertas e concluídas)
    let totalSincronizadas = 0;
    const LOTE = 5;

    for (let i = 0; i < familias.length; i += LOTE) {
      const lote = familias.slice(i, i + LOTE);
      await Promise.all(lote.map(async (familia: any) => {
        const todasTarefas: any[] = [];
        let start: number | null = 0;

        while (start !== null) {
          const res = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filter: { "PARENT_ID": familia.id },
              select: ["ID", "TITLE", "DESCRIPTION", "STATUS", "PRIORITY", "DEADLINE", "RESPONSIBLE_ID", "CREATED_DATE", "CLOSED_DATE", "CHANGED_DATE", "TAGS"],
              order: { "ID": "ASC" },
              params: { START: start },
            }),
          });
          if (!res.ok) break;
          const data = await res.json();
          const tasks = data?.result?.tasks ?? [];
          todasTarefas.push(...tasks);
          start = data?.next ?? null;
        }

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

        // Formata e salva em lotes de 100
        const registros = todasTarefas.map((t: any) => ({
          bitrix_id: parseInt(t.id),
          bitrix_parent_id: parseInt(familia.id),
          familia_bitrix_id: parseInt(familia.id),
          familia_titulo: familia.title,
          titulo: t.title,
          descricao: t.description ?? null,
          status: ({ "2": "pending", "3": "in_progress", "4": "awaiting_control", "5": "completed", "6": "deferred" } as any)[t.status] ?? "pending",
          prioridade: ({ "2": "high", "1": "average", "0": "low" } as any)[t.priority] ?? "average",
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
          await supabase.from("bitrix_tarefas").upsert(registros.slice(j, j + 100), { onConflict: "bitrix_id" });
        }

        totalSincronizadas += registros.length;
      }));
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
