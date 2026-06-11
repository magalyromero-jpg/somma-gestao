import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BitrixTarefa {
  id: string;
  familia_id: string;
  bitrix_task_id: number;
  titulo: string;
  descricao: string | null;
  status: "pending" | "in_progress" | "awaiting_control" | "completed" | "deferred";
  prioridade: "high" | "average" | "low";
  responsavel_nome: string | null;
  responsavel_foto: string | null;
  prazo: string | null;
  marcadores: string[];
  link_bitrix: string | null;
  synced_at: string;
}

export interface BitrixComentario {
  ID: string;
  POST_MESSAGE: string;
  AUTHOR_NAME: string;
  POST_DATE: string;
}

export function useBitrixTarefas(familiaId: string | undefined, marcador: string | undefined) {
  const [tarefas, setTarefas] = useState<BitrixTarefa[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const fetchTarefas = useCallback(async (forceRefresh = false) => {
    if (!familiaId || !marcador) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("bitrix-proxy", {
        body: { action: "tarefas_por_familia", familia_id: familiaId, marcador, forceRefresh },
      });
      if (fnError) throw fnError;
      setTarefas(data.tarefas ?? []);
      setLastSync(new Date());
    } catch (err: any) {
      setError(err.message ?? "Erro ao buscar tarefas do Bitrix");
    } finally {
      setLoading(false);
    }
  }, [familiaId, marcador]);

  useEffect(() => { fetchTarefas(); }, [fetchTarefas]);

  return { tarefas, loading, error, lastSync, refetch: () => fetchTarefas(true) };
}

export async function fetchComentariosTarefa(taskId: number): Promise<BitrixComentario[]> {
  const { data, error } = await supabase.functions.invoke("bitrix-proxy", {
    body: { action: "comentarios_tarefa", task_id: taskId },
  });
  if (error) throw error;
  return data.comentarios ?? [];
}
