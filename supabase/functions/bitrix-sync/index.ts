// v5 - paginação corrigida (start / next no nível raiz), passada única por grupo, abertas completas + concluídas recentes
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function mapStatus(s: string): string {
  // Bitrix: 1 nova · 2 pendente · 3 em andamento · 4 aguardando controle · 5 concluída · 6 adiada · 7 recusada
  return ({ "1": "pending", "2": "pending", "3": "in_progress", "4": "awaiting_control", "5": "completed", "6": "deferred", "7": "declined" } as any)[String(s)] ?? "unknown";
}
function mapPrioridade(p: string): string {
  return ({ "2": "high", "1": "average", "0": "low" } as any)[p] ?? "average";
}

// Tags que NÃO são famílias/clientes
const TAGS_OPERACIONAIS = new Set([
  "Operacional", "Gestão Patrimonial", "Acompanhamento", "Analítico",
  "Planejamento Patrimonial", "Gestão de Contas", "Due Diligence Prévio",
  "Negócios", "Análise/Proposta", "Gestão de Patrimônio",
  "GSI", "GSI-01", "GSI-02", "GSI-03", "GSI-05", "GSI-06", "GSI-07", "GSI-08",
  "LIDDERAR", "Organização", "Sistema", "TI", "MFO", "Blue Doors",
  "Comercial", "Conteúdo", "Jurídico", "Área do Cliente",
  "Unicred", "Unicred - Premium", "Unicred Porto Alegre",
  "crm", "Atualização cadastral",
]);

function familiaDaTarefa(tags: Record<string, { id: number; title: string }>): string | null {
  const titles = Object.values(tags ?? {}).map((t) => t.title);
  return titles.find((t) => !TAGS_OPERACIONAIS.has(t)) ?? titles[0] ?? null;
}

const GRUPOS: { id: number; nome: string }[] = [
  { id: 25, nome: "Somma" },
  { id: 29, nome: "Lidderar" },
];

const SELECT = ["ID", "TITLE", "DESCRIPTION", "STATUS", "PRIORITY", "PARENT_ID", "DEADLINE", "RESPONSIBLE_ID", "CREATED_DATE", "CLOSED_DATE", "CHANGED_DATE", "TAGS"];

