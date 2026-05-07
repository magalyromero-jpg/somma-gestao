import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  Mail,
  AlertCircle,
  Check,
  FileText,
  Plus,
  Trash2,
  ChevronDown,
  Upload,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSkeleton, ErrorState } from "@/components/LoadingState";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import type { PatrimonialData, Papel, Imovel, Membro, Holding } from "@/lib/onboarding/types";
import {
  CHECKLIST_FAMILIA,
  CHECKLIST_IMOVEL,
  CHECKLIST_IMOVEL_LOCACAO,
} from "@/lib/onboarding/checklist";
import { detectarDocumento, PROCESSING_STEPS } from "@/lib/onboarding/detectDocumento";
import { useAuth } from "@/contexts/AuthContext";

const PAPEL_LABEL: Record<Papel, string> = {
  titular: "Titular",
  conjuge: "Cônjuge",
  filho: "Filho(a)",
  dependente: "Dependente",
  socio_familiar: "Sócio familiar",
  socio_externo: "Sócio externo",
};

const PAPEL_CLASS: Record<Papel, string> = {
  titular: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  conjuge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  filho: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  dependente: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  socio_familiar: "bg-neutral-500/15 text-neutral-700 border-neutral-500/30",
  socio_externo: "bg-neutral-700/15 text-neutral-800 border-neutral-700/30",
};

interface ChecklistRow {
  id: string;
  categoria: string;
  item_key: string;
  item_label: string;
  status: string;
  imovel_ref: string | null;
  is_locacao: boolean;
}

interface DocumentoRow {
  id: string;
  nome_arquivo: string;
  tipo: string | null;
  recebido_em: string;
}

