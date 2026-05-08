import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AuditRow {
  id: string;
  familia_id: string | null;
  autor_id: string | null;
  autor_nome: string | null;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  antes: any;
  depois: any;
  created_at: string;
}

const ACAO_LABEL: Record<string, string> = {
  status_change: "Marcação de checklist",
  anexo: "Upload de documento",
  upload: "Upload de documento",
  edicao: "Edição",
  comentario: "Comentário",
  criacao: "Criação",
  vinculo: "Vínculo de documento",
};

function descrever(r: AuditRow): string {
  if (r.acao === "anexo" || r.acao === "upload") {
    const nome = r.depois?.nome_arquivo ?? "documento";
    return `Adicionou "${nome}"${r.entidade ? ` em ${r.entidade}` : ""}`;
  }
  if (r.acao === "status_change") {
    const status = r.depois?.status ?? "—";
    return `Alterou status para "${status}"${r.entidade ? ` em ${r.entidade}` : ""}`;
  }
  if (r.acao === "vinculo") {
    return `Vinculou documento ${r.depois?.nome_arquivo ?? ""}`.trim();
  }
  return ACAO_LABEL[r.acao] ?? r.acao;
}

export function HistoricoAtividades() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [familias, setFamilias] = useState<{ id: string; nome: string }[]>([]);
  const [familiaFilter, setFamiliaFilter] = useState<string>("todas");
  const [periodo, setPeriodo] = useState<string>("30");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - Number(periodo));
      let q = supabase
        .from("audit_log")
        .select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);
      if (familiaFilter !== "todas") q = q.eq("familia_id", familiaFilter);
      const [{ data: ar }, { data: fs }] = await Promise.all([
        q,
        supabase.from("familias_onboarding").select("id, nome").order("nome"),
      ]);
      setRows((ar ?? []) as AuditRow[]);
      setFamilias((fs ?? []) as any);
      setLoading(false);
    })();
  }, [familiaFilter, periodo]);

  const familiaNome = useMemo(
    () => Object.fromEntries(familias.map((f) => [f.id, f.nome])),
    [familias],
  );

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={familiaFilter} onValueChange={setFamiliaFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todas as famílias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as famílias</SelectItem>
              {familias.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Carregando histórico…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma atividade registrada no período.
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.id} className="py-3 flex items-start gap-4 text-sm">
                <div className="text-xs text-muted-foreground whitespace-nowrap min-w-[120px]">
                  {new Date(r.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="font-medium min-w-[140px] truncate">
                  {r.autor_nome ?? "Sistema"}
                </div>
                <div className="flex-1">
                  <div>{descrever(r)}</div>
                  {r.familia_id && familiaNome[r.familia_id] && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Família {familiaNome[r.familia_id]}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                  {ACAO_LABEL[r.acao] ?? r.acao}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
