import { useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, FileText, Plus, RefreshCw, ExternalLink, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { Imovel, PatrimonialData } from "@/lib/onboarding/types";
import { GestaoImovelSection } from "./GestaoImovelSection";

interface ChecklistRow {
  id: string;
  item_key: string;
  item_label: string;
  status: string;
  imovel_ref: string | null;
  is_locacao: boolean;
}

interface DocRow {
  id: string;
  nome_arquivo: string;
  recebido_em: string;
  imovel_ref: string | null;
  analise: any;
  storage_path: string | null;
}

interface ComentarioRow {
  id: string;
  texto: string;
  autor_nome: string | null;
  created_at: string;
}

const TIPO_OPERACAO_OPTIONS = [
  { value: "para_renda", label: "Para renda" },
  { value: "para_venda", label: "Para venda" },
  { value: "valorizacao", label: "Valorização" },
  { value: "uso_familiar", label: "Uso familiar" },
];

export function DiligenciaImovelCard({
  imovel,
  familiaId,
  familiaNome,
  patrimonioData,
  prioritario,
  checklist,
  docs,
  dbImovel,
  onChecklistChange,
  onDocsChange,
  onDbImovelChange,
}: {
  imovel: Imovel;
  familiaId: string;
  familiaNome: string;
  patrimonioData: PatrimonialData | null;
  prioritario: boolean;
  checklist: ChecklistRow[];
  docs: DocRow[];
  dbImovel: any | null;
  onChecklistChange: () => Promise<void>;
  onDocsChange: () => Promise<void>;
  onDbImovelChange: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("checklist");
  const [comentarios, setComentarios] = useState<ComentarioRow[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [savingComentario, setSavingComentario] = useState(false);
  const [tipoOperacao, setTipoOperacao] = useState<string>(dbImovel?.tipo_operacao ?? "");

  useEffect(() => {
    setTipoOperacao(dbImovel?.tipo_operacao ?? "");
  }, [dbImovel?.id, dbImovel?.tipo_operacao]);

  const checklistImovel = useMemo(
    () => checklist.filter((c) => c.imovel_ref === imovel.id),
    [checklist, imovel.id],
  );
  const docsImovel = useMemo(
    () => docs.filter((d) => d.imovel_ref === imovel.id),
    [docs, imovel.id],
  );

  const total = checklistImovel.length;
  const recebidos = checklistImovel.filter((c) => c.status === "recebido").length;
  const pct = total ? Math.round((recebidos / total) * 100) : 0;

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("imovel_comentarios")
        .select("*")
        .eq("familia_id", familiaId)
        .eq("imovel_ref", imovel.id)
        .order("created_at", { ascending: false });
      setComentarios((data ?? []) as ComentarioRow[]);
    })();
  }, [open, familiaId, imovel.id]);

  async function adicionarComentario() {
    if (novoComentario.trim().length < 2) return;
    setSavingComentario(true);
    const { error } = await supabase.from("imovel_comentarios").insert({
      familia_id: familiaId,
      imovel_ref: imovel.id,
      texto: novoComentario.trim(),
      autor_id: user?.id,
      autor_nome: user?.email ?? null,
    });
    setSavingComentario(false);
    if (error) {
      toast.error("Erro ao salvar comentário", { description: error.message });
      return;
    }
    setNovoComentario("");
    const { data } = await supabase
      .from("imovel_comentarios")
      .select("*")
      .eq("familia_id", familiaId)
      .eq("imovel_ref", imovel.id)
      .order("created_at", { ascending: false });
    setComentarios((data ?? []) as ComentarioRow[]);
    toast.success("Comentário salvo");
  }

  async function salvarTipoOperacao(novo: string) {
    setTipoOperacao(novo);
    if (!dbImovel?.id) {
      toast.error("Imóvel ainda não cadastrado no banco");
      return;
    }
    const { error } = await supabase
      .from("imoveis_cliente")
      .update({ tipo_operacao: novo })
      .eq("id", dbImovel.id);
    if (error) {
      toast.error("Erro ao salvar tipo de operação", { description: error.message });
      return;
    }
    await onDbImovelChange();
  }

  // Proprietário
  const proprietario = useMemo(() => {
    if (imovel.titularidade === "PJ") {
      const h = patrimonioData?.holdings?.find((x) => x.id === imovel.holding_id);
      return h ? `PJ — ${h.razao_social}` : "PJ";
    }
    const m = patrimonioData?.membros?.find((x) => x.id === imovel.titular_id);
    return m ? `PF — ${m.nome}` : "PF";
  }, [imovel, patrimonioData]);

  const tipoBadge = imovel.titularidade === "PJ"
    ? <Badge variant="outline" className="bg-orange-500/15 text-orange-700 border-orange-500/30">PJ</Badge>
    : <Badge variant="outline" className="bg-blue-500/15 text-blue-700 border-blue-500/30">PF</Badge>;

  const endereco = [imovel.logradouro, imovel.numero, imovel.bairro, imovel.municipio, imovel.uf].filter(Boolean).join(", ") || "—";

  return (
    <Card>
      <CardContent className="p-0">
        {/* Header sempre visível */}
        <div className="p-5 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold">🏠 {imovel.descricao}</h4>
                {prioritario && (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                    Prioritário
                  </Badge>
                )}
                {tipoBadge}
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">{endereco}</div>
              {imovel.matricula && (
                <div className="text-xs text-muted-foreground">Matrícula {imovel.matricula}</div>
              )}
              <div className="text-xs text-muted-foreground">Proprietário: {proprietario}</div>
              <div className="flex items-center gap-3 mt-3">
                <Progress value={pct} className="h-1.5 flex-1 max-w-[240px]" />
                <span className="text-xs text-muted-foreground">{recebidos}/{total} documentos</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-semibold">
                {imovel.valor_declarado != null ? formatBRL(imovel.valor_declarado) : "—"}
              </div>
              <Button size="sm" variant="ghost" className="mt-1" onClick={() => setOpen((o) => !o)}>
                <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                {open ? "Recolher" : "Expandir"}
              </Button>
            </div>
          </div>
        </div>

        {open && (
          <div className="px-5 pb-5 pt-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                <TabsTrigger value="documentos">Documentos ({docsImovel.length})</TabsTrigger>
                <TabsTrigger value="gestao">Gestão</TabsTrigger>
                <TabsTrigger value="comentarios">Comentários ({comentarios.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="checklist" className="mt-4 space-y-2">
                {checklistImovel.length === 0 && (
                  <div className="text-sm text-muted-foreground py-3">Nenhum item de checklist para este imóvel.</div>
                )}
                {checklistImovel.map((it) => (
                  <ChecklistItemRow
                    key={it.id}
                    item={it}
                    familiaId={familiaId}
                    familiaNome={familiaNome}
                    patrimonioData={patrimonioData}
                    imovelRef={imovel.id}
                    onChange={async () => {
                      await onChecklistChange();
                      await onDocsChange();
                    }}
                  />
                ))}
              </TabsContent>

              <TabsContent value="documentos" className="mt-4 space-y-2">
                {docsImovel.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-3">Nenhum documento recebido para este imóvel.</div>
                ) : (
                  docsImovel.map((d) => <DocItem key={d.id} doc={d} familiaId={familiaId} familiaNome={familiaNome} patrimonioData={patrimonioData} onChange={onDocsChange} />)
                )}
              </TabsContent>

              <TabsContent value="gestao" className="mt-4">
                <GestaoImovelSection
                  dbImovel={dbImovel}
                  tipoOperacao={tipoOperacao}
                  imovelIR={imovel}
                  familiaId={familiaId}
                  onTipoOperacaoChange={salvarTipoOperacao}
                  onSaved={onDbImovelChange}
                />
              </TabsContent>

              <TabsContent value="comentarios" className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Textarea
                    placeholder="Anotações sobre o imóvel, pendências, contatos realizados, decisões tomadas..."
                    value={novoComentario}
                    onChange={(e) => setNovoComentario(e.target.value)}
                    rows={3}
                  />
                  <Button size="sm" onClick={adicionarComentario} disabled={savingComentario || novoComentario.trim().length < 2}>
                    <MessageSquare className="h-4 w-4 mr-1" /> Adicionar comentário
                  </Button>
                </div>
                {comentarios.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-3">Nenhum comentário ainda.</div>
                ) : (
                  <div className="space-y-2">
                    {comentarios.map((c) => (
                      <div key={c.id} className="p-3 border rounded-md bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                          <span className="font-medium">{c.autor_nome ?? "—"}</span>
                          <span>·</span>
                          <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{c.texto}</div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChecklistItemRow({
  item,
  familiaId,
  familiaNome,
  patrimonioData,
  imovelRef,
  onChange,
}: {
  item: ChecklistRow;
  familiaId: string;
  familiaNome: string;
  patrimonioData: PatrimonialData | null;
  imovelRef: string;
  onChange: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  async function setStatus(novo: string) {
    await supabase.from("familia_diligencia_itens").update({ status: novo }).eq("id", item.id);
    await onChange();
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    noClick: true,
    onDrop: async (accepted) => {
      if (!accepted.length) return;
      await uploadArquivo(accepted[0]);
    },
  });

  async function uploadArquivo(f: File) {
    setUploading(true);
    try {
      const base64 = await fileToBase64(f);
      let analise: any = null;
      try {
        const { data } = await supabase.functions.invoke("extract-patrimonial", {
          body: {
            familyName: familiaNome,
            files: [{ name: f.name, mimeType: f.type || "application/pdf", base64 }],
            existingData: patrimonioData ?? null,
          },
        });
        analise = data?.data ?? null;
      } catch {/* segue sem análise */}

      await supabase.from("familia_documentos").insert({
        familia_id: familiaId,
        nome_arquivo: f.name,
        tipo: f.type,
        storage_path: "",
        categoria: item.item_key,
        imovel_ref: imovelRef,
        analise,
        created_by: user?.id ?? "",
      });
      await supabase.from("familia_diligencia_itens").update({ status: "recebido" }).eq("id", item.id);
      toast.success(`${item.item_label} anexado ✓`);
      await onChange();
    } catch (e: any) {
      toast.error("Erro ao anexar", { description: e?.message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex items-center gap-3 p-2.5 border rounded-md text-sm transition-colors",
        isDragActive && "border-primary bg-primary/5",
        uploading && "opacity-60 pointer-events-none",
      )}
    >
      <input {...getInputProps()} />
      <Checkbox
        checked={item.status === "recebido"}
        onCheckedChange={() => setStatus(item.status === "recebido" ? "pendente" : "recebido")}
      />
      <span className={cn("flex-1", item.status === "recebido" && "line-through text-muted-foreground")}>
        {item.item_label}
      </span>
      {item.is_locacao && <Badge variant="outline" className="text-[10px]">locação</Badge>}
      <select
        className="h-7 text-xs rounded border border-input bg-background px-1"
        value={item.status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="pendente">pendente</option>
        <option value="recebido">recebido</option>
        <option value="nao_aplicavel">não aplicável</option>
      </select>
      <label className="cursor-pointer">
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadArquivo(f);
          }}
        />
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-muted">
          {uploading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          {uploading ? "Enviando..." : "Anexar"}
        </span>
      </label>
    </div>
  );
}

function DocItem({
  doc,
  familiaId: _familiaId,
  familiaNome,
  patrimonioData,
  onChange,
}: {
  doc: DocRow;
  familiaId: string;
  familiaNome: string;
  patrimonioData: PatrimonialData | null;
  onChange: () => Promise<void>;
}) {
  const [reprocessing, setReprocessing] = useState(false);

  async function reprocessar() {
    setReprocessing(true);
    try {
      const { data } = await supabase.functions.invoke("extract-patrimonial", {
        body: {
          familyName: familiaNome,
          files: [],
          existingData: patrimonioData ?? null,
          reprocess: doc.nome_arquivo,
        },
      });
      await supabase
        .from("familia_documentos")
        .update({ analise: data?.data ?? null })
        .eq("id", doc.id);
      toast.success("Análise atualizada");
      await onChange();
    } catch (e: any) {
      toast.error("Erro ao reprocessar", { description: e?.message });
    } finally {
      setReprocessing(false);
    }
  }

  const resumoAnalise = resumirAnalise(doc.analise);

  return (
    <div className="p-3 border rounded-md space-y-2">
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{doc.nome_arquivo}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(doc.recebido_em).toLocaleDateString("pt-BR")}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={reprocessar} disabled={reprocessing} title="Reprocessar">
            <RefreshCw className={cn("h-3.5 w-3.5", reprocessing && "animate-spin")} />
          </Button>
          {doc.storage_path && (
            <Button size="sm" variant="ghost" asChild title="Ver arquivo">
              <a href={doc.storage_path} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
      </div>
      {resumoAnalise && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2 border-l-2 border-primary/40">
          {resumoAnalise}
        </div>
      )}
    </div>
  );
}

function resumirAnalise(analise: any): string | null {
  if (!analise || typeof analise !== "object") return null;
  const partes: string[] = [];
  const imv = analise?.imoveis?.[0];
  if (imv) {
    if (imv.matricula) partes.push(`Matrícula ${imv.matricula}`);
    if (imv.area_m2) partes.push(`Área: ${imv.area_m2}m²`);
    if (imv.proprietario_anterior) partes.push(`Anterior: ${imv.proprietario_anterior}`);
    if (imv.valor_declarado) partes.push(`Valor: ${formatBRL(imv.valor_declarado)}`);
  }
  if (partes.length === 0 && analise?.meta?.confianca) {
    partes.push(`Confiança: ${analise.meta.confianca}`);
  }
  return partes.length ? partes.join(" · ") : null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