export default function MapaFamilia() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [familia, setFamilia] = useState<any>(null);
  const [data, setData] = useState<PatrimonialData | null>(null);
  const [docs, setDocs] = useState<DocumentoRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const [{ data: fam, error: e1 }, { data: ds }, { data: ck }] = await Promise.all([
          supabase.from("familias_onboarding").select("*").eq("id", id).single(),
          supabase
            .from("familia_documentos")
            .select("id, nome_arquivo, tipo, recebido_em")
            .eq("familia_id", id)
            .order("recebido_em", { ascending: false }),
          supabase.from("familia_diligencia_itens").select("*").eq("familia_id", id),
        ]);
        if (e1) throw e1;
        setFamilia(fam);
        setData((fam.patrimonio_data ?? null) as unknown as PatrimonialData | null);
        setDocs((ds ?? []) as DocumentoRow[]);
        setChecklist((ck ?? []) as ChecklistRow[]);

        // Inicializar checklist se vazio
        if ((ck ?? []).length === 0) {
          await semearChecklist(id, (fam.patrimonio_data ?? null) as unknown as PatrimonialData | null);
          const { data: refreshed } = await supabase
            .from("familia_diligencia_itens")
            .select("*")
            .eq("familia_id", id);
          setChecklist((refreshed ?? []) as ChecklistRow[]);
        }
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function semearChecklist(familiaId: string, p: PatrimonialData | null) {
    const rows: any[] = [];
    let ordem = 0;
    for (const cat of CHECKLIST_FAMILIA) {
      for (const it of cat.itens) {
        rows.push({
          familia_id: familiaId,
          categoria: cat.titulo,
          item_key: it.key,
          item_label: it.label,
          status: "pendente",
          ordem: ordem++,
        });
      }
    }
    // Imóveis identificados pela IA
    for (const imv of p?.imoveis ?? []) {
      const ref = imv.id;
      const checklistImovel = imv.titularidade === "PJ"
        ? CHECKLIST_IMOVEL
        : CHECKLIST_IMOVEL.filter((i) => i.key !== "balanco_pj");
      for (const it of checklistImovel) {
        rows.push({
          familia_id: familiaId,
          categoria: `Imóvel: ${imv.descricao}`,
          item_key: it.key,
          item_label: it.label,
          status: "pendente",
          imovel_ref: ref,
          ordem: ordem++,
        });
      }
      if (imv.locacao) {
        for (const it of CHECKLIST_IMOVEL_LOCACAO) {
          rows.push({
            familia_id: familiaId,
            categoria: `Imóvel: ${imv.descricao}`,
            item_key: it.key,
            item_label: it.label,
            status: "pendente",
            imovel_ref: ref,
            is_locacao: true,
            ordem: ordem++,
          });
        }
      }
    }
    if (rows.length) {
      await supabase.from("familia_diligencia_itens").insert(rows);
    }
  }

  async function toggleChecklist(row: ChecklistRow) {
    const novo = row.status === "recebido" ? "pendente" : "recebido";
    setChecklist((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: novo } : r)));
    const { error } = await supabase
      .from("familia_diligencia_itens")
      .update({ status: novo })
      .eq("id", row.id);
    if (error) toast.error("Erro ao salvar", { description: error.message });
  }

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorState error={new Error(error)} />;
  if (!familia) return <div>Família não encontrada.</div>;

  const sede = data?.familia?.sede ?? familia.sede ?? "—";
  const fonte = data?.familia?.fonte ?? familia.fonte ?? "Onboarding iniciado";

  const totalImoveis = data?.imoveis?.length ?? 0;
  const totalHoldings = data?.holdings?.length ?? 0;
  const patrimonio =
    data?.patrimonio_liquido?.bens_ano_atual ??
    data?.patrimonio_liquido?.bens_ano_anterior ??
    null;
  const dividendos = data?.rendimentos?.isentos_dividendos ?? null;

  return (
    <>
      <PageHeader
        title={familia.nome}
        subtitle={`${sede} · ${fonte}`}
        actions={
          <Button variant="outline" onClick={() => toast("Relatório em breve")}>
            Relatório <ArrowUpRight />
          </Button>
        }
      />

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiBox label="Patrimônio declarado" value={patrimonio != null ? formatBRL(patrimonio, { compact: true }) : "—"} />
        <KpiBox label="Imóveis identificados" value={String(totalImoveis)} />
        <KpiBox label="Holdings ativas" value={String(totalHoldings)} />
        <KpiBox label="Dividendos isentos" value={dividendos != null ? formatBRL(dividendos, { compact: true }) : "—"} />
      </div>

      {!data && (
        <Card className="mb-6 border-warning/40 bg-warning/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              Nenhum documento processado ainda. Use a aba <strong>Documentos</strong> para enviar PDFs e gerar a análise automática.
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="familia">
        <TabsList>
          <TabsTrigger value="familia">Família</TabsTrigger>
          <TabsTrigger value="holdings">Holdings & Imóveis</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="diligencia">Diligência</TabsTrigger>
        </TabsList>

        <TabsContent value="familia" className="space-y-6 mt-4">
          <FamiliaTab membros={data?.membros ?? []} />
        </TabsContent>

        <TabsContent value="holdings" className="mt-4">
          <HoldingsTab data={data} />
        </TabsContent>

        <TabsContent value="documentos" className="mt-4 space-y-6">
          <DocumentosTab
            familia={familia}
            docs={docs}
            checklist={checklist}
            onToggle={toggleChecklist}
            onReload={async () => {
              const { data: refreshed } = await supabase
                .from("familia_diligencia_itens")
                .select("*")
                .eq("familia_id", familia.id);
              setChecklist((refreshed ?? []) as ChecklistRow[]);
            }}
            userId={user?.id ?? ""}
          />
        </TabsContent>

        <TabsContent value="diligencia" className="mt-4">
          <DiligenciaTab data={data} checklist={checklist} />
        </TabsContent>
      </Tabs>
    </>
  );
}

const KpiBox = ({ label, value }: { label: string; value: string }) => (
  <Card>
    <CardContent className="p-5">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </CardContent>
  </Card>
);

/* ===== Família Tab ===== */
function FamiliaTab({ membros }: { membros: Membro[] }) {
  const titulares = membros.filter((m) => m.papel === "titular");
  const familiares = membros.filter((m) => ["conjuge", "filho", "dependente", "socio_familiar"].includes(m.papel));
  const externos = membros.filter((m) => m.papel === "socio_externo");

  return (
    <>
      {titulares.length > 0 && (
        <Section titulo="Principal (assinante)">
          <div className="grid md:grid-cols-2 gap-4">
            {titulares.map((m) => <MembroCard key={m.id} m={m} destaque />)}
          </div>
        </Section>
      )}
      {familiares.length > 0 && (
        <Section titulo="Cônjuge / Dependentes">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {familiares.map((m) => <MembroCard key={m.id} m={m} />)}
          </div>
        </Section>
      )}
      {externos.length > 0 && (
        <Section titulo="Sócios externos identificados">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {externos.map((m) => <MembroCard key={m.id} m={m} />)}
          </div>
        </Section>
      )}
      {membros.length === 0 && <EmptyMsg msg="Nenhum membro identificado ainda." />}
    </>
  );
}

const Section = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">{titulo}</h3>
    {children}
  </div>
);

