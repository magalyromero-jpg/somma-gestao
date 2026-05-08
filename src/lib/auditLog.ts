import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
  familiaId?: string | null;
  autorId?: string | null;
  autorNome?: string | null;
  acao: string;
  entidade?: string | null;
  entidadeId?: string | null;
  antes?: any;
  depois?: any;
}

/**
 * Registra uma ação no audit_log. Falhas são apenas logadas no console;
 * audit log nunca deve quebrar fluxo de UI.
 */
export async function registrarAcao(entry: AuditLogEntry) {
  try {
    const { error } = await supabase.from("audit_log").insert({
      familia_id: entry.familiaId ?? null,
      autor_id: entry.autorId ?? null,
      autor_nome: entry.autorNome ?? null,
      acao: entry.acao,
      entidade: entry.entidade ?? null,
      entidade_id: entry.entidadeId ?? null,
      antes: entry.antes ?? null,
      depois: entry.depois ?? null,
    });
    if (error) console.warn("audit_log insert error:", error.message);
  } catch (e) {
    console.warn("audit_log exception:", e);
  }
}
