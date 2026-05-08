import { useEffect, useState } from "react";
import { Building2, FileText, Paperclip, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CHECKLIST_HOLDING } from "@/lib/onboarding/checklistHolding";
import type { Holding } from "@/lib/onboarding/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChecklistHoldingRow {
  id: string;
  holding_id: string;
  familia_id: string;
  item_id: string;
  label: string;
  opcional: boolean;
  status: string;
  documento_id: string | null;
  data_recebimento: string | null;
  notas: string | null;
}

export function HoldingsChecklist({
  familiaId,
  holdings,
  userId,
}: {
  familiaId: string;
  holdings: Holding[];
  userId: string;
}) {
  const [rows, setRows] = useState<ChecklistHoldingRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const { data } = await supabase
      .from("checklist_holding")
      .select("*")
      .eq("familia_id", familiaId);
    setRows((data ?? []) as ChecklistHoldingRow[]);
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("checklist_holding")
        .select("*")
        .eq("familia_id", familiaId);
      if (cancel) return;
      const existing = (data ?? []) as ChecklistHoldingRow[];

      // Seed missing items for each non-encerrada holding
      const toInsert: any[] = [];
      for (const h of holdings) {
        if (String((h as any).tipo) === "encerrada") continue;
        for (const item of CHECKLIST_HOLDING) {
          const has = existing.some(
            (r) => r.holding_id === h.id && r.item_id === item.item_id,
          );
          if (!has) {
            toInsert.push({
              holding_id: h.id,
              familia_id: familiaId,
              item_id: item.item_id,
              label: item.label,
              opcional: item.opcional,
              status: "pendente",
            });
          }
        }
      }
      if (toInsert.length) {
        await supabase.from("checklist_holding").upsert(toInsert, {
          onConflict: "holding_id,familia_id,item_id",
          ignoreDuplicates: true,
        });
        const { data: refreshed } = await supabase
          .from("checklist_holding")
          .select("*")
          .eq("familia_id", familiaId);
        if (!cancel) setRows((refreshed ?? []) as ChecklistHoldingRow[]);
      } else if (!cancel) {
        setRows(existing);
      }
      if (!cancel) setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [familiaId, holdings]);

  async function toggle(row: ChecklistHoldingRow) {
    const novo = row.status === "recebido" ? "pendente" : "recebido";
    const antes = { status: row.status, data_recebimento: row.data_recebimento };
    const depois = { status: novo, data_recebimento: novo === "recebido" ? new Date().toISOString() : null };
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...depois } : r)));
    const { error } = await supabase
      .from("checklist_holding")
      .update(depois)
      .eq("id", row.id);
    if (error) {
      toast.error("Erro ao atualizar", { description: error.message });
      return;
    }
    await supabase.from("audit_log").insert({
      familia_id: familiaId,
      entidade: "checklist_holding",
      entidade_id: row.id,
      acao: "status_change",
      antes,
      depois,
      autor_id: userId,
    });
  }

  async function anexar(row: ChecklistHoldingRow, file: File) {
    const docInsert = await supabase
      .from("familia_documentos")
      .insert({
        familia_id: familiaId,
        nome_arquivo: file.name,
        tipo: file.type,
        storage_path: `holdings/${row.holding_id}/${row.item_id}-${file.name}`,
        categoria: `holding:${row.holding_id}:${row.item_id}`,
        created_by: userId,
      })
      .select("id")
      .single();
    if (docInsert.error) {
      toast.error("Erro ao anexar", { description: docInsert.error.message });
      return;
    }
    const updates = {
      documento_id: docInsert.data.id,
      status: "recebido",
      data_recebimento: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("checklist_holding")
      .update(updates)
      .eq("id", row.id);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    await supabase.from("audit_log").insert({
      familia_id: familiaId,
      entidade: "checklist_holding",
      entidade_id: row.id,
      acao: "anexo",
      depois: { documento_id: docInsert.data.id, nome_arquivo: file.name },
      autor_id: userId,
    });
    toast.success(`${file.name} anexado`);
    await reload();
  }

  if (holdings.length === 0) {
    return <div className="text-sm text-muted-foreground">Nenhuma holding identificada.</div>;
  }

  return (
    <Accordion type="multiple" className="space-y-2">
      {holdings.map((h) => {
        const isEncerrada = String((h as any).tipo) === "encerrada";

        if (isEncerrada) {
          return (
            <div
              key={h.id}
              className="border rounded-md px-4 py-3 flex items-center gap-3 flex-wrap"
            >
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{h.razao_social}</span>
              {h.cnpj && (
                <span className="text-xs text-muted-foreground">CNPJ {h.cnpj}</span>
              )}
              <Badge variant="secondary" className="ml-auto">Encerrada</Badge>
            </div>
          );
        }

        const items = rows.filter((r) => r.holding_id === h.id);
        const recebidos = items.filter((r) => r.status === "recebido").length;
        const total = items.length || CHECKLIST_HOLDING.length;
        const pct = total ? Math.round((recebidos / total) * 100) : 0;
        return (
          <AccordionItem key={h.id} value={h.id} className="border rounded-md px-4">
            <AccordionTrigger>
              <div className="flex items-center gap-3 flex-wrap text-left flex-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{h.razao_social}</span>
                {h.cnpj && <span className="text-xs text-muted-foreground">CNPJ {h.cnpj}</span>}
                <Badge variant="outline">{h.tipo}</Badge>
                <span className="ml-auto mr-3 text-xs text-muted-foreground">
                  {recebidos}/{total} documentos
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <Progress value={pct} className="h-1.5" />
              <div className="space-y-2">
                {loading && items.length === 0 && (
                  <div className="text-xs text-muted-foreground">Carregando checklist…</div>
                )}
                {!loading && items.length === 0 &&
                  CHECKLIST_HOLDING.map((item) => (
                    <ChecklistItemRow
                      key={item.item_id}
                      label={item.label}
                      opcional={item.opcional}
                      status="pendente"
                      onToggle={() => {}}
                      onFile={() => {
                        toast.error("Checklist ainda inicializando, tente novamente em instantes.");
                      }}
                    />
                  ))}
                {items.map((row) => (
                  <ChecklistItemRow
                    key={row.id}
                    label={row.label}
                    opcional={row.opcional}
                    status={row.status}
                    onToggle={() => toggle(row)}
                    onFile={(f) => anexar(row, f)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export function ChecklistItemRow({
  label,
  opcional,
  status,
  onToggle,
  onFile,
}: {
  label: string;
  opcional: boolean;
  status: string;
  onToggle: () => void;
  onFile: (f: File) => void;
}) {
  const recebido = status === "recebido";
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-md border text-sm",
        recebido ? "bg-emerald-500/5 border-emerald-500/30" : "bg-background",
      )}
    >
      <Checkbox checked={recebido} onCheckedChange={onToggle} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("truncate", recebido && "text-muted-foreground line-through")}>
            {label}
          </span>
          {opcional && (
            <Badge variant="outline" className="text-[10px]">
              opcional
            </Badge>
          )}
        </div>
      </div>
      {recebido && <Check className="h-4 w-4 text-emerald-600" />}
      <label className="cursor-pointer">
        <input
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.currentTarget.value = "";
          }}
        />
        <Button type="button" size="sm" variant="outline" asChild>
          <span>
            <Paperclip className="h-3.5 w-3.5 mr-1" /> Anexar
          </span>
        </Button>
      </label>
    </div>
  );
}

export { FileText };