const MembroCard = ({ m, destaque }: { m: Membro; destaque?: boolean }) => (
  <Card className={cn(destaque && "border-primary/50")}>
    <CardContent className="p-4 flex gap-3">
      <div className="h-10 w-10 rounded-full bg-muted grid place-items-center font-semibold text-sm shrink-0">
        {m.nome.split(" ").map((p) => p[0]).slice(0, 2).join("")}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-medium truncate">{m.nome}</div>
          <Badge variant="outline" className={cn("text-[10px]", PAPEL_CLASS[m.papel])}>
            {PAPEL_LABEL[m.papel]}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {m.cpf && <span>CPF {m.cpf}</span>}
          {m.cpf && m.ocupacao && <span> · </span>}
          {m.ocupacao}
        </div>
      </div>
    </CardContent>
  </Card>
);

/* ===== Holdings Tab ===== */
function HoldingsTab({ data }: { data: PatrimonialData | null }) {
  if (!data) return <EmptyMsg msg="Sem dados de holdings ainda." />;
  const imoveisPF = data.imoveis.filter((i) => i.titularidade === "PF");
  const imoveisPorHolding = (hid: string) => data.imoveis.filter((i) => i.holding_id === hid);

  return (
    <div className="space-y-6">
      {data.holdings.length > 0 ? (
        <Accordion type="multiple" className="space-y-2">
          {data.holdings.map((h) => (
            <AccordionItem key={h.id} value={h.id} className="border rounded-md px-4">
              <AccordionTrigger>
                <div className="flex items-center gap-3 flex-wrap text-left">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{h.razao_social}</span>
                  {h.cnpj && <span className="text-xs text-muted-foreground">CNPJ {h.cnpj}</span>}
                  <Badge variant="outline">{h.tipo}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-2">Sócios</div>
                  <div className="space-y-1 text-sm">
                    {h.socios.map((s, i) => {
                      const m = data.membros.find((mm) => mm.id === s.membro_id);
                      return (
                        <div key={i} className="flex justify-between border-b last:border-0 py-1">
                          <span>{m?.nome ?? s.membro_id}</span>
                          <span className="font-medium">{s.percentual != null ? `${s.percentual}%` : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <ImoveisLista imoveis={imoveisPorHolding(h.id)} titulo="Imóveis integralizados" membros={data.membros} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <EmptyMsg msg="Nenhuma holding identificada." />
      )}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Imóveis ainda na PF</h3>
        <ImoveisLista imoveis={imoveisPF} membros={data.membros} />
      </div>
    </div>
  );
}

const ImoveisLista = ({
  imoveis,
  titulo,
  membros,
}: {
  imoveis: Imovel[];
  titulo?: string;
  membros: Membro[];
}) => {
  if (imoveis.length === 0) return <div className="text-sm text-muted-foreground">Nenhum imóvel.</div>;
  return (
    <div>
      {titulo && <div className="text-xs uppercase text-muted-foreground mb-2">{titulo}</div>}
      <div className="space-y-2">
        {imoveis.map((i) => {
          const titular = membros.find((m) => m.id === i.titular_id);
          return (
            <div key={i.id} className="border rounded-md p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium">{i.descricao}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {[i.logradouro, i.numero, i.bairro, i.municipio, i.uf].filter(Boolean).join(", ") || "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm">
                    {i.valor_declarado != null ? formatBRL(i.valor_declarado) : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">{i.area_m2 ? `${i.area_m2} m²` : ""}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2 text-[11px]">
                {i.matricula && <Badge variant="outline">Matrícula {i.matricula}</Badge>}
                {i.forma_aquisicao && <Badge variant="outline">{i.forma_aquisicao}</Badge>}
                {titular && <Badge variant="outline">{titular.nome}</Badge>}
                {i.alertas?.map((a, idx) => (
                  <Badge key={idx} className="bg-warning/15 text-warning border-warning/30" variant="outline">
                    {a}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ===== Documentos Tab ===== */
function DocumentosTab({
  familia,
  docs,
  checklist,
  onToggle,
  onReload,
  userId,
}: {
  familia: any;
  docs: DocumentoRow[];
  checklist: ChecklistRow[];
  onToggle: (r: ChecklistRow) => void;
  onReload: () => Promise<void>;
  userId: string;
}) {
  const [enriching, setEnriching] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [novoImovel, setNovoImovel] = useState("");
  const [novoLocacao, setNovoLocacao] = useState(false);

  const total = checklist.length;
  const recebidos = checklist.filter((c) => c.status === "recebido").length;
  const pct = total ? Math.round((recebidos / total) * 100) : 0;

  // Agrupar por categoria
  const grupos = useMemo(() => {
    const map = new Map<string, ChecklistRow[]>();
    for (const c of checklist) {
      if (!map.has(c.categoria)) map.set(c.categoria, []);
      map.get(c.categoria)!.push(c);
    }
    return Array.from(map.entries());
  }, [checklist]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
    onDrop: async (accepted) => {
      if (!accepted.length) return;
      setEnriching(true);
      try {
        const filesPayload = await Promise.all(
          accepted.map(async (f) => ({
            name: f.name,
            mimeType: f.type || "application/pdf",
            base64: await fileToBase64(f),
          })),
        );

        const { data, error } = await supabase.functions.invoke("extract-patrimonial", {
          body: {
            familyName: familia.nome,
            files: filesPayload,
            existingData: familia.patrimonio_data ?? null,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const { data: updated } = await supabase
          .from("familias_onboarding")
          .update({
            patrimonio_data: data.data,
            confianca: data.data?.meta?.confianca ?? null,
          })
          .eq("id", familia.id)
          .select()
          .single();

        await supabase.from("familia_documentos").insert(
          accepted.map((f) => ({
            familia_id: familia.id,
            nome_arquivo: f.name,
            tipo: f.type,
            storage_path: "",
            categoria: "enriquecimento",
            created_by: userId,
          })),
        );

        if (updated) {
          // Recarrega estado inline (sem F5)
          window.location.reload();
        }
        toast.success("Documentos processados");
      } catch (e: any) {
        toast.error("Erro ao processar", { description: e?.message });
      } finally {
        setEnriching(false);
      }
    },
  });

  async function adicionarImovel() {
    if (novoImovel.trim().length < 2) return;
    const categoria = `Imóvel: ${novoImovel.trim()}`;
    const ref = `manual-${Date.now()}`;
    const rows = [
      ...CHECKLIST_IMOVEL.map((it, idx) => ({
        familia_id: familia.id,
        categoria,
        item_key: it.key,
        item_label: it.label,
        status: "pendente",
        imovel_ref: ref,
        ordem: 1000 + idx,
      })),
      ...(novoLocacao
        ? CHECKLIST_IMOVEL_LOCACAO.map((it, idx) => ({
            familia_id: familia.id,
            categoria,
            item_key: it.key,
            item_label: it.label,
            status: "pendente",
            imovel_ref: ref,
            is_locacao: true,
            ordem: 2000 + idx,
          }))
        : []),
    ];
    const { error } = await supabase.from("familia_diligencia_itens").insert(rows);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNovoImovel("");
    setNovoLocacao(false);
    await onReload();
  }

  return (
    <>
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm font-semibold">{familia.nome}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {familia.email_familia}
              </div>
            </div>
            <div className="flex gap-3 text-xs">
              <Stat label="Recebidos" value={recebidos} color="success" />
              <Stat label="Pendentes" value={total - recebidos} color="warning" />
              <Stat label="Total" value={total} />
            </div>
          </div>
          <Progress value={pct} />
          <div className="text-xs text-muted-foreground">{pct}% do checklist completo</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold">Recebidos</h3>
          {docs.length === 0 ? (
            <EmptyMsg msg="Nenhum documento ainda." />
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-2 border rounded-md text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{d.nome_arquivo}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(d.recebido_em).toLocaleDateString("pt-BR")}
                  </span>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                    Recebido
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
              enriching && "opacity-60 pointer-events-none",
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm">
              {enriching ? "Processando novos documentos..." : "Adicionar mais documentos (enriquecimento)"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-semibold">Checklist padrão Somma</h3>
          <Accordion type="multiple" className="space-y-1">
            {grupos.map(([categoria, itens]) => {
              const rec = itens.filter((i) => i.status === "recebido").length;
              const tot = itens.length;
              const cor = rec === tot ? "success" : rec === 0 ? "neutral" : "warning";
              return (
                <AccordionItem key={categoria} value={categoria} className="border rounded-md px-3">
                  <AccordionTrigger>
                    <div className="flex items-center gap-3 flex-wrap text-left">
                      <span className="font-medium text-sm">{categoria}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          cor === "success" && "bg-success/10 text-success border-success/30",
                          cor === "warning" && "bg-warning/10 text-warning border-warning/30",
                          cor === "neutral" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {rec}/{tot}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <div className="space-y-1.5">
                      {itens.map((it) => (
                        <label key={it.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={it.status === "recebido"}
                            onCheckedChange={() => onToggle(it)}
                          />
                          <span className={cn(it.status === "recebido" && "line-through text-muted-foreground")}>
                            {it.item_label}
                          </span>
                          {it.is_locacao && (
                            <Badge variant="outline" className="text-[10px]">locação</Badge>
                          )}
                        </label>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          <div className="border-t pt-4 space-y-2">
            <Label className="text-xs">+ Adicionar imóvel manualmente</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Endereço ou identificação"
                value={novoImovel}
                onChange={(e) => setNovoImovel(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={novoLocacao} onCheckedChange={(v) => setNovoLocacao(!!v)} />
                Imóvel de locação?
              </label>
              <Button onClick={adicionarImovel} disabled={novoImovel.trim().length < 2}>
                <Plus /> Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

const Stat = ({ label, value, color }: { label: string; value: number; color?: "success" | "warning" }) => (
  <div className="text-center">
    <div
      className={cn(
        "text-lg font-semibold",
        color === "success" && "text-success",
        color === "warning" && "text-warning",
      )}
    >
      {value}
    </div>
    <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
  </div>
);

/* ===== Diligência Tab ===== */
function DiligenciaTab({ data, checklist }: { data: PatrimonialData | null; checklist: ChecklistRow[] }) {
  if (!data) return <EmptyMsg msg="Sem imóveis para diligência." />;
  const ordenados = [...data.imoveis].sort(
    (a, b) => (b.valor_declarado ?? 0) - (a.valor_declarado ?? 0),
  );

  const docsFaltantesPorImovel = (imovelId: string) =>
    checklist.filter((c) => c.imovel_ref === imovelId && c.status !== "recebido");

  return (
    <div className="space-y-3">
      {ordenados.map((i, idx) => {
        const faltantes = docsFaltantesPorImovel(i.id);
        const prioritario = idx < 3;
        return (
          <Card key={i.id}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold">{i.descricao}</h4>
                    <Badge
                      variant="outline"
                      className={
                        prioritario
                          ? "bg-destructive/10 text-destructive border-destructive/30"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {prioritario ? "Prioritário" : "Secundário"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {[i.logradouro, i.numero, i.bairro, i.municipio, i.uf].filter(Boolean).join(", ") || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {i.matricula && `Matrícula ${i.matricula}`}
                    {i.cartorio && ` · ${i.cartorio}`}
                    {i.forma_aquisicao && ` · ${i.forma_aquisicao}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {i.valor_declarado != null ? formatBRL(i.valor_declarado) : "—"}
                  </div>
                </div>
              </div>

              {faltantes.length > 0 && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1.5">Documentos faltantes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {faltantes.map((f) => (
                      <Badge
                        key={f.id}
                        variant="outline"
                        className="bg-warning/10 text-warning border-warning/30"
                      >
                        {f.item_label} ✗
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {i.alertas?.length > 0 && (
                <div className="border-t pt-3">
                  <div className="text-xs uppercase text-muted-foreground mb-1.5">Alertas</div>
                  <div className="space-y-1">
                    {i.alertas.map((a, ai) => (
                      <div key={ai} className="flex items-start gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      {ordenados.length === 0 && <EmptyMsg msg="Nenhum imóvel identificado." />}
    </div>
  );
}

const EmptyMsg = ({ msg }: { msg: string }) => (
  <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{msg}</CardContent></Card>
);

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
