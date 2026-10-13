import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PortalEdificio } from "@/pages/admin/ZenTower";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

const db = supabase as any;

export default function AreaCliente() {
  const { user } = useAuth();
  const [sel, setSel] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["area-cliente", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: ac, error } = await db.from("loc_acessos").select("edificio_id").eq("user_id", user!.id);
      if (error) throw error;
      const ids = (ac ?? []).map((a: any) => a.edificio_id);
      if (!ids.length) return [];
      const { data: eds, error: e2 } = await db.from("loc_edificios").select("id,nome").in("id", ids).order("nome");
      if (e2) throw e2;
      return eds as { id: string; nome: string }[];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data.length) return (
    <div className="space-y-2">
      <PageHeader title="Área do Cliente" />
      <p className="text-sm text-muted-foreground">Seu acesso ainda não foi liberado. Fale com a equipe Somma.</p>
    </div>
  );
  const atual = sel ?? data[0].id;
  return (
    <div className="space-y-4">
      {data.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {data.map((e) => <Button key={e.id} size="sm" variant={e.id === atual ? "default" : "outline"} onClick={() => setSel(e.id)}>{e.nome}</Button>)}
        </div>
      )}
      <PortalEdificio key={atual} edificioId={atual} modo="cliente" />
    </div>
  );
}
