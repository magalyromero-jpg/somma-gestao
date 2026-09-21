import { isPast, isToday, parseISO } from "date-fns";

export const INICIO_HISTORICO = "2026-09-01";

/**
 * Status Bitrix (após mapStatus no bitrix-sync):
 *  pending · in_progress · awaiting_control · deferred · completed · declined · deleted · unknown
 */

// Status que a tela Operacional carrega do banco (concluídas/recusadas/excluídas ficam de fora)
export const STATUS_CARREGAR = ["pending", "in_progress", "awaiting_control", "deferred"] as const;

// Status "ativos": tarefa realmente em andamento. Só estas podem ser consideradas atrasadas.
export const STATUS_ATIVOS = ["pending", "in_progress"] as const;

// Seleção inicial do filtro de status
export const STATUS_PADRAO: string[] = [...STATUS_ATIVOS];

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  awaiting_control: "Aguard. controle",
  deferred: "Adiada",
};

/** Atrasada = tarefa ativa (pendente/em andamento) com prazo anterior a hoje. */
export function isAtrasada(t: { prazo: string | null; status: string }): boolean {
  if (!(STATUS_ATIVOS as readonly string[]).includes(t.status) || !t.prazo) return false;
  const p = parseISO(t.prazo);
  return isPast(p) && !isToday(p);
}

export function media(arr: number[]): number | null {
  return arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : null;
}

/** Busca todas as linhas em páginas de 1000 (limite padrão do Supabase). */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}
