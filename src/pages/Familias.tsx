import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, MoreVertical, Trash2, Building2, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/LoadingState";

interface FamiliaRow {
  id: string;
  nome: string;
  sede: string | null;
  patrimonio_data: any;
  updated_at: string;
}

const CORES = ["#CC8B15", "#185FA5", "#2D7A4F", "#8B2D5F", "#5F2D8B", "#A55A1B"];
const corPara = (id: string) => CORES[id.charCodeAt(0) % CORES.length];

export default function Familias() {
  const [familias, setFamilias] = useState<FamiliaRow[]>([]);
  const [imoveisCount, setImoveisCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<FamiliaRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: fams }, { data: ims }] = await Promise.all([
        supabase
          .from("familias_onboarding")
          .select("id, nome, sede, patrimonio_data, updated_at")
          .order("updated_at", { ascending: false }),
        supabase.from("imoveis_cliente").select("familia_id"),
      ]);
      setFamilias((fams ?? []) as FamiliaRow[]);
      const counts: Record<string, number> = {};
      (ims ?? []).forEach((i: any) => {
        counts[i.familia_id] = (counts[i.familia_id] ?? 0) + 1;
      });
      setImoveisCount(counts);
      setLoading(false);
    })();
  }, []);

  async function excluirFamilia(id: string) {
    setDeleting(true);
    try {
      const { data: imoveis } = await supabase
        .from("imoveis_cliente")
        .select("id")
        .eq("familia_id", id);
      const imovelIds = (imoveis ?? []).map((i) => i.id);

      if (imovelIds.length > 0) {
        await supabase.from("checklist_imovel").delete().in("imovel_id", imovelIds);
      }
      await supabase.from("checklist_imovel").delete().eq("familia_id", id);
      await supabase.from("checklist_holding").delete().eq("familia_id", id);
      await supabase.from("checklist_outros_bens").delete().eq("familia_id", id);
      await supabase.from("imoveis_cliente").delete().eq("familia_id", id);
      await supabase.from("familia_documentos").delete().eq("familia_id", id);
      await supabase.from("familia_diligencia_itens").delete().eq("familia_id", id);
      const { error } = await supabase.from("familias_onboarding").delete().eq("id", id);
      if (error) throw error;

      setFamilias((prev) => prev.filter((o) => o.id !== id));
      toast.success("Família excluída");
    } catch (e: any) {
      toast.error("Erro ao excluir", { description: e?.message });
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  }

  const cards = useMemo(
    () =>
      familias.map((f) => {
        const concluido = !!f.patrimonio_data;
        const sede = f.patrimonio_data?.familia?.sede ?? f.sede ?? null;
        const holdings = f.patrimonio_data?.holdings?.length ?? 0;
        const imoveis = imoveisCount[f.id] ?? f.patrimonio_data?.imoveis?.length ?? 0;
        return { f, concluido, sede, holdings, imoveis };
      }),
    [familias, imoveisCount],
  );

  return (
    <>
      <PageHeader title="Famílias" subtitle="Portfólios sob gestão Somma MFO" />

      {loading && <LoadingSkeleton rows={6} />}

      {!loading && familias.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhuma família cadastrada. Inicie um onboarding para começar.
        </Card>
      )}

      {!loading && familias.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cards.map(({ f, concluido, sede, holdings, imoveis }) => {
            const cor = corPara(f.id);
            const href = concluido ? `/familias-onboarding/${f.id}` : `/onboarding/${f.id}`;
            return (
              <div key={f.id} className="relative group">
                <Link to={href}>
                  <Card className="shadow-card hover:shadow-elevated transition-all border-border/70 group-hover:border-gold/60 h-full">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4 mb-5 pr-8">
                        <div
                          className="h-12 w-12 rounded-full grid place-items-center text-white font-semibold shrink-0"
                          style={{ backgroundColor: cor }}
                        >
                          {f.nome.split(" ").pop()?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground truncate">{f.nome}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {sede ?? "Sede não informada"}
                          </div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-gold transition-colors" />
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider",
                            concluido
                              ? "bg-success/10 text-success border-success/30"
                              : "bg-warning/10 text-warning border-warning/30",
                          )}
                        >
                          {concluido ? "Concluído" : "Em progresso"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          atualizado {new Date(f.updated_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-base font-semibold leading-none">{imoveis}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">Imóveis</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-base font-semibold leading-none">{holdings}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">Holdings</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                <div className="absolute top-3 right-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        onClick={(e) => e.preventDefault()}
                        aria-label="Ações"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={(e) => {
                          e.preventDefault();
                          setToDelete(f);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {toDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Esta ação não pode ser desfeita. Todos os imóveis, checklists e
              documentos vinculados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) excluirFamilia(toDelete.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
