import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { slugEdificio } from "@/lib/perfis";

const db = supabase as any;

export interface EdificioMenu { id: string; nome: string; slug: string }

/** Edifícios visíveis ao usuário: equipe vê todos; cliente só os liberados em loc_acessos. */
export function useEdificios() {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ["edificios-menu", user?.id, role],
    enabled: !!user && !!role,
    queryFn: async (): Promise<EdificioMenu[]> => {
      let q = db.from("loc_edificios").select("id,nome").order("nome");
      if (role === "familia") {
        const { data: ac, error } = await db.from("loc_acessos").select("edificio_id").eq("user_id", user!.id);
        if (error) throw error;
        const ids = (ac ?? []).map((a: any) => a.edificio_id);
        if (!ids.length) return [];
        q = q.in("id", ids);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((e: any) => ({ id: e.id, nome: e.nome, slug: slugEdificio(e.nome) }));
    },
  });
}
