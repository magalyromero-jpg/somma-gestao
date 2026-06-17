import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Upload, FileText, Check, X, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LOADING_STEPS, emailDaFamilia, type PatrimonialData } from "@/lib/onboarding/types";
import { criarChecklistsImoveis } from "@/lib/onboarding/checklistImovel";

type Step = 1 | 2 | 3;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      resolve(result.split(",")[1]);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}


export default function OnboardingFamilia() {
  const navigate = useNavigate();
  const { familiaId: familiaIdParam } = useParams<{ familiaId: string }>();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [nome, setNome] = useState("");
  const [familiaId, setFamiliaId] = useState<string | null>(familiaIdParam ?? null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [resultado, setResultado] = useState<PatrimonialData | null>(null);
  const [hydrating, setHydrating] = useState<boolean>(!!familiaIdParam);


  // Hidrata estado a partir do Supabase quando vier com :familiaId na URL
  useEffect(() => {
    if (!familiaIdParam) return;
    (async () => {
      const { data, error } = await supabase
        .from("familias_onboarding")
        .select("id, nome, patrimonio_data")
        .eq("id", familiaIdParam)
        .maybeSingle();
      if (error || !data) {
        toast.error("Onboarding não encontrado");
        navigate("/onboarding", { replace: true });
        return;
      }
      setFamiliaId(data.id);
      setNome(data.nome);
      if (data.patrimonio_data) {
        setResultado(data.patrimonio_data as unknown as PatrimonialData);
        setStep(3);
      } else {
        setStep(2);
      }
      setHydrating(false);
    })();
  }, [familiaIdParam, navigate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
    onDrop: async (accepted) => {
      if (!accepted.length || !familiaId || !user) return;
      setFiles((prev) => [...prev, ...accepted]);
      setUploadingCount((c) => c + accepted.length);
      for (const f of accepted) {
        try {
          const path = `${familiaId}/onboarding/${Date.now()}-${f.name}`;
          const { error: upErr } = await supabase.storage
            .from("familia-documentos")
            .upload(path, f, { upsert: false });
          if (upErr) throw upErr;
          const { error: insErr } = await supabase.from("familia_documentos").insert({
            familia_id: familiaId,
            nome_arquivo: f.name,
            tipo: f.type,
            storage_path: path,
            categoria: "onboarding",
            created_by: user.id,
          });
          if (insErr) throw insErr;
        } catch (e: any) {
          toast.error(`Falha ao salvar ${f.name}`, { description: e?.message });
        } finally {
          setUploadingCount((c) => Math.max(0, c - 1));
        }
      }
    },
  });

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  // Cria a família já no Passo 1 → sobrevive a F5
  async function continuarPasso1() {
    if (!user) return;
    if (familiaId) {
      setStep(2);
      return;
    }
    const { data, error } = await supabase
      .from("familias_onboarding")
      .insert({
        nome: nome.trim(),
        email_familia: emailDaFamilia(nome),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) {
      toast.error("Erro ao criar família", { description: error.message });
      return;
    }
    setFamiliaId(data.id);
    navigate(`/onboarding/novo/${data.id}`, { replace: true });
    setStep(2);
  }

  async function pularParaMapa() {
    if (!familiaId) return;
    navigate(`/familias-onboarding/${familiaId}`);
  }

  async function analisar() {
    if (!user || !familiaId) return;
    if (files.length === 0) {
      toast.error("Adicione ao menos um documento");
      return;
    }
    setStep(3);
    setLoading(true);
    setLoadingStepIdx(0);
    const interval = setInterval(() => {
      setLoadingStepIdx((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 1500);

    try {
      const filesPayload = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          mimeType: f.type || "application/pdf",
          base64: await fileToBase64(f),
        })),
      );

      const { data, error } = await supabase.functions.invoke("extract-patrimonial", {
        body: { familyName: nome.trim(), files: filesPayload },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const patrimonio = data.data as PatrimonialData;
      setResultado(patrimonio);

      // Atualiza a MESMA família já criada no Passo 1
      const { error: updErr } = await supabase
        .from("familias_onboarding")
        .update({
          sede: patrimonio.familia?.sede ?? null,
          perfil: patrimonio.familia?.perfil ?? null,
          fonte: patrimonio.familia?.fonte ?? null,
          patrimonio_data: patrimonio as any,
          confianca: patrimonio.meta?.confianca ?? null,
        })
        .eq("id", familiaId);
      if (updErr) throw updErr;

      // documentos já foram inseridos no Storage + tabela durante o upload (Passo 2)

      if (Array.isArray(patrimonio.imoveis) && patrimonio.imoveis.length > 0) {
        try {
          await criarChecklistsImoveis(familiaId, patrimonio.imoveis);
        } catch (err) {
          console.error("Falha ao criar checklists de imóveis", err);
        }
      }

      toast.success("Mapa patrimonial extraído!");
    } catch (e: any) {
      toast.error("Falha na análise", { description: e?.message ?? String(e) });
      setStep(2);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  if (hydrating) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <>
      <PageHeader
        title="Onboarding de cliente"
        subtitle="Extração automática do mapa patrimonial a partir dos documentos"
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={cn(
                "h-8 w-8 rounded-full grid place-items-center text-xs font-semibold border",
                step >= n
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border",
              )}
            >
              {n}
            </div>
            {n < 3 && <div className={cn("w-12 h-px", step > n ? "bg-primary" : "bg-border")} />}
          </div>
        ))}
        <div className="ml-4 text-sm text-muted-foreground">
          {step === 1 && "Nome da família"}
          {step === 2 && "Upload de documentos"}
          {step === 3 && "Análise automática"}
        </div>
      </div>

      {step === 1 && (
        <Card className="max-w-xl">
          <CardContent className="p-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da família</Label>
              <Input
                id="nome"
                autoFocus
                placeholder="Ex: Família Tavares"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Esse será o identificador principal. Tudo mais será extraído dos documentos.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={continuarPasso1} disabled={nome.trim().length < 2}>
                Continuar <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="max-w-2xl">
          <CardContent className="p-8 space-y-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Família</div>
              <div className="font-semibold">{nome}</div>
            </div>

            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
              <p className="text-sm font-medium">Arraste PDFs ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">
                IR, ficha cadastral, contratos sociais, matrículas, fichas bancárias
              </p>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 rounded-md border bg-muted/40 text-sm"
                  >
                    <Check className="h-4 w-4 text-success" />
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(f.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button variant="ghost" onClick={pularParaMapa}>
                Pular por agora — adicionar depois
              </Button>
              <Button onClick={analisar} disabled={files.length === 0 || uploadingCount > 0}>
                <Sparkles />{" "}
                {uploadingCount > 0 ? `Salvando ${uploadingCount}…` : "Analisar documentos"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="max-w-2xl">
          <CardContent className="p-10 text-center space-y-6">
            {loading ? (
              <>
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" strokeWidth={1.5} />
                <div className="space-y-3">
                  <Progress value={((loadingStepIdx + 1) / LOADING_STEPS.length) * 100} />
                  <p className="text-sm font-medium">{LOADING_STEPS[loadingStepIdx]}</p>
                  <p className="text-xs text-muted-foreground">
                    Pode levar de 30 a 90 segundos dependendo do tamanho dos PDFs
                  </p>
                </div>
              </>
            ) : resultado ? (
              <div className="text-left space-y-5">
                <div className="text-center">
                  <div className="h-12 w-12 rounded-full bg-success/15 grid place-items-center mx-auto mb-3">
                    <Check className="h-6 w-6 text-success" />
                  </div>
                  <h3 className="text-xl font-semibold">Mapa patrimonial pronto</h3>
                  <p className="text-sm text-muted-foreground">
                    Confiança: <span className="font-medium">{resultado.meta?.confianca ?? "—"}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <ResumoBox label="Membros" value={resultado.membros?.length ?? 0} />
                  <ResumoBox label="Holdings" value={resultado.holdings?.length ?? 0} />
                  <ResumoBox label="Imóveis" value={resultado.imoveis?.length ?? 0} />
                  <ResumoBox label="Alertas" value={resultado.alertas_gerais?.length ?? 0} />
                </div>

                <Button
                  className="w-full"
                  onClick={() => navigate(`/familias-onboarding/${familiaId}`)}
                >
                  Abrir mapa da família <ArrowRight />
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </>
  );
}

const ResumoBox = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-md border p-4 text-center">
    <div className="text-2xl font-semibold">{value}</div>
    <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
  </div>
);
