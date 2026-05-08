import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RefreshCw, TrendingUp, AlertCircle, Plus, FileCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type DbImovel = Record<string, any>;

interface Props {
  dbImovel: DbImovel | null;
  tipoOperacao: string;
  imovelIR?: any;
  familiaId?: string;
  onTipoOperacaoChange?: (novo: string) => Promise<void> | void;
  onSaved: () => Promise<void>;
}

const TIPO_OPERACAO_OPTIONS = [
  { value: "para_renda", label: "Para renda" },
  { value: "para_venda", label: "Para venda" },
  { value: "valorizacao", label: "Valorização" },
  { value: "uso_familiar", label: "Uso familiar" },
  { value: "desenvolvimento_renda", label: "Desenvolvimento p/ renda" },
  { value: "desenvolvimento_venda", label: "Desenvolvimento p/ venda" },
  { value: "loteamento", label: "Loteamento" },
];

export const STATUS_ATUAL_OPTIONS = [
  { value: "locado", label: "Locado" },
  { value: "disp_locacao", label: "Disponível para locação" },
  { value: "a_venda", label: "À venda" },
  { value: "em_obra", label: "Em obra" },
  { value: "uso_proprio", label: "Uso próprio" },
  { value: "vago", label: "Vago" },
];

export function statusAtualBadgeClass(v?: string | null) {
  switch (v) {
    case "locado": return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
    case "disp_locacao": return "bg-blue-500/15 text-blue-700 border-blue-500/30";
    case "a_venda": return "bg-purple-500/15 text-purple-700 border-purple-500/30";
    case "em_obra": return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    case "uso_proprio": return "bg-indigo-500/15 text-indigo-700 border-indigo-500/30";
    case "vago": return "bg-muted text-muted-foreground border-border";
    default: return "bg-muted text-muted-foreground border-border";
  }
}
export function statusAtualLabel(v?: string | null) {
  return STATUS_ATUAL_OPTIONS.find((o) => o.value === v)?.label ?? null;
}

function parseBrDate(s?: string | null): { iso: string | null; year: number | null } {
  if (!s) return { iso: null, year: null };
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return { iso: s.slice(0, 10), year: Number(s.slice(0, 4)) };
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return { iso: `${m[3]}-${m[2]}-${m[1]}`, year: Number(m[3]) };
  if (/^\d{4}$/.test(s)) return { iso: `${s}-01-01`, year: Number(s) };
  return { iso: null, year: null };
}

const INDICES = ["IPCA", "IGP-M", "INCC", "IPC-A"];

