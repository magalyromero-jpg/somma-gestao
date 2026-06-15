// v3 - sincroniza grupos 25 e 29
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

// Configuração por grupo: tipos operacionais / não-família a excluir
const GRUPOS: { id: number; nome: string; excluir: string[] }[] = [
  {
    id: 25,
    nome: "Somma",
    excluir: [
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
    ],
  },
  {
    id: 29,
    nome: "Lidderar",
    excluir: [
      "GSI",
      "GSI-01",
      "GSI-02",
      "GSI-03",
      "GSI-05",
      "GSI-06",
      "GSI-07",
      "GSI-08",
      "LIDDERAR",
      "Organização",
      "Sistema",
      "Acompanhamento",
      "Analítico",
      "Operacional",
      "MFO",
    ],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: webhookConfig } = await supabase.from("configuracoes").select("valor").eq("chave", "bitrix_webhook_url").single();
    if (!webhookConfig?.valor) throw new Error("Webhook não configurado");
    const BITRIX_URL = webhookConfig.valor.replace(/\/$/, "");

    let totalSincronizadas = 0;
    let totalFamilias = 0;

    // Processa cada grupo Bitrix configurado
    for (const grupo of GRUPOS) {
      const tiposOperacionais = new Set(grupo.excluir.map((s) => s.trim().toLowerCase()));

      // 1. Busca TODAS as tarefas do grupo para coletar tags
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
              filter: { "GROUP_ID": grupo.id },
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
        .filter((tag) => !tiposOperacionais.has(tag.trim().toLowerCase()))
        .map((tag) => ({ title: tag }));

      // Garante que Família Brandão (grupo 29) esteja na lista com ID conhecido
      if (grupo.id === 29 && !familias.some((f) => f.title === "Família Brandão")) {
        familias.push({ title: "Família Brandão" });
      }

      console.log(`[Grupo ${grupo.id} - ${grupo.nome}] Sincronizando ${familias.length} famílias: ${familias.map((f) => f.title).join(", ")}`);
      totalFamilias += familias.length;

      // Processa cada família
      for (const familia of familias) {
        const todasTarefas: any[] = [];
        let next: number | null = 0;
        let paginas = 0;

        // Grupo 29 tem históricos muito grandes (ex: Unicred Eleva ~2500 tarefas).
        // Para evitar timeout, busca apenas tarefas não concluídas (!STATUS = 5).
        // Grupo 25 continua buscando tudo (abertas + concluídas).
        const filtroTarefas: Record<string, unknown> = { "GROUP_ID": grupo.id, "TAG": familia.title };
        if (grupo.id === 29) filtroTarefas["!STATUS"] = "5";

        // 3. Busca as tarefas com a tag da família no grupo
        while (next !== null && paginas < 100) {
          paginas++;
          const res = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filter: filtroTarefas,
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

        console.log(`[Grupo ${grupo.id}] ${familia.title}: ${todasTarefas.length} tarefas encontradas`);

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
            bitrix_parent_id: parseInt(t.parentId) || null,
            // NÃO incluímos familia_bitrix_id no payload: ao usar upsert por bitrix_id,
            // omitir a coluna preserva o valor já definido manualmente no banco
            // e mantém null (default) para registros novos.
            familia_tag: familia.title,
            familia_titulo: familia.title,
            grupo_bitrix: grupo.id,
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
          if (error) console.error(`Upsert error [Grupo ${grupo.id}] ${familia.title}:`, error);
        }

        totalSincronizadas += registros.length;
      }
    }

    return new Response(
      JSON.stringify({ sucesso: true, familias: totalFamilias, tarefas_sincronizadas: totalSincronizadas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("bitrix-sync error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
