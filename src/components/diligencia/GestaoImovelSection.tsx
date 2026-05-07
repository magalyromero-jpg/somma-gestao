import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RefreshCw, TrendingUp, AlertCircle } from "lucide-react";

type DbImovel = Record<string, any>;

interface Props {
  dbImovel: DbImovel | null;
  tipoOperacao: string;
  onSaved: () => Promise<void>;
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

export function GestaoImovelSection({ dbImovel, tipoOperacao, onSaved }: Props) {
  const [form, setForm] = useState<DbImovel>(dbImovel ?? {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(dbImovel ?? {});
  }, [dbImovel?.id]);

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
    const campos = [
      "tipo_locacao", "contrato_inicio", "contrato_fim",
      "imobiliaria_nome", "imobiliaria_email", "imobiliaria_telefone",
      "valor_locacao_atual", "valor_locacao_inicial", "data_inicio_locacao",
      "indice_locacao", "periodicidade_reajuste", "data_proximo_reajuste",
      "plataforma_shortstay", "admin_shortstay_nome", "admin_shortstay_email",
      "admin_shortstay_telefone", "receita_media_mensal",
      "condominio_nome", "condominio_admin_nome", "condominio_admin_email",
      "condominio_admin_telefone", "taxa_condominio", "vencimento_condominio",
      "unidade_consumidora", "distribuidora_energia", "hidrometro", "matricula_agua",
      "valor_aquisicao", "data_aquisicao", "indice_correcao",
    ];
    for (const c of campos) patch[c] = form[c] ?? null;
    const { error } = await supabase.from("imoveis_cliente").update(patch).eq("id", dbImovel.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar gestão", { description: error.message });
      return;
    }
    toast.success("Gestão atualizada");
    await onSaved();
  }

  const showRenda = tipoOperacao === "para_renda";
  const showVenda = tipoOperacao === "para_venda";
  const showValorizacao = tipoOperacao === "valorizacao";
  const showUso = tipoOperacao === "uso_familiar";
  const showCondominio = true; // todos
  const showUtilidades = !showValorizacao;
  const showLongStay = showRenda && form.tipo_locacao === "long_stay";
  const showShortStay = showRenda && form.tipo_locacao === "short_stay";

