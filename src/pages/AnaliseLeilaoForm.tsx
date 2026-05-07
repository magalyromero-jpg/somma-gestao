import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, RotateCcw, Trash2, FileText, ArrowRight, Upload, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_DADOS,
  FOCUS_DEFAULTS,
  DadosImovel,
  capRateNominal,
} from "@/lib/analiseLeilao/types";
import { getHistorico, salvarAnalise, setAtual, excluirAnalise, getAtual } from "@/lib/analiseLeilao/storage";

const fmtPct = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const NumField = ({
  label,
  value,
  onChange,
  hint,
  step = "any",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  step?: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <Input
      type="number"
      step={step}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const TextField = ({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs">
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export default function AnaliseLeilaoForm() {
  const nav = useNavigate();
  const [dados, setDados] = useState<DadosImovel>(() => getAtual() || DEFAULT_DADOS);
  const [openMacro, setOpenMacro] = useState(false);
  const [historico, setHistorico] = useState(() => getHistorico());
  const [erros, setErros] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [loadingFocus, setLoadingFocus] = useState(false);

  const set = <K extends keyof DadosImovel>(k: K, v: DadosImovel[K]) =>
    setDados((d) => ({ ...d, [k]: v }));

  const cap = useMemo(() => capRateNominal(dados), [dados]);
  const investSugerido = useMemo(() => dados.lanceMinimoMil * 1.075, [dados.lanceMinimoMil]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (dados.lanceMinimoMil > 0 && dados.aluguelMensalInicial > 0 && cap < 5)
      w.push("Cap rate abaixo de 5% — verifique os valores");
    if (dados.valorMercadoMaxMil > 0 && dados.lanceMinimoMil > dados.valorMercadoMaxMil)
      w.push("Lance acima do valor de mercado estimado");
    if (
      dados.investimentoTotalMil > 0 &&
      dados.investimentoTotalMil < dados.lanceMinimoMil
    )
      w.push("Investimento total menor que o lance — verifique custos adicionais");
    return w;
  }, [dados, cap]);

  const validar = () => {
    const e: Record<string, string> = {};
    if (!dados.nome.trim()) e.nome = "Obrigatório";
    if (!dados.endereco.trim()) e.endereco = "Obrigatório";
    if (!dados.areaConst || dados.areaConst <= 0) e.areaConst = "Obrigatório";
    if (!dados.lanceMinimoMil || dados.lanceMinimoMil <= 0) e.lanceMinimoMil = "Obrigatório";
    if (!dados.aluguelMensalInicial || dados.aluguelMensalInicial <= 0)
      e.aluguelMensalInicial = "Obrigatório";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const gerar = () => {
    if (!validar()) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    salvarAnalise(dados);
    setHistorico(getHistorico());
    nav("/analise-leilao/resultado");
  };

  const buscarFocus = async () => {
    setLoadingFocus(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("fetch-focus", { body: {} });
      if (error) throw error;
      if (resp?.error) throw new Error(resp.error);
      const f = resp.data;
      setDados((d) => ({
        ...d,
        cdiAtual: Number(f.cdiAtual) || d.cdiAtual,
        cdiProjeto2026: Number(f.cdiProjeto2026) || d.cdiProjeto2026,
        cdiProjeto2027: Number(f.cdiProjeto2027) || d.cdiProjeto2027,
        cdiProjeto2028plus: Number(f.cdiProjeto2028plus) || d.cdiProjeto2028plus,
        ipcaProjeto2026: Number(f.ipcaProjeto2026) || d.ipcaProjeto2026,
        ipcaProjeto2027: Number(f.ipcaProjeto2027) || d.ipcaProjeto2027,
        ipcaProjeto2028plus: Number(f.ipcaProjeto2028plus) || d.ipcaProjeto2028plus,
      }));
      toast.success("Premissas Focus atualizadas");
    } catch (err) {
      console.error(err);
      setDados((d) => ({ ...d, ...FOCUS_DEFAULTS }));
      toast.error("Não foi possível buscar o Focus — usando padrões");
    } finally {
      setLoadingFocus(false);
    }
  };

  // Buscar Focus ao montar
  useEffect(() => {
    buscarFocus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrir = (id: number) => {
    const item = historico.find((h) => h.id === id);
    if (!item) return;
    setAtual(item.dados);
    nav("/analise-leilao/resultado");
  };

  const excluir = (id: number) => {
    if (!confirm("Excluir esta análise?")) return;
    excluirAnalise(id);
    setHistorico(getHistorico());
  };

  const extrairDoPDF = async (file: File) => {
    setUploading(true);
    setNomeArquivo(file.name);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1]);
        r.onerror = () => rej(new Error("Falha ao ler arquivo"));
        r.readAsDataURL(file);
      });

      const { data: resp, error } = await supabase.functions.invoke("extract-edital", {
        body: { pdfBase64: base64 },
      });
      if (error) throw error;
      if (resp?.error) throw new Error(resp.error);
      const extraido = resp.data;

      const dadosExtraidos: DadosImovel = {
        ...dados,
        nome: extraido.nome || "",
        endereco: extraido.endereco || "",
        leilao: extraido.leilao || "",
        tipo: extraido.tipo || "",
        matricula: extraido.matricula || "",
        locatario: extraido.locatario || "",
        prazoLocacaoMeses: Number(extraido.prazoLocacaoMeses) || 0,
        aluguelMensalInicial: Number(extraido.aluguelMensalInicial) || 0,
        lanceMinimoMil: (Number(extraido.lanceMinimoMil) || 0) / 1000,
        // Campos físicos: sempre null — usuário preenche após upload do IPTU
        areaConst: 0,
        areaLote: 0,
        testada: 0,
        estrutura: "Alvenaria",
        estadoConservacao: "Bom",
        // Campos de mercado: sempre zerados — usuário pesquisa e preenche
        valorVenalMil: 0,
        valorMercadoMinMil: 0,
        valorMercadoMaxMil: 0,
        investimentoTotalMil: ((Number(extraido.lanceMinimoMil) || 0) / 1000) * 1.075,
      };

      setDados(dadosExtraidos);
      setAtual(dadosExtraidos);
      salvarAnalise(dadosExtraidos);
      setHistorico(getHistorico());

      toast.success("Dados do edital extraídos! Complete os campos físicos e de mercado para gerar a análise.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível extrair os dados. Verifique o PDF e tente novamente.");
      setNomeArquivo(null);
    } finally {
      setUploading(false);
    }
  };

  // Persist working state
  useEffect(() => {
    setAtual(dados);
  }, [dados]);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-1">
          <div className="flex items-center gap-2 text-slate-900">
            <FileText className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Análise de Investimento Imobiliário</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Suba o edital em PDF ou preencha os dados manualmente
          </p>
        </header>

        {/* Upload PDF */}
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-primary transition-colors">
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-slate-900">Lendo o edital...</p>
              {nomeArquivo && (
                <p className="text-xs text-slate-500">{nomeArquivo}</p>
              )}
              <p className="text-xs text-slate-400">
                Extraindo dados e gerando análise automaticamente
              </p>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-900 mb-1">
                Suba o PDF do edital de leilão
              </p>
              <p className="text-xs text-slate-500 mb-5">
                O Claude vai extrair os dados e gerar a análise automaticamente
              </p>
              <label className="cursor-pointer inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                <Upload size={15} /> Selecionar PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) extrairDoPDF(file);
                  }}
                />
              </label>
              <p className="text-xs text-slate-400 mt-5">
                — ou preencha o formulário abaixo manualmente —
              </p>
            </>
          )}
        </div>

        {/* Formulário manual */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <Tabs defaultValue="imovel">
            <TabsList className="grid grid-cols-2 w-full max-w-md">
              <TabsTrigger value="imovel">Dados do imóvel</TabsTrigger>
              <TabsTrigger value="financeiro">Dados financeiros</TabsTrigger>
            </TabsList>

            <TabsContent value="imovel" className="mt-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <TextField
                    label="Nome / identificação do lote"
                    value={dados.nome}
                    onChange={(v) => set("nome", v)}
                    required
                  />
                  {erros.nome && <p className="text-xs text-destructive mt-1">{erros.nome}</p>}
                </div>
                <div>
                  <TextField
                    label="Endereço completo"
                    value={dados.endereco}
                    onChange={(v) => set("endereco", v)}
                    required
                  />
                  {erros.endereco && (
                    <p className="text-xs text-destructive mt-1">{erros.endereco}</p>
                  )}
                </div>
                <TextField
                  label="Tipo do imóvel"
                  value={dados.tipo}
                  onChange={(v) => set("tipo", v)}
                />
                <div>
                  <NumField
                    label="Área construída (m²) *"
                    value={dados.areaConst}
                    onChange={(v) => set("areaConst", v)}
                  />
                  {erros.areaConst && (
                    <p className="text-xs text-destructive mt-1">{erros.areaConst}</p>
                  )}
                </div>
                <NumField
                  label="Área do lote (m²)"
                  value={dados.areaLote}
                  onChange={(v) => set("areaLote", v)}
                />
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado de conservação</Label>
                  <Select value={dados.estadoConservacao} onValueChange={(v) => set("estadoConservacao", v as DadosImovel["estadoConservacao"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Ótimo", "Bom", "Regular", "Ruim"].map((e) => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <TextField
                  label="Matrícula CRI"
                  value={dados.matricula}
                  onChange={(v) => set("matricula", v)}
                />
              </div>
            </TabsContent>

            <TabsContent value="financeiro" className="mt-6 space-y-4">
              <p className="text-xs text-muted-foreground">
                Lance mínimo, investimento total e cap rate são extraídos automaticamente do edital em PDF e exibidos na tela de resultado.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <NumField
                    label="Aluguel mensal inicial (R$) *"
                    value={dados.aluguelMensalInicial}
                    onChange={(v) => set("aluguelMensalInicial", v)}
                  />
                  {erros.aluguelMensalInicial && (
                    <p className="text-xs text-destructive mt-1">{erros.aluguelMensalInicial}</p>
                  )}
                </div>
                <NumField
                  label="Prazo de locação (meses)"
                  value={dados.prazoLocacaoMeses}
                  onChange={(v) => set("prazoLocacaoMeses", v)}
                />
                <NumField
                  label="Valor venal prefeitura (R$) — opcional"
                  value={dados.valorVenalMil * 1000}
                  onChange={(v) => set("valorVenalMil", v / 1000)}
                />
                <NumField
                  label="Valor de mercado mín (R$) — opcional"
                  value={dados.valorMercadoMinMil * 1000}
                  onChange={(v) => set("valorMercadoMinMil", v / 1000)}
                />
                <NumField
                  label="Valor de mercado máx (R$) — opcional"
                  value={dados.valorMercadoMaxMil * 1000}
                  onChange={(v) => set("valorMercadoMaxMil", v / 1000)}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Macro */}
          <div className="mt-6 border-t pt-4">
            <button
              type="button"
              onClick={() => setOpenMacro((o) => !o)}
              className="flex items-center gap-2 text-sm font-medium text-slate-900"
            >
              {openMacro ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              Premissas macroeconômicas (Boletim Focus)
            </button>
            {openMacro && (
              <div className="mt-4 space-y-4">
                {loadingFocus ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando Boletim Focus...
                  </div>
                ) : (
                  <div className="grid md:grid-cols-4 gap-4">
                    <NumField label="CDI atual (%)" value={dados.cdiAtual} onChange={(v) => set("cdiAtual", v)} />
                    <NumField label="CDI 2026 (%)" value={dados.cdiProjeto2026} onChange={(v) => set("cdiProjeto2026", v)} />
                    <NumField label="CDI 2027 (%)" value={dados.cdiProjeto2027} onChange={(v) => set("cdiProjeto2027", v)} />
                    <NumField label="CDI 2028+ (%)" value={dados.cdiProjeto2028plus} onChange={(v) => set("cdiProjeto2028plus", v)} />
                    <NumField label="IPCA 2026 (%)" value={dados.ipcaProjeto2026} onChange={(v) => set("ipcaProjeto2026", v)} />
                    <NumField label="IPCA 2027 (%)" value={dados.ipcaProjeto2027} onChange={(v) => set("ipcaProjeto2027", v)} />
                    <NumField label="IPCA 2028+ (%)" value={dados.ipcaProjeto2028plus} onChange={(v) => set("ipcaProjeto2028plus", v)} />
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={buscarFocus} disabled={loadingFocus}>
                  <RotateCcw size={14} className="mr-1" /> Restaurar padrões Focus
                </Button>
              </div>
            )}
          </div>

          {warnings.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-1">
              {warnings.map((w) => (
                <p key={w} className="text-xs text-amber-800">⚠ {w}</p>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button size="lg" onClick={gerar}>
              Gerar Análise <ArrowRight size={16} className="ml-1" />
            </Button>
          </div>
        </div>

        {/* Histórico */}
        {historico.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Análises anteriores</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {historico.map((h) => (
                <div key={h.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="font-medium text-slate-900 truncate">{h.nome}</p>
                  <p className="text-xs text-muted-foreground">{h.criadoEm}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Lance</p>
                      <p className="font-semibold">{fmtBRL(h.lanceMinimoMil * 1000)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cap rate</p>
                      <p className="font-semibold">{fmtPct(h.capRate)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="default" onClick={() => abrir(h.id)} className="flex-1">
                      Abrir análise
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => excluir(h.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
