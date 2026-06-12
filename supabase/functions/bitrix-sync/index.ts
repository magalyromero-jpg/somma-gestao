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

    // Tipos operacionais (tags que NÃO são famílias)
    const TIPOS_OPERACIONAIS = new Set([
      "Operacional",
      "Gestão Patrimonial",
      "Acompanhamento",
      "Analítico",
      "Planejamento Patrimonial",
      "Gestão de Contas",
      "Due Diligence Prévio",
      "Negócios",
      "Gestão de Patrimônio",
      "Análise/Proposta",
    ].map((s) => s.toLowerCase()));

    // 1. Busca TODAS as tarefas do grupo 25 (ORDER ID DESC) para coletar tags
    const tagsSet = new Set<string>();
    {
      let next: number | null = 0;
      let paginas = 0;
      while (next !== null && paginas < 200) {
        paginas++;
        const res = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filter: { "GROUP_ID": 25 },
            select: ["ID", "TITLE", "TAGS"],
            order: { "ID": "DESC" },
            params: { START: next },
          }),
        });
        if (!res.ok) break;
        const data = await res.json();
        const tasks = data?.result?.tasks ?? [];
        for (const t of tasks) {
          for (const tag of Object.values(t.tags ?? {})) {
            const name = (tag as any)?.title;
            if (name) tagsSet.add(name);
          }
        }
        next = data?.result?.next ?? null;
      }
    }

    // 2. Filtra tags que são nomes de família (não são tipos operacionais)
    const familias = Array.from(tagsSet)
      .filter((tag) => !TIPOS_OPERACIONAIS.has(tag.trim().toLowerCase()))
      .map((tag) => ({ title: tag }));

    console.log(`Sincronizando ${familias.length} famílias: ${familias.map((f) => f.title).join(", ")}`);

    let totalSincronizadas = 0;

    // Processa cada família
    for (const familia of familias) {
      const todasTarefas: any[] = [];
      let next: number | null = 0;
      let paginas = 0;

      // 3. Busca TODAS as tarefas com a tag da família no grupo 25
      while (next !== null && paginas < 200) {
        paginas++;
        const res = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filter: { "GROUP_ID": 25, "TAG": familia.title },
            select: ["ID", "TITLE", "DESCRIPTION", "STATUS", "PRIORITY", "DEADLINE", "RESPONSIBLE_ID", "CREATED_DATE", "CLOSED_DATE", "CHANGED_DATE", "TAGS"],
            order: { "ID": "ASC" },
            params: { START: next },
          }),
        });
        if (!res.ok) break;
        const data = await res.json();
        const tasks = data?.result?.tasks ?? [];
        todasTarefas.push(...tasks);
        next = data?.result?.next ?? null;
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

      // Formata registros (deduplica por bitrix_id para evitar erro 21000)
      const vistos = new Set<number>();
      const registros = todasTarefas
        .filter((t: any) => {
          const id = parseInt(t.id);
          if (vistos.has(id)) return false;
          vistos.add(id);
          return true;
        })
        .map((t: any) => ({
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
