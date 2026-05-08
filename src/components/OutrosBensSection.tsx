import { useEffect, useState } from "react";
import { Car, TrendingUp, Bitcoin, Globe, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CHECKLIST_VEICULO } from "@/lib/onboarding/checklistOutrosBens";
import type { PatrimonialData } from "@/lib/onboarding/types";
import { formatBRL } from "@/lib/format";
import { ChecklistItemRow } from "@/components/HoldingsChecklist";
import { toast } from "sonner";

interface ChecklistOutrosBensRow {
  id: string;
  familia_id: string;
  bem_tipo: string;
  bem_ref_id: string | null;
  bem_descricao: string | null;
  item_id: string;
  label: string;
  opcional: boolean;
  status: string;
  documento_id: string | null;
  data_recebimento: string | null;
}

export function OutrosBensSection({
  familiaId,
  data,
  userId,
}: {
  familiaId: string;
  data: PatrimonialData | null;
  userId: string;
}) {
  const [rows, setRows] = useState<ChecklistOutrosBensRow[]>([]);
  const veiculos = (data?.veiculos ?? []).filter((v: any) => !v?.alienado);
  const investimentos = data?.investimentos;
  const exterior = (data as any)?.bens_exterior as
    | Array<{ descricao: string; pais?: string | null; valor?: number | null }>
    | undefined;
  const cripto = (data as any)?.criptoativos as
    | Array<{ nome: string; valor?: number | null; recuperacao_judicial?: boolean }>
    | undefined;

  async function reload() {
    const { data: r } = await supabase
      .from("checklist_outros_bens")
      .select("*")
      .eq("familia_id", familiaId);
    setRows((r ?? []) as ChecklistOutrosBensRow[]);
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: existing } = await supabase
        .from("checklist_outros_bens")
        .select("*")
        .eq("familia_id", familiaId);
      if (cancel) return;
      const exist = (existing ?? []) as ChecklistOutrosBensRow[];

      const toInsert: any[] = [];
      for (const v of veiculos) {
        const refId = (v as any).id ?? `${(v as any).descricao}-${(v as any).placa ?? ""}`;
        for (const item of CHECKLIST_VEICULO) {
          const has = exist.some(
            (r) => r.bem_ref_id === refId && r.item_id === item.item_id,
          );
          if (!has) {
            toInsert.push({
              familia_id: familiaId,
              bem_tipo: "veiculo",
              bem_ref_id: refId,
              bem_descricao: (v as any).descricao,
              item_id: item.item_id,
              label: item.label,
              opcional: item.opcional,
              status: "pendente",
            });
          }
        }
      }
      if (toInsert.length) {
        await supabase.from("checklist_outros_bens").upsert(toInsert, {
          onConflict: "familia_id,bem_ref_id,item_id",
          ignoreDuplicates: true,
        });
        const { data: refreshed } = await supabase
          .from("checklist_outros_bens")
          .select("*")
          .eq("familia_id", familiaId);
        if (!cancel) setRows((refreshed ?? []) as ChecklistOutrosBensRow[]);
      } else if (!cancel) {
        setRows(exist);
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familiaId, JSON.stringify(veiculos.map((v: any) => v.id ?? v.descricao))]);

  async function toggle(row: ChecklistOutrosBensRow) {
    const novo = row.status === "recebido" ? "pendente" : "recebido";
    const updates = {
      status: novo,
      data_recebimento: novo === "recebido" ? new Date().toISOString() : null,
    };
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updates } : r)));
    const { error } = await supabase
      .from("checklist_outros_bens")
      .update(updates)
      .eq("id", row.id);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else
      await supabase.from("audit_log").insert({
        familia_id: familiaId,
        entidade: "checklist_outros_bens",
        entidade_id: row.id,
        acao: "status_change",
        antes: { status: row.status },
        depois: updates,
        autor_id: userId,
      });
  }

  async function anexar(row: ChecklistOutrosBensRow, file: File) {
    const docInsert = await supabase
      .from("familia_documentos")
      .insert({
        familia_id: familiaId,
        nome_arquivo: file.name,
        tipo: file.type,
        storage_path: `outros/${row.bem_ref_id}/${row.item_id}-${file.name}`,
        categoria: `${row.bem_tipo}:${row.bem_ref_id}:${row.item_id}`,
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
      .from("checklist_outros_bens")
      .update(updates)
      .eq("id", row.id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    await supabase.from("audit_log").insert({
      familia_id: familiaId,
      entidade: "checklist_outros_bens",
      entidade_id: row.id,
      acao: "anexo",
      depois: { documento_id: docInsert.data.id, nome_arquivo: file.name },
      autor_id: userId,
    });
    toast.success(`${file.name} anexado`);
    await reload();
  }

  const investTotal =
    (investimentos?.total ?? null) ??
    [
      investimentos?.renda_fixa,
      investimentos?.previdencia_privada,
      investimentos?.fundos,
      investimentos?.exterior,
      investimentos?.criptoativos,
      investimentos?.outros,
    ].reduce<number | null>((acc, v) => {
      if (v == null) return acc;
      return (acc ?? 0) + Number(v);
    }, null);

  const hasNada =
    veiculos.length === 0 &&
    !investTotal &&
    !cripto?.length &&
    !exterior?.length;

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Outros Bens
      </h3>

      {hasNada && (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            Nenhum outro bem identificado ainda.
          </CardContent>
        </Card>
      )}

      {veiculos.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Veículos ({veiculos.length})</span>
            </div>
            <div className="space-y-3">
              {veiculos.map((v: any, idx: number) => {
                const refId = v.id ?? `${v.descricao}-${v.placa ?? ""}`;
                const items = rows.filter((r) => r.bem_ref_id === refId);
                const recebidos = items.filter((r) => r.status === "recebido").length;
                const total = items.length || CHECKLIST_VEICULO.length;
                const pct = total ? Math.round((recebidos / total) * 100) : 0;
                return (
                  <div key={`${refId}-${idx}`} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <div className="font-medium text-sm">
                          🚗 {v.descricao}
                          {v.placa && (
                            <span className="text-muted-foreground"> — Placa {v.placa}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {v.ano && <>Ano {v.ano}</>}
                          {v.titular_id && (
                            <>
                              {v.ano ? " · " : ""}
                              Titular: {v.titular_id}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm">
                          {v.valor_declarado != null ? formatBRL(v.valor_declarado) : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {recebidos}/{total} documentos
                        </div>
                      </div>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <div className="space-y-1.5">
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
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(investTotal != null || investimentos) && (
        <Card className="mb-4">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Investimentos</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Stat label="Renda fixa" value={investimentos?.renda_fixa} />
              <Stat label="Previdência" value={investimentos?.previdencia_privada} />
              <Stat label="Fundos" value={investimentos?.fundos} />
              <Stat label="Exterior" value={investimentos?.exterior} />
              <Stat label="Outros" value={investimentos?.outros} />
              <Stat label="Total" value={investTotal} bold />
            </div>
          </CardContent>
        </Card>
      )}

      {cripto && cripto.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Bitcoin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Criptoativos ({cripto.length})</span>
            </div>
            <div className="space-y-1.5">
              {cripto.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 border rounded-md text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span>{c.nome}</span>
                    {c.recuperacao_judicial && (
                      <Badge
                        variant="outline"
                        className="bg-red-500/10 text-red-700 border-red-500/30"
                      >
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Recuperação judicial
                      </Badge>
                    )}
                  </div>
                  <span className="font-medium">
                    {c.valor != null ? formatBRL(c.valor) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {exterior && exterior.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Bens no Exterior ({exterior.length})</span>
            </div>
            <div className="space-y-1.5">
              {exterior.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 border rounded-md text-sm"
                >
                  <div>
                    <div>{b.descricao}</div>
                    {b.pais && <div className="text-xs text-muted-foreground">{b.pais}</div>}
                  </div>
                  <span className="font-medium">
                    {b.valor != null ? formatBRL(b.valor) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const Stat = ({
  label,
  value,
  bold,
}: {
  label: string;
  value: number | null | undefined;
  bold?: boolean;
}) => (
  <div>
    <div className="text-xs uppercase text-muted-foreground tracking-wider">{label}</div>
    <div className={bold ? "font-semibold" : ""}>{value != null ? formatBRL(value) : "—"}</div>
  </div>
);
