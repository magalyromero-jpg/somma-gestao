import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Check, FileText, AlertTriangle, Play } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { calcularProgresso } from "@/lib/onboarding/checklistImovel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GestaoImovelSection, statusAtualBadgeClass, statusAtualLabel } from "@/components/diligencia/GestaoImovelSection";

interface ImovelDetalhe {
  id: string;
  familia_id: string;
  nome: string;
  endereco: string | null;
  valor_declarado: number | null;
  titularidade: string | null;
  holding_cnpj: string | null;
  matricula: string | null;
  alertas: any;
  ref_id: string | null;
}
interface ChecklistRow {
  id: string;
  item_id: string;
  label: string;
  opcional: boolean;
  status: string;
  documento_id: string | null;
  data_recebimento: string | null;
}
interface DocRow {
  id: string;
  nome_arquivo: string;
  recebido_em: string;
  storage_path: string;
}

export default function ImovelClienteDetalhe() {
  const { id } = useParams();
  const [imovel, setImovel] = useState<ImovelDetalhe | null>(null);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [familiaNome, setFamiliaNome] = useState<string | null>(null);
  const [patrimonioData, setPatrimonioData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);

  async function carregar() {
    if (!id) return;
    setLoading(true);
    const { data: im } = await supabase
      .from("imoveis_cliente")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!im) { setLoading(false); return; }
    setImovel(im as any);

    const [{ data: cl }, { data: fam }] = await Promise.all([
      supabase.from("checklist_imovel").select("*").eq("imovel_id", id).order("opcional"),
      supabase.from("familias_onboarding").select("nome, patrimonio_data").eq("id", im.familia_id).maybeSingle(),
    ]);
    const checklistRows = (cl ?? []) as any[];
    setChecklist(checklistRows as any);
    setFamiliaNome(fam?.nome ?? null);
    setPatrimonioData(fam?.patrimonio_data ?? null);

    // Documentos do imóvel: por imovel_ref OU por documento_id vinculado no checklist
    const docIds = checklistRows.map((c) => c.documento_id).filter(Boolean) as string[];
    const orParts = [`imovel_ref.eq.${id}`];
    if (docIds.length) orParts.push(`id.in.(${docIds.join(",")})`);
    const { data: docsImovel } = await supabase
      .from("familia_documentos")
      .select("id, nome_arquivo, recebido_em, storage_path")
      .eq("familia_id", im.familia_id)
      .or(orParts.join(","))
      .order("recebido_em", { ascending: false });
    // dedupe por id
    const map = new Map<string, DocRow>();
    (docsImovel ?? []).forEach((d: any) => map.set(d.id, d));
    setDocs(Array.from(map.values()));
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [id]);

  async function anexar(item: ChecklistRow, file: File) {
    if (!imovel) return;
    setUploadingItem(item.id);
    try {
      const path = `${imovel.familia_id}/${imovel.id}/${item.item_id}-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("familia-documentos").upload(path, file);
      if (upErr) throw upErr;
      const { data: doc, error: docErr } = await supabase
        .from("familia_documentos")
        .insert({
          familia_id: imovel.familia_id,
          nome_arquivo: file.name,
          storage_path: path,
          tipo: item.item_id,
          categoria: "imovel",
          imovel_ref: imovel.id,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        } as any)
        .select()
        .single();
      if (docErr) throw docErr;
      const { error: updErr } = await supabase
        .from("checklist_imovel")
        .update({ status: "recebido", documento_id: doc!.id, data_recebimento: new Date().toISOString() })
        .eq("id", item.id);
      if (updErr) throw updErr;
      toast.success("Documento anexado");
      carregar();
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setUploadingItem(null);
    }
  }

  async function marcarNA(item: ChecklistRow) {
    await supabase.from("checklist_imovel").update({ status: "nao_aplicavel" }).eq("id", item.id);
    carregar();
  }

  async function reabrir(item: ChecklistRow) {
    await supabase.from("checklist_imovel").update({ status: "pendente", documento_id: null, data_recebimento: null }).eq("id", item.id);
    carregar();
  }

  async function verDoc(storage_path: string) {
    const { data, error } = await supabase.storage.from("familia-documentos").createSignedUrl(storage_path, 60);
    if (error || !data) { toast.error("Não foi possível abrir o arquivo"); return; }
    window.open(data.signedUrl, "_blank");
  }

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>;
  if (!imovel) return <div className="text-sm text-muted-foreground py-8 text-center">Imóvel não encontrado.</div>;

  const prog = calcularProgresso(checklist as any);
  const recebidos = checklist.filter((c) => c.status === "recebido");
  const pendentes = checklist.filter((c) => c.status === "pendente");
  const naoApl = checklist.filter((c) => c.status === "nao_aplicavel");

  // imóvel correspondente no patrimonio_data
  const imovelData = patrimonioData?.imoveis?.find((i: any) => i.id === imovel.ref_id);

  return (
    <div className="space-y-4">
      <Link to="/imoveis" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar para imóveis
      </Link>

      {/* Resumo */}
      <Card className="p-6 shadow-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-light">{imovel.nome}</h2>
              <Badge variant="outline" className={imovel.titularidade === "PJ"
                ? "bg-orange-500/15 text-orange-700 border-orange-500/30"
                : "bg-blue-500/15 text-blue-700 border-blue-500/30"}>
                {imovel.titularidade ?? "PF"}
              </Badge>
              {(imovel as any).status_atual && (
                <Badge variant="outline" className={statusAtualBadgeClass((imovel as any).status_atual)}>
                  {statusAtualLabel((imovel as any).status_atual)}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{imovel.endereco}</p>
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              {imovelData?.area_m2 && <div>{imovelData.area_m2} m²</div>}
              {imovel.matricula && <div>Mat. {imovel.matricula}</div>}
              {imovelData?.cartorio && <div>{imovelData.cartorio}</div>}
              {imovelData?.data_aquisicao && <div>Adquirido em {imovelData.data_aquisicao}</div>}
              <div>
                {imovel.titularidade === "PJ" ? `PJ — ${imovel.holding_cnpj ?? ""}` : "PF"}
                {imovelData?.forma_aquisicao && ` · ${imovelData.forma_aquisicao}`}
              </div>
              <div>Família: {familiaNome ?? "—"}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extralight">{imovel.valor_declarado ? formatBRL(imovel.valor_declarado) : "—"}</div>
            <div className="text-xs text-muted-foreground mt-1">Checklist {prog.recebidos}/{prog.total} — {prog.pct}%</div>
          </div>
        </div>
        {Array.isArray(imovel.alertas) && imovel.alertas.length > 0 && (
          <div className="mt-4 space-y-1">
            {imovel.alertas.map((a: string, i: number) => (
              <div key={i} className="text-xs flex gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{a}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Checklist */}
      <Card className="p-6 shadow-card">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-4">Checklist de documentos</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <ChecklistCol titulo="Recebidos" cor="text-emerald-600">
            {recebidos.length === 0 && <Empty />}
            {recebidos.map((it) => (
              <ItemRow key={it.id}>
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm">{it.label}</div>
                    {it.data_recebimento && (
                      <div className="text-xs text-muted-foreground">recebido em {new Date(it.data_recebimento).toLocaleDateString("pt-BR")}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  {it.documento_id && (() => {
                    const d = docs.find((x) => x.id === it.documento_id);
                    return d ? (
                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => verDoc(d.storage_path)}>Ver</Button>
                    ) : null;
                  })()}
                  <Button size="sm" variant="ghost" onClick={() => reabrir(it)}>Reabrir</Button>
                </div>
              </ItemRow>
            ))}
          </ChecklistCol>

          <ChecklistCol titulo="Pendentes" cor="text-orange-600">
            {pendentes.length === 0 && <Empty />}
            {pendentes.map((it) => (
              <ItemRow key={it.id}>
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="h-4 w-4 rounded-full border border-orange-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm">{it.label}</div>
                    {it.opcional && <div className="text-xs text-muted-foreground">opcional</div>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <label className={cn("inline-flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer hover:bg-muted",
                    uploadingItem === it.id && "opacity-50 cursor-wait")}>
                    <Upload className="h-3 w-3" /> Anexar
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploadingItem === it.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) anexar(it, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => marcarNA(it)} className="text-xs h-7">N/A</Button>
                </div>
              </ItemRow>
            ))}
          </ChecklistCol>

          <ChecklistCol titulo="Não aplicável" cor="text-muted-foreground">
            {naoApl.length === 0 && <Empty />}
            {naoApl.map((it) => (
              <ItemRow key={it.id}>
                <div className="text-sm text-muted-foreground flex-1">{it.label}</div>
                <Button size="sm" variant="ghost" onClick={() => reabrir(it)}>Reabrir</Button>
              </ItemRow>
            ))}
          </ChecklistCol>
        </div>
      </Card>

      {/* Análise */}
      <Card className="p-6 shadow-card">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-4">Análise dos documentos</h3>
        {imovelData ? (
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
            <DataRow label="Valor declarado" value={imovelData.valor_declarado ? formatBRL(imovelData.valor_declarado) : "—"} />
            <DataRow label="Forma de aquisição" value={imovelData.forma_aquisicao ?? "—"} />
            <DataRow label="Titularidade" value={imovel.titularidade ?? "—"} />
            <DataRow label="Área" value={imovelData.area_m2 ? `${imovelData.area_m2} m²` : "—"} />
            <DataRow label="Matrícula" value={imovel.matricula ?? "—"} />
            <DataRow label="Cartório" value={imovelData.cartorio ?? "—"} />
            <DataRow label="Data de aquisição" value={imovelData.data_aquisicao ?? "—"} />
            <DataRow label="CEP" value={imovelData.cep ?? "—"} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem dados extraídos para este imóvel ainda.</p>
        )}

        <div className="space-y-2">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mt-2">Documentos do imóvel ({docs.length})</h4>
          {docs.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum documento anexado a este imóvel ainda.</p>
          )}
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-xs border rounded p-2">
              <button onClick={() => verDoc(d.storage_path)} className="flex items-center gap-2 min-w-0 hover:text-gold text-left">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{d.nome_arquivo}</span>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-muted-foreground">{new Date(d.recebido_em).toLocaleDateString("pt-BR")}</span>
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => verDoc(d.storage_path)}>Ver</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Gestão completa */}
      <Card className="p-6 shadow-card">
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-4">Gestão do imóvel</h3>
        <GestaoImovelSection
          dbImovel={imovel}
          tipoOperacao={(imovel as any)?.tipo_operacao ?? ""}
          imovelIR={imovelData}
          familiaId={imovel.familia_id}
          onTipoOperacaoChange={async (novo) => {
            const { error } = await supabase
              .from("imoveis_cliente")
              .update({ tipo_operacao: novo })
              .eq("id", imovel.id);
            if (error) {
              toast.error("Erro ao salvar", { description: error.message });
              return;
            }
            await carregar();
          }}
          onSaved={carregar}
        />
      </Card>
    </div>
  );
}

function ChecklistCol({ titulo, cor, children }: { titulo: string; cor: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className={cn("text-xs uppercase tracking-wider mb-2", cor)}>{titulo}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function ItemRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2 p-2 rounded border">{children}</div>;
}
function Empty() {
  return <div className="text-xs text-muted-foreground italic px-2">—</div>;
}
function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