function diasAte(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const hoje = new Date();
  return Math.floor((d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function toBrDate(iso?: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const CAMPOS_SALVAR = [
  "status_atual",
  "mes_referencia_energia", "inscricao_municipal",
  "tipo_locacao", "contrato_inicio", "contrato_fim",
  "imobiliaria_nome", "imobiliaria_email", "imobiliaria_telefone",
  "valor_locacao_atual", "valor_locacao_inicial", "data_inicio_locacao",
  "indice_locacao", "periodicidade_reajuste", "data_proximo_reajuste",
  "plataforma_shortstay", "admin_shortstay_nome", "admin_shortstay_email",
  "admin_shortstay_telefone", "receita_media_mensal",
  "condominio_nome", "condominio_admin_nome", "condominio_admin_email",
  "condominio_admin_telefone", "taxa_condominio", "vencimento_condominio",
  "unidade_consumidora", "distribuidora", "distribuidora_energia", "hidrometro", "matricula_agua",
  "valor_aquisicao", "data_aquisicao", "indice_correcao",
  "taxa_administracao_pct", "valor_iptu_anual",
  // certidões (usando colunas existentes)
  "certidao_cnd_condominio_data", "certidao_cnd_condominio_validade",
  "certidao_cnd_iptu_data", "certidao_cnd_iptu_validade",
  "certidao_cnd_energia_data", "certidao_cnd_energia_validade",
  "certidao_onus_data", "certidao_onus_validade",
  "certidao_matricula_data", "certidao_matricula_validade",
];

export function GestaoImovelSection({
  dbImovel, tipoOperacao, imovelIR, familiaId, onTipoOperacaoChange, onSaved,
}: Props) {
  const [form, setForm] = useState<DbImovel>(dbImovel ?? {});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(dbImovel ?? {}); }, [dbImovel?.id, dbImovel?.updated_at]);

  if (!dbImovel) {
    return (
      <div className="text-sm text-muted-foreground py-4 flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Este imóvel ainda não está cadastrado no banco. Salve o onboarding para habilitar a aba Gestão.
      </div>
    );
  }

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function salvar() {
    setSaving(true);
    const patch: DbImovel = {};
    for (const c of CAMPOS_SALVAR) patch[c] = form[c] ?? null;
    const { error } = await supabase.from("imoveis_cliente").update(patch as any).eq("id", dbImovel.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar gestão", { description: error.message }); return; }
    toast.success("Gestão atualizada");
    await onSaved();
  }

  const showRenda = tipoOperacao === "para_renda";
  const showValorizacao = tipoOperacao === "valorizacao";
  const showUso = tipoOperacao === "uso_familiar";
  const showCondominio = true;
  const showLongStay = showRenda && form.tipo_locacao === "long_stay";
  const showShortStay = showRenda && form.tipo_locacao === "short_stay";

  return (
    <div className="space-y-6">
      {/* Tipo de operação + Status atual */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2 max-w-sm">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo de operação</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={tipoOperacao ?? ""}
              onChange={(e) => onTipoOperacaoChange?.(e.target.value)}
            >
              <option value="">Selecione…</option>
              {TIPO_OPERACAO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status atual</Label>
            <div className="flex flex-wrap gap-2">
              {STATUS_ATUAL_OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  size="sm"
                  variant={form.status_atual === o.value ? "default" : "outline"}
                  onClick={() => set("status_atual", o.value)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contrato de locação */}
      {showRenda && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="font-semibold text-sm">📄 Contrato de locação</h5>
              <ContratoStatusBadge fim={form.contrato_fim} />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Início" type="date" value={form.contrato_inicio} onChange={(v) => set("contrato_inicio", v)} />
              <Field label="Vencimento" type="date" value={form.contrato_fim} onChange={(v) => set("contrato_fim", v)} />
            </div>
            <div>
              <Label className="text-xs">Tipo de locação</Label>
              <div className="flex gap-2 mt-1">
                {[{ k: "long_stay", l: "Long Stay" }, { k: "short_stay", l: "Short Stay" }].map((t) => (
                  <Button key={t.k} type="button" size="sm"
                    variant={form.tipo_locacao === t.k ? "default" : "outline"}
                    onClick={() => set("tipo_locacao", t.k)}>{t.l}</Button>
                ))}
              </div>
            </div>

            {showLongStay && (
              <div className="grid md:grid-cols-2 gap-3 pt-2 border-t">
                <Field label="Imobiliária — nome" value={form.imobiliaria_nome} onChange={(v) => set("imobiliaria_nome", v)} />
                <Field label="Imobiliária — e-mail" value={form.imobiliaria_email} onChange={(v) => set("imobiliaria_email", v)} />
                <Field label="Imobiliária — telefone" value={form.imobiliaria_telefone} onChange={(v) => set("imobiliaria_telefone", v)} />
                <Field label="Taxa de administração (%)" type="number" value={form.taxa_administracao_pct} onChange={(v) => set("taxa_administracao_pct", v ? Number(v) : null)} />
                <Field label="Valor inicial do aluguel (R$)" type="number" value={form.valor_locacao_inicial} onChange={(v) => set("valor_locacao_inicial", v ? Number(v) : null)} />
                <Field label="Início da locação" type="date" value={form.data_inicio_locacao} onChange={(v) => set("data_inicio_locacao", v)} />
                <Field label="Valor atual do aluguel (R$)" type="number" value={form.valor_locacao_atual} onChange={(v) => set("valor_locacao_atual", v ? Number(v) : null)} />
                <SelectField label="Índice de reajuste" value={form.indice_locacao} options={INDICES} onChange={(v) => set("indice_locacao", v)} />
                <SelectField label="Periodicidade" value={form.periodicidade_reajuste} options={["Anual", "Semestral"]} onChange={(v) => set("periodicidade_reajuste", v)} />
                <Field label="Próximo reajuste" type="date" value={form.data_proximo_reajuste} onChange={(v) => set("data_proximo_reajuste", v)} />
              </div>
            )}
            {showShortStay && (
              <div className="grid md:grid-cols-2 gap-3 pt-2 border-t">
                <SelectField label="Plataforma" value={form.plataforma_shortstay} options={["Airbnb", "Booking", "Ambos", "Outro"]} onChange={(v) => set("plataforma_shortstay", v)} />
                <Field label="Administrador / anfitrião" value={form.admin_shortstay_nome} onChange={(v) => set("admin_shortstay_nome", v)} />
                <Field label="E-mail do administrador" value={form.admin_shortstay_email} onChange={(v) => set("admin_shortstay_email", v)} />
                <Field label="Telefone do administrador" value={form.admin_shortstay_telefone} onChange={(v) => set("admin_shortstay_telefone", v)} />
                <Field label="Receita média mensal (R$)" type="number" value={form.receita_media_mensal} onChange={(v) => set("receita_media_mensal", v ? Number(v) : null)} />
                <Field label="Taxa de administração (%)" type="number" value={form.taxa_administracao_pct} onChange={(v) => set("taxa_administracao_pct", v ? Number(v) : null)} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Histórico de valor */}
      {!showUso && (
        <HistoricoValorBlock form={form} set={set} imovelIR={imovelIR} />
      )}

      {/* Correção do aluguel — tabela ano a ano */}
      {showLongStay && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h5 className="font-semibold text-sm">💰 Correção do aluguel — ano a ano</h5>
            <CorrecaoAluguelAnualTabela
              valorInicial={form.valor_locacao_inicial}
              dataInicial={form.data_inicio_locacao}
              indice={form.indice_locacao || "IPCA"}
              valorAtual={form.valor_locacao_atual}
            />
          </CardContent>
        </Card>
      )}

      {/* Mini fluxo financeiro */}
      {showRenda && (
        <FluxoFinanceiroCard form={form} />
      )}

      {/* Repasses */}
      {showRenda && familiaId && (
        <RepassesAluguel imovelId={dbImovel.id} familiaId={familiaId} />
      )}

      {/* Condomínio */}
      {showCondominio && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h5 className="font-semibold text-sm">🏢 Condomínio</h5>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Nome do condomínio" value={form.condominio_nome} onChange={(v) => set("condominio_nome", v)} />
              <Field label="Administrador" value={form.condominio_admin_nome} onChange={(v) => set("condominio_admin_nome", v)} />
              <Field label="E-mail do administrador" value={form.condominio_admin_email} onChange={(v) => set("condominio_admin_email", v)} />
              <Field label="Telefone do administrador" value={form.condominio_admin_telefone} onChange={(v) => set("condominio_admin_telefone", v)} />
              <Field label="Taxa condominial (R$)" type="number" value={form.taxa_condominio} onChange={(v) => set("taxa_condominio", v ? Number(v) : null)} />
              <Field label="Dia de vencimento" type="number" value={form.vencimento_condominio} onChange={(v) => set("vencimento_condominio", v ? Number(v) : null)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certidões — vinculadas ao checklist do imóvel */}
      <CertidoesBlock dbImovel={dbImovel} form={form} set={set} familiaId={familiaId} onSaved={onSaved} />


      <div className="flex justify-end">
        <Button onClick={salvar} disabled={saving}>
          {saving ? "Salvando..." : "Salvar gestão"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({
  label, value, options, onChange,
}: { label: string; value: any; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ContratoStatusBadge({ fim }: { fim?: string | null }) {
  if (!fim) return null;
  const dias = diasAte(fim) ?? 0;
  if (dias < 0)
    return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">🔴 Vencido</Badge>;
  if (dias < 90)
    return <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30">🟡 Vence em {dias} dias</Badge>;
  return <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">🟢 Vigente</Badge>;
}

/* ============== Histórico de valor ============== */
function HistoricoValorBlock({
  form, set, imovelIR,
}: { form: DbImovel; set: (k: string, v: any) => void; imovelIR?: any }) {
  const irParsed = parseBrDate(imovelIR?.data_aquisicao ?? null);
  const irYear = irParsed.year;
  const irValor = imovelIR?.valor_declarado ?? null;

  const dbParsed = parseBrDate(form.data_aquisicao ?? null);
  const ano = dbParsed.year ?? null;
  const valor = form.valor_aquisicao ?? null;
  const indice = form.indice_correcao ?? "IPCA";

  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!form.valor_aquisicao && irValor) set("valor_aquisicao", Number(irValor));
    if (!form.data_aquisicao && irParsed.iso) set("data_aquisicao", irParsed.iso);
    if (!form.indice_correcao) set("indice_correcao", "IPCA");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imovelIR?.id]);

  async function calcular() {
    if (!valor || !dbParsed.iso) return;
    setLoading(true); setErr(null);
    const hoje = new Date();
    const dataFinal = `${String(hoje.getDate()).padStart(2,"0")}/${String(hoje.getMonth()+1).padStart(2,"0")}/${hoje.getFullYear()}`;
    const { data, error } = await supabase.functions.invoke("correcao-monetaria", {
      body: { indice, dataInicial: toBrDate(dbParsed.iso), dataFinal, valorInicial: valor },
    });
    setLoading(false);
    if (error || data?.error) { setErr(data?.error ?? error?.message ?? "Erro ao calcular"); return; }
    setRes(data);
  }

  useEffect(() => {
    setRes(null);
    if (valor && dbParsed.iso && indice) calcular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, dbParsed.iso, indice]);

  const semAno = !ano;
  const anoHoje = new Date().getFullYear();

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h5 className="font-semibold text-sm">📈 Histórico de valor</h5>
          {irYear && (!form.data_aquisicao || !form.valor_aquisicao) && (
            <Button size="sm" variant="outline" onClick={() => {
              if (irParsed.iso) set("data_aquisicao", irParsed.iso);
              if (irValor) set("valor_aquisicao", Number(irValor));
            }}>Aplicar valores do IR</Button>
          )}
        </div>

        {semAno ? (
          <div className="rounded-md border-2 border-dashed border-amber-400 bg-amber-50 p-4 space-y-3">
            <div className="text-sm text-amber-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Informe o ano de aquisição para calcular a valorização
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ano de aquisição *</Label>
                <Input
                  type="number"
                  placeholder="Ex: 2018"
                  className="border-amber-400 focus-visible:ring-amber-500"
                  value={ano ?? ""}
                  onChange={(e) => {
                    const y = e.target.value ? Number(e.target.value) : null;
                    set("data_aquisicao", y ? `${y}-01-01` : null);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor de aquisição (R$){irValor ? " — pré-preenchido do IR" : ""}</Label>
                <Input type="number" value={valor ?? ""} onChange={(e) => set("valor_aquisicao", e.target.value ? Number(e.target.value) : null)} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ano de aquisição</Label>
                <Input type="number" value={ano} onChange={(e) => {
                  const y = e.target.value ? Number(e.target.value) : null;
                  set("data_aquisicao", y ? `${y}-01-01` : null);
                }} />
              </div>
              <Field label={`Valor de aquisição (R$)${irValor && Number(irValor) === Number(valor) ? " — IR" : ""}`} type="number" value={valor} onChange={(v) => set("valor_aquisicao", v ? Number(v) : null)} />
              <SelectField label="Índice de correção" value={indice} options={INDICES} onChange={(v) => set("indice_correcao", v)} />
            </div>

            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Compra</div>
                  <div className="text-lg font-semibold">{ano}</div>
                  <div className="text-sm text-muted-foreground">{valor ? formatBRL(valor) : "—"}</div>
                </div>
                <div className="flex-[2] flex flex-col items-center">
                  <div className="w-full h-0.5 bg-gradient-to-r from-muted-foreground/30 via-gold to-emerald-500 relative">
                    <div className="absolute -top-1.5 left-0 h-3.5 w-3.5 rounded-full bg-muted-foreground/40 border-2 border-background" />
                    <div className="absolute -top-1.5 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-background" />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-2">
                    {anoHoje - ano} anos · corrigido por {indice}
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Hoje</div>
                  <div className="text-lg font-semibold">{anoHoje}</div>
                  <div className={cn("text-sm font-medium", res ? "text-emerald-600" : "text-muted-foreground")}>
                    {loading ? "calculando…" : res ? formatBRL(res.valorCorrigido) : (valor ? "—" : "Informe o valor")}
                  </div>
                </div>
              </div>
              {res && (
                <div className="mt-3 pt-3 border-t flex justify-between text-xs">
                  <span className="text-muted-foreground">Correção acumulada</span>
                  <span className="font-medium text-emerald-700">+{res.percentualAcumulado}% · ganho de {formatBRL(res.ganhoNominal)}</span>
                </div>
              )}
              {err && <div className="mt-2 text-xs text-destructive">{err}</div>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ============== Correção do aluguel ano a ano ============== */
function CorrecaoAluguelAnualTabela({
  valorInicial, dataInicial, indice, valorAtual,
}: { valorInicial: number | null; dataInicial: string | null; indice: string | null; valorAtual: number | null }) {
  const [linhas, setLinhas] = useState<Array<{ ano: number; valorCorrigido: number }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function calcular() {
    if (!valorInicial || !dataInicial || !indice) return;
    setLoading(true); setErr(null);
    try {
      const inicio = new Date(dataInicial);
      const anoIni = inicio.getFullYear();
      const anoHoje = new Date().getFullYear();
      const out: Array<{ ano: number; valorCorrigido: number }> = [];
      out.push({ ano: anoIni, valorCorrigido: Number(valorInicial) });
      const dia = String(inicio.getDate()).padStart(2,"0");
      const mes = String(inicio.getMonth()+1).padStart(2,"0");
      for (let y = anoIni + 1; y <= anoHoje; y++) {
        const dataFinal = `${dia}/${mes}/${y}`;
        const { data, error } = await supabase.functions.invoke("correcao-monetaria", {
          body: { indice, dataInicial: toBrDate(dataInicial), dataFinal, valorInicial },
        });
        if (error || data?.error) { setErr(data?.error ?? error?.message ?? "Erro ao calcular"); break; }
        out.push({ ano: y, valorCorrigido: Number(data.valorCorrigido) });
      }
      setLinhas(out);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLinhas(null);
    if (valorInicial && dataInicial && indice) calcular();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorInicial, dataInicial, indice]);

  if (!valorInicial || !dataInicial) {
    return <div className="text-xs text-muted-foreground">Preencha valor inicial e data de início para calcular.</div>;
  }
  if (loading) {
    return <div className="text-xs text-muted-foreground flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Calculando série anual...</div>;
  }
  if (err) return <div className="text-xs text-destructive">{err}</div>;
  if (!linhas) return null;

  const ultima = linhas[linhas.length - 1];
  const praticado = valorAtual != null ? Number(valorAtual) : null;
  const diffAtual = praticado != null ? praticado - ultima.valorCorrigido : null;
  const abaixo = diffAtual != null && diffAtual < 0;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b">
            <tr>
              <th className="text-left py-2 pr-3">Ano</th>
              <th className="text-right py-2 px-3">Contratual corrigido ({indice})</th>
              <th className="text-right py-2 px-3">Valor praticado</th>
              <th className="text-right py-2 px-3">Diferença</th>
              <th className="text-center py-2 pl-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => {
              const isUltima = i === linhas.length - 1;
              const prat = isUltima && praticado != null ? praticado : null;
              const diff = prat != null ? prat - l.valorCorrigido : null;
              const ab = diff != null && diff < 0;
              return (
                <tr key={l.ano} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{l.ano}</td>
                  <td className="py-2 px-3 text-right">{formatBRL(l.valorCorrigido)}</td>
                  <td className="py-2 px-3 text-right">{prat != null ? formatBRL(prat) : "—"}</td>
                  <td className={cn("py-2 px-3 text-right", diff != null && (ab ? "text-destructive" : "text-emerald-600"))}>
                    {diff != null ? `${diff >= 0 ? "+" : ""}${formatBRL(diff)}` : "—"}
                  </td>
                  <td className="py-2 pl-3 text-center">
                    {prat == null ? "—" : ab ? "🔴" : "🟢"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {praticado != null && (
        <div className={cn("rounded-md p-3 text-sm", abaixo ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700")}>
          Desde {toBrDate(dataInicial)}, deveria estar em <strong>{formatBRL(ultima.valorCorrigido)}</strong> pelo {indice}. Praticado: <strong>{formatBRL(praticado)}</strong>. Diferença: <strong>{diffAtual! >= 0 ? "+" : ""}{formatBRL(diffAtual!)}</strong>.
        </div>
      )}
    </div>
  );
}

/* ============== Mini fluxo financeiro ============== */
function FluxoFinanceiroCard({ form }: { form: DbImovel }) {
  const receitaBruta = Number(form.valor_locacao_atual ?? form.receita_media_mensal ?? 0) || 0;
  const taxaPct = Number(form.taxa_administracao_pct ?? 0) || 0;
  const taxaAdm = receitaBruta * (taxaPct / 100);
  const condominio = Number(form.taxa_condominio ?? 0) || 0;
  const iptuMensal = (Number(form.valor_iptu_anual ?? 0) || 0) / 12;
  const liquido = receitaBruta - taxaAdm - condominio - iptuMensal;
  const valorImovel = Number(form.valor_aquisicao ?? form.valor_declarado ?? 0) || 0;
  const yieldMensal = valorImovel > 0 ? (liquido / valorImovel) * 100 : 0;
  const yieldAnual = yieldMensal * 12;

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h5 className="font-semibold text-sm">💸 Resultado mensal estimado</h5>
        <div className="text-sm divide-y">
          <Row k="Receita bruta (aluguel atual)" v={formatBRL(receitaBruta)} />
          <Row k={`(-) Taxa adm imobiliária (${taxaPct}%)`} v={`-${formatBRL(taxaAdm)}`} />
          <Row k="(-) Condomínio" v={`-${formatBRL(condominio)}`} />
          <Row k="(-) IPTU mensal (÷12)" v={`-${formatBRL(iptuMensal)}`} />
          <div className="flex justify-between gap-3 py-2 font-semibold">
            <span>= Resultado líquido estimado</span>
            <span className={cn(liquido >= 0 ? "text-emerald-600" : "text-destructive")}>{formatBRL(liquido)}</span>
          </div>
        </div>
        {valorImovel > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div>
              <div className="text-xs text-muted-foreground">Yield mensal</div>
              <div className="font-semibold">{yieldMensal.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Yield anual</div>
              <div className="font-semibold">{yieldAnual.toFixed(2)}% a.a.</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============== Repasses ============== */
interface Repasse {
  id: string;
  competencia: string;
  valor_bruto: number;
  taxa_adm: number | null;
  valor_liquido: number | null;
  data_repasse: string | null;
  observacoes: string | null;
}

function RepassesAluguel({ imovelId, familiaId }: { imovelId: string; familiaId: string }) {
  const { user } = useAuth();
  const [list, setList] = useState<Repasse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    competencia: "",
    valor_bruto: "",
    taxa_adm: "",
    valor_liquido: "",
    data_repasse: "",
    observacoes: "",
  });
  const [saving, setSaving] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from("repasses_aluguel" as any)
      .select("*")
      .eq("imovel_id", imovelId)
      .order("competencia", { ascending: false });
    setList(((data as any) ?? []) as Repasse[]);
    setLoading(false);
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [imovelId]);

  async function salvarRepasse() {
    if (!form.competencia || !form.valor_bruto) {
      toast.error("Preencha competência e valor bruto");
      return;
    }
    setSaving(true);
    const payload = {
      imovel_id: imovelId,
      familia_id: familiaId,
      competencia: form.competencia,
      valor_bruto: Number(form.valor_bruto),
      taxa_adm: form.taxa_adm ? Number(form.taxa_adm) : null,
      valor_liquido: form.valor_liquido ? Number(form.valor_liquido) : null,
      data_repasse: form.data_repasse || null,
      observacoes: form.observacoes || null,
      created_by: user?.id ?? null,
    };
    const { error } = await supabase.from("repasses_aluguel" as any).insert(payload as any);
    setSaving(false);
    if (error) { toast.error("Erro ao registrar", { description: error.message }); return; }
    toast.success("Repasse registrado");
    setOpen(false);
    setForm({ competencia: "", valor_bruto: "", taxa_adm: "", valor_liquido: "", data_repasse: "", observacoes: "" });
    await carregar();
  }

  const totaisPorAno = useMemo(() => {
    const m = new Map<number, { soma: number; count: number }>();
    for (const r of list) {
      const ano = new Date(r.competencia).getFullYear();
      const liq = r.valor_liquido ?? r.valor_bruto;
      const cur = m.get(ano) ?? { soma: 0, count: 0 };
      cur.soma += Number(liq) || 0;
      cur.count += 1;
      m.set(ano, cur);
    }
    return Array.from(m.entries()).sort(([a],[b]) => b - a);
  }, [list]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="font-semibold text-sm">📥 Repasses de aluguel</h5>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Registrar repasse
          </Button>
        </div>

        {totaisPorAno.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {totaisPorAno.map(([ano, t]) => (
              <div key={ano} className="rounded-md border bg-muted/30 p-2 text-xs">
                <div className="text-muted-foreground">Total {ano}</div>
                <div className="font-semibold">{formatBRL(t.soma)}</div>
                <div className="text-[11px] text-muted-foreground">Média: {formatBRL(t.soma / t.count)}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-xs text-muted-foreground">Carregando…</div>
        ) : list.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">Nenhum repasse registrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 pr-3">Competência</th>
                  <th className="text-right py-2 px-3">Bruto</th>
                  <th className="text-right py-2 px-3">Taxa</th>
                  <th className="text-right py-2 px-3">Líquido</th>
                  <th className="text-left py-2 pl-3">Repassado em</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{r.competencia ? new Date(r.competencia).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }) : "—"}</td>
                    <td className="py-2 px-3 text-right">{formatBRL(Number(r.valor_bruto))}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{r.taxa_adm != null ? `-${formatBRL(Number(r.taxa_adm))}` : "—"}</td>
                    <td className="py-2 px-3 text-right font-medium">{r.valor_liquido != null ? formatBRL(Number(r.valor_liquido)) : "—"}</td>
                    <td className="py-2 pl-3">{r.data_repasse ? new Date(r.data_repasse).toLocaleDateString("pt-BR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar repasse</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Competência (mês)" type="month" value={form.competencia} onChange={(v) => setForm({ ...form, competencia: v ? `${v}-01` : "" })} />
            <Field label="Data do repasse" type="date" value={form.data_repasse} onChange={(v) => setForm({ ...form, data_repasse: v })} />
            <Field label="Valor bruto (R$)" type="number" value={form.valor_bruto} onChange={(v) => setForm({ ...form, valor_bruto: v })} />
            <Field label="Taxa adm (R$)" type="number" value={form.taxa_adm} onChange={(v) => setForm({ ...form, taxa_adm: v })} />
            <Field label="Valor líquido (R$)" type="number" value={form.valor_liquido} onChange={(v) => setForm({ ...form, valor_liquido: v })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvarRepasse} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ============== Certidões ============== */
const CERTIDOES = [
  { key: "cnd_condominio", label: "CND Condomínio", emi: "certidao_cnd_condominio_data", val: "certidao_cnd_condominio_validade" },
  { key: "cnd_iptu",       label: "CND IPTU",       emi: "certidao_cnd_iptu_data",       val: "certidao_cnd_iptu_validade" },
  { key: "cnd_energia",    label: "CND Energia Elétrica", emi: "certidao_cnd_energia_data", val: "certidao_cnd_energia_validade" },
  { key: "onus",           label: "Certidão de Ônus", emi: "certidao_onus_data",         val: "certidao_onus_validade" },
  { key: "matricula",      label: "Matrícula atualizada", emi: "certidao_matricula_data", val: "certidao_matricula_validade" },
];

function badgeCertidao(validade?: string | null) {
  if (!validade) return { cls: "bg-muted text-muted-foreground", txt: "⬜ Pendente" };
  const dias = diasAte(validade) ?? 0;
  if (dias < 0) return { cls: "bg-destructive/10 text-destructive border-destructive/30", txt: "🔴 Vencida" };
  if (dias < 30) return { cls: "bg-amber-500/15 text-amber-700 border-amber-500/30", txt: `🟡 Vence em ${dias}d` };
  return { cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", txt: "🟢 Válida" };
}

/* ============== CERTIDÕES (document-driven via checklist) ============== */
function CertidoesBlock({
  dbImovel, form, set, familiaId, onSaved,
}: {
  dbImovel: DbImovel;
  form: DbImovel;
  set: (k: string, v: any) => void;
  familiaId?: string;
  onSaved: () => Promise<void>;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [docs, setDocs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [manualEdit, setManualEdit] = useState<string | null>(null);

  async function carregar() {
    if (!dbImovel?.id) return;
    setLoading(true);
    const itemIds = CERTIDOES.map((c) => c.key);
    const { data: cl } = await supabase
      .from("checklist_imovel")
      .select("id, item_id, status, documento_id, data_recebimento")
      .eq("imovel_id", dbImovel.id)
      .in("item_id", itemIds);
    setItems(cl ?? []);
    const docIds = (cl ?? []).map((c: any) => c.documento_id).filter(Boolean);
    if (docIds.length) {
      const { data: ds } = await supabase
        .from("familia_documentos")
        .select("id, nome_arquivo, storage_path, recebido_em")
        .in("id", docIds);
      const map: Record<string, any> = {};
      (ds ?? []).forEach((d: any) => { map[d.id] = d; });
      setDocs(map);
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [dbImovel?.id]);

  async function anexar(certidao: typeof CERTIDOES[number], file: File) {
    if (!dbImovel?.id || !familiaId) return;
    setUploading(certidao.key);
    try {
      const path = `${familiaId}/${dbImovel.id}/${certidao.key}-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("familia-documentos").upload(path, file);
      if (upErr) throw upErr;
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { data: doc, error: docErr } = await supabase
        .from("familia_documentos")
        .insert({
          familia_id: familiaId,
          nome_arquivo: file.name,
          storage_path: path,
          tipo: certidao.key,
          categoria: "imovel",
          imovel_ref: dbImovel.id,
          created_by: userId,
        } as any)
        .select()
        .single();
      if (docErr) throw docErr;

      // ensure checklist row exists
      let checklistRow = items.find((i) => i.item_id === certidao.key);
      if (!checklistRow) {
        const { data: novo } = await supabase
          .from("checklist_imovel")
          .insert({
            imovel_id: dbImovel.id,
            familia_id: familiaId,
            item_id: certidao.key,
            label: certidao.label,
            opcional: true,
            status: "recebido",
            documento_id: doc!.id,
            data_recebimento: new Date().toISOString(),
          } as any)
          .select()
          .single();
        checklistRow = novo;
      } else {
        await supabase
          .from("checklist_imovel")
          .update({ status: "recebido", documento_id: doc!.id, data_recebimento: new Date().toISOString() })
          .eq("id", checklistRow.id);
      }

      // chamar extração via Claude
      let extraidos = false;
      try {
        const base64 = await fileToBase64(file);
        const { data: extr } = await supabase.functions.invoke("extract-imovel-doc", {
          body: { file: { name: file.name, mimeType: file.type || "application/pdf", base64 }, hint: certidao.key },
        });
        const result = extr?.data;
        const patch: any = {};
        if (result?.certidao?.data_emissao) patch[certidao.emi] = result.certidao.data_emissao;
        if (result?.certidao?.validade) patch[certidao.val] = result.certidao.validade;

        // utilidades
        const u = result?.utilidades ?? {};
        const meta: any = { ...(form.extracao_meta ?? {}) };
        const ref = u.mes_referencia ?? null;
        const utilFields: Array<[string, any]> = [
          ["unidade_consumidora", u.unidade_consumidora],
          ["distribuidora", u.distribuidora],
          ["mes_referencia_energia", u.mes_referencia],
          ["hidrometro", u.hidrometro],
          ["matricula_agua", u.matricula_agua],
          ["inscricao_municipal", u.inscricao_municipal],
        ];
        for (const [k, v] of utilFields) {
          if (v) {
            patch[k] = v;
            meta[k] = { fonte: file.name, ref };
          }
        }
        if (Object.keys(meta).length) patch.extracao_meta = meta;

        if (Object.keys(patch).length) {
          await supabase.from("imoveis_cliente").update(patch).eq("id", dbImovel.id);
          extraidos = true;
        }
      } catch (e) {
        console.warn("Extração falhou:", e);
      }

      toast.success(extraidos ? `${certidao.label} anexada e dados extraídos ✓` : `${certidao.label} anexada — preencha as datas manualmente`);
      if (!extraidos) setManualEdit(certidao.key);
      await carregar();
      await onSaved();
    } catch (e: any) {
      toast.error("Erro ao anexar", { description: e?.message });
    } finally {
      setUploading(null);
    }
  }

  async function verArquivo(storage_path: string) {
    const { data } = await supabase.storage.from("familia-documentos").createSignedUrl(storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h5 className="font-semibold text-sm flex items-center gap-2"><FileCheck className="h-4 w-4" /> Certidões e documentos do imóvel</h5>
        {loading ? (
          <div className="text-xs text-muted-foreground">Carregando…</div>
        ) : (
          <div className="space-y-2">
            {CERTIDOES.map((c) => {
              const item = items.find((i) => i.item_id === c.key);
              const doc = item?.documento_id ? docs[item.documento_id] : null;
              const b = badgeCertidao(form[c.val]);
              const recebido = item?.status === "recebido";
              return (
                <div key={c.key} className="border rounded-md p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {recebido ? "✓" : "☐"} {c.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Emissão: {form[c.emi] ? new Date(form[c.emi]).toLocaleDateString("pt-BR") : "—"} · Validade: {form[c.val] ? new Date(form[c.val]).toLocaleDateString("pt-BR") : "—"}
                        {doc && <> · <button onClick={() => verArquivo(doc.storage_path)} className="underline hover:text-foreground">{doc.nome_arquivo}</button></>}
                      </div>
                    </div>
                    <Badge variant="outline" className={b.cls}>{b.txt}</Badge>
                    <label className={cn(
                      "inline-flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer hover:bg-muted",
                      uploading === c.key && "opacity-50 cursor-wait",
                    )}>
                      <Plus className="h-3 w-3" />
                      {uploading === c.key ? "..." : (recebido ? "Substituir" : "Anexar")}
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        disabled={uploading === c.key}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) anexar(c, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setManualEdit(manualEdit === c.key ? null : c.key)}>
                      Editar datas
                    </Button>
                  </div>
                  {manualEdit === c.key && (
                    <div className="grid md:grid-cols-2 gap-3 pt-2 border-t">
                      <Field label="Data de emissão" type="date" value={form[c.emi]} onChange={(v) => set(c.emi, v || null)} />
                      <Field label="Validade" type="date" value={form[c.val]} onChange={(v) => set(c.val, v || null)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Ao anexar uma certidão, datas de emissão e validade são extraídas automaticamente. Se a extração falhar, edite manualmente.
        </p>
      </CardContent>
    </Card>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn(bold && "font-semibold")}>{v}</span>
    </div>
  );
}