  return (
    <div className="space-y-6">
      {/* BLOCO 1 — Contrato de locação */}
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
                <Field label="Valor atual locação (R$)" type="number" value={form.valor_locacao_atual} onChange={(v) => set("valor_locacao_atual", v ? Number(v) : null)} />
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
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BLOCO 2 — Valorização do ativo */}
      {!showUso && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h5 className="font-semibold text-sm">📈 Valorização do ativo</h5>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Valor de aquisição (R$)" type="number" value={form.valor_aquisicao} onChange={(v) => set("valor_aquisicao", v ? Number(v) : null)} />
              <Field label="Data de aquisição" type="date" value={form.data_aquisicao} onChange={(v) => set("data_aquisicao", v)} />
              <SelectField label="Índice de correção" value={form.indice_correcao} options={INDICES} onChange={(v) => set("indice_correcao", v)} />
            </div>
            <CorrecaoMonetariaWidget
              valor={form.valor_aquisicao}
              dataInicial={form.data_aquisicao}
              indice={form.indice_correcao}
            />
          </CardContent>
        </Card>
      )}

      {/* BLOCO 3 — Correção do contrato de locação */}
      {showLongStay && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h5 className="font-semibold text-sm">💰 Correção do aluguel</h5>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Valor inicial do aluguel (R$)" type="number" value={form.valor_locacao_inicial} onChange={(v) => set("valor_locacao_inicial", v ? Number(v) : null)} />
              <Field label="Início da locação" type="date" value={form.data_inicio_locacao} onChange={(v) => set("data_inicio_locacao", v)} />
              <SelectField label="Índice contratual" value={form.indice_locacao} options={INDICES} onChange={(v) => set("indice_locacao", v)} />
            </div>
            <CorrecaoAluguelWidget
              valorInicial={form.valor_locacao_inicial}
              dataInicial={form.data_inicio_locacao}
              indice={form.indice_locacao}
              valorAtual={form.valor_locacao_atual}
            />
          </CardContent>
        </Card>
      )}

      {/* BLOCO 4 — Condomínio */}
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

      {/* BLOCO 5 — Utilidades */}
      {showUtilidades && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h5 className="font-semibold text-sm">⚡ Utilidades</h5>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Unidade consumidora (energia)" value={form.unidade_consumidora} onChange={(v) => set("unidade_consumidora", v)} />
              <Field label="Distribuidora" value={form.distribuidora_energia} onChange={(v) => set("distribuidora_energia", v)} />
              <Field label="Hidrômetro" value={form.hidrometro} onChange={(v) => set("hidrometro", v)} />
              <Field label="Matrícula de água" value={form.matricula_agua} onChange={(v) => set("matricula_agua", v)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* BLOCO 6 — Comparativo de mercado (placeholder) */}
      <Card className="border-dashed">
        <CardContent className="p-4 text-center space-y-2">
          <div className="text-sm font-semibold">📊 Comparativo de Mercado</div>
          <div className="text-xs text-muted-foreground">
            Busca automática em ZAP Imóveis e OLX para benchmark de valor de venda e locação com imóveis similares na mesma região.
          </div>
          <Button size="sm" variant="outline" disabled>Buscar no mercado</Button>
        </CardContent>
      </Card>

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

function CorrecaoMonetariaWidget({
  valor, dataInicial, indice,
}: { valor: number | null; dataInicial: string | null; indice: string | null }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function calcular() {
    if (!valor || !dataInicial || !indice) {
      toast.error("Preencha valor, data e índice");
      return;
    }
    setLoading(true);
    setErr(null);
    const hoje = new Date();
    const dataFinal = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
    const { data, error } = await supabase.functions.invoke("correcao-monetaria", {
      body: { indice, dataInicial: toBrDate(dataInicial), dataFinal, valorInicial: valor },
    });
    setLoading(false);
    if (error || data?.error) {
      setErr(data?.error ?? error?.message ?? "Erro ao calcular");
      return;
    }
    setRes(data);
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={calcular} disabled={loading}>
        {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <TrendingUp className="h-3.5 w-3.5 mr-1" />}
        Calcular correção
      </Button>
      {err && <div className="text-xs text-destructive">{err}</div>}
      {res && (
        <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
          <Row k="Valor de compra" v={formatBRL(res.valorInicial)} />
          <Row k="Índice" v={`${res.indice} (${res.totalMeses} meses)`} />
          <Row k="Correção acumulada" v={`+${res.percentualAcumulado}%`} />
          <div className="border-t my-2" />
          <Row k="Valor atualizado (est.)" v={formatBRL(res.valorCorrigido)} bold />
          <Row k="Ganho nominal estimado" v={formatBRL(res.ganhoNominal)} />
          <div className="text-[11px] text-muted-foreground pt-1">
            Estimativa baseada apenas na correção monetária pelo índice. Não considera valorização de mercado.
          </div>
        </div>
      )}
    </div>
  );
}

function CorrecaoAluguelWidget({
  valorInicial, dataInicial, indice, valorAtual,
}: { valorInicial: number | null; dataInicial: string | null; indice: string | null; valorAtual: number | null }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function calcular() {
    if (!valorInicial || !dataInicial || !indice) {
      toast.error("Preencha valor inicial, data e índice");
      return;
    }
    setLoading(true);
    setErr(null);
    const hoje = new Date();
    const dataFinal = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
    const { data, error } = await supabase.functions.invoke("correcao-monetaria", {
      body: { indice, dataInicial: toBrDate(dataInicial), dataFinal, valorInicial },
    });
    setLoading(false);
    if (error || data?.error) {
      setErr(data?.error ?? error?.message ?? "Erro ao calcular");
      return;
    }
    setRes(data);
  }

  const diff = res && valorAtual != null ? Number(valorAtual) - res.valorCorrigido : null;
  const abaixo = diff != null && diff < 0;

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={calcular} disabled={loading}>
        {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <TrendingUp className="h-3.5 w-3.5 mr-1" />}
        Calcular correção do aluguel
      </Button>
      {err && <div className="text-xs text-destructive">{err}</div>}
      {res && (
        <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
          <Row k="Valor original do aluguel" v={formatBRL(res.valorInicial)} />
          <Row k="Índice" v={`${res.indice}`} />
          <Row k="Variação acumulada" v={`+${res.percentualAcumulado}%`} />
          <div className="border-t my-2" />
          <Row k="Valor corrigido pelo índice" v={formatBRL(res.valorCorrigido)} />
          {valorAtual != null && (
            <>
              <Row k="Valor praticado atual" v={formatBRL(Number(valorAtual))} />
              <div className={cn("font-semibold", abaixo ? "text-destructive" : "text-emerald-600")}>
                {abaixo ? "Abaixo do índice: " : "Acima/igual ao índice: "}{formatBRL(diff!)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn(bold && "font-semibold")}>{v}</span>
    </div>
  );
}