const ORCAMENTO_MS = 115_000;      // para de varrer antes do limite da Edge Function
const DIAS_CONCLUIDAS = 120;       // janela de concluídas recentes
const MAX_PAGINAS_ABERTAS = 400;
const MAX_PAGINAS_CONCLUIDAS = 30;
const MAX_RECONCILIAR = 500;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const inicio = Date.now();
  const estourou = () => Date.now() - inicio > ORCAMENTO_MS;
  let parcial = false;

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: webhookConfig } = await supabase.from("configuracoes").select("valor").eq("chave", "bitrix_webhook_url").single();
    if (!webhookConfig?.valor) throw new Error("Webhook não configurado");
    const BITRIX_URL = webhookConfig.valor.replace(/\/$/, "");

    const nomesUsuarios: Record<string, string> = {};
    const familiasVistas = new Set<string>();
    let totalSincronizadas = 0;
    let totalComPrincipal = 0;
    let totalSemPrincipal = 0;

    async function carregarNomes(ids: string[]) {
      const faltam = ids.filter((id) => id && !(id in nomesUsuarios));
      if (!faltam.length) return;
      const res = await fetch(`${BITRIX_URL}/user.get.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter: { ID: faltam } }),
      });
      if (res.ok) {
        const ud = await res.json();
        for (const u of ud?.result ?? []) nomesUsuarios[String(u.ID)] = `${u.NAME} ${u.LAST_NAME}`.trim();
      }
      for (const id of faltam) if (!(id in nomesUsuarios)) nomesUsuarios[id] = "";
    }

    // Varre o grupo com paginação real e grava página a página
    async function coletar(grupoId: number, filtro: Record<string, unknown>, maxPaginas: number, rotulo: string, vistos: Set<number>) {
      let start = 0;
      let paginas = 0;
      let lidas = 0;
      while (paginas < maxPaginas) {
        if (estourou()) { parcial = true; break; }
        paginas++;
        const res = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filter: { GROUP_ID: grupoId, ...filtro }, select: SELECT, order: { ID: "ASC" }, start }),
        });
        if (!res.ok) { console.error(`[Grupo ${grupoId}] ${rotulo}: HTTP ${res.status}`); break; }
        const data = await res.json();
        const tasks: any[] = data?.result?.tasks ?? [];
        if (tasks.length === 0) break;

        const novas = tasks.filter((t) => !vistos.has(parseInt(t.id)));
        if (novas.length === 0) { console.warn(`[Grupo ${grupoId}] ${rotulo}: página sem tarefas novas, encerrando (paginação não avançou)`); break; }

        await carregarNomes([...new Set(novas.map((t: any) => String(t.responsibleId ?? "")).filter(Boolean))]);

        const registros = novas.map((t: any) => {
          const fam = familiaDaTarefa(t.tags ?? {});
          if (fam && !TAGS_OPERACIONAIS.has(fam)) familiasVistas.add(fam);
          return {
            bitrix_id: parseInt(t.id),
            bitrix_parent_id: parseInt(t.parentId) || null,
            familia_bitrix_id: (grupoId === 29 && fam === "Família Brandão") ? 83232 : null,
            familia_tag: fam,
            familia_titulo: fam,
            grupo_bitrix: grupoId,
            titulo: t.title,
            descricao: t.description ?? null,
            status: mapStatus(t.status),
            prioridade: mapPrioridade(t.priority),
            responsavel_id: t.responsibleId ?? null,
            responsavel_nome: nomesUsuarios[String(t.responsibleId)] || null,
            criado_em: t.createdDate ?? null,
            prazo: t.deadline ?? null,
            concluido_em: t.closedDate ?? null,
            alterado_em: t.changedDate ?? null,
            marcadores: Object.values(t.tags ?? {}).map((tag: any) => tag.title),
            link_bitrix: `https://sommainvestimentos.bitrix24.com.br/company/personal/user/1884/tasks/task/view/${t.id}/`,
            synced_at: new Date().toISOString(),
          };
        });

        const { error } = await supabase.from("bitrix_tarefas").upsert(registros, { onConflict: "bitrix_id" });
        if (error) {
          console.error(`Upsert error [Grupo ${grupoId}] ${rotulo}:`, JSON.stringify(error));
        } else {
          for (const r of registros) vistos.add(r.bitrix_id);
          totalSincronizadas += registros.length;
          const comP = registros.filter((r) => r.bitrix_parent_id != null).length;
          totalComPrincipal += comP;
          totalSemPrincipal += registros.length - comP;
          lidas += registros.length;
        }

        // Bitrix devolve "next" na raiz da resposta; se não vier, avança 50 quando a página veio cheia
        const proximo = data?.next ?? data?.result?.next ?? (tasks.length >= 50 ? start + 50 : null);
        if (proximo === null || proximo === undefined) break;
        start = Number(proximo);
      }
      console.log(`[Grupo ${grupoId}] ${rotulo}: ${lidas} tarefas gravadas em ${paginas} página(s)`);
    }

    const desde = new Date(Date.now() - DIAS_CONCLUIDAS * 86400_000).toISOString().slice(0, 10);

    for (const grupo of GRUPOS) {
      const idsDoGrupo = new Set<number>();

      // A) TODAS as tarefas não concluídas do grupo (abertas, aguardando controle, adiadas, recusadas)
      await coletar(grupo.id, { "!STATUS": "5" }, MAX_PAGINAS_ABERTAS, "não concluídas", idsDoGrupo);

      // B) Concluídas recentes (para métricas de concluídas do mês/semana e tempo de finalização)
      await coletar(grupo.id, { STATUS: "5", ">=CLOSED_DATE": desde }, MAX_PAGINAS_CONCLUIDAS, `concluídas desde ${desde}`, idsDoGrupo);

      // C) Reconciliação: tarefas que o banco ainda tem como abertas mas não vieram (concluídas antigas, movidas, apagadas)
      if (!estourou()) {
        try {
          const staleIds: number[] = [];
          for (let from = 0; ; from += 1000) {
            const { data, error } = await supabase
              .from("bitrix_tarefas").select("bitrix_id")
              .eq("grupo_bitrix", grupo.id)
              .in("status", ["pending", "in_progress", "awaiting_control", "deferred", "unknown"])
              .order("bitrix_id").range(from, from + 999);
            if (error || !data) break;
            for (const r of data) if (!idsDoGrupo.has(Number(r.bitrix_id))) staleIds.push(Number(r.bitrix_id));
            if (data.length < 1000) break;
          }
          const alvo = staleIds.slice(0, MAX_RECONCILIAR);
          let atualizadas = 0, naoEncontradas = 0;
          for (let i = 0; i < alvo.length && !estourou(); i += 50) {
            const lote = alvo.slice(i, i + 50);
            const res = await fetch(`${BITRIX_URL}/tasks.task.list.json`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filter: { ID: lote }, select: ["ID", "STATUS", "PRIORITY", "PARENT_ID", "DEADLINE", "CLOSED_DATE", "CHANGED_DATE"] }),
            });
            if (!res.ok) continue;
            const data = await res.json();
            const tasks: any[] = data?.result?.tasks ?? [];
            const achadas = new Set<number>(tasks.map((t: any) => parseInt(t.id)));
            naoEncontradas += lote.filter((id) => !achadas.has(id)).length;
            await Promise.all(tasks.map((t: any) =>
              supabase.from("bitrix_tarefas").update({
                status: mapStatus(t.status),
                prioridade: mapPrioridade(t.priority),
                bitrix_parent_id: parseInt(t.parentId) || null,
                prazo: t.deadline ?? null,
                concluido_em: t.closedDate ?? null,
                alterado_em: t.changedDate ?? null,
                synced_at: new Date().toISOString(),
              }).eq("bitrix_id", parseInt(t.id))
            ));
            atualizadas += tasks.length;
          }
          console.log(`[Grupo ${grupo.id}] Reconciliação: ${staleIds.length} desatualizadas, ${atualizadas} atualizadas, ${naoEncontradas} não encontradas`);
        } catch (e) {
          console.error(`Reconciliação falhou [Grupo ${grupo.id}]:`, e);
        }
      }
    }

    await supabase.rpc("consolidar_familia_ids");
    await supabase.rpc("atribuir_ids_sinteticos");

    let snapshot = false;
    try {
      const { error: snapErro } = await supabase.rpc("registrar_snapshot_operacional");
      if (snapErro) throw snapErro;
      snapshot = true;
    } catch (e) {
      console.error("registrar_snapshot_operacional falhou:", e);
    }


    return new Response(
      JSON.stringify({
        sucesso: true,
        parcial,
        familias: familiasVistas.size,
        tarefas_sincronizadas: totalSincronizadas,
        com_principal: totalComPrincipal,
        sem_principal: totalSemPrincipal,
        segundos: Math.round((Date.now() - inicio) / 1000),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("bitrix-sync error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
