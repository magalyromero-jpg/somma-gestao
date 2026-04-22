import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { imoveis as mockImoveis } from "@/data/mock";
import { formatBRL, formatPct, pctClass } from "@/lib/format";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function Mercado() {
  const { role, user } = useAuth();
  const isGestor = role === "gestor";
  const qc = useQueryClient();

  const [estado, setEstado] = useState<string>("all");
  const [cidade, setCidade] = useState<string>("all");
  const [tipo, setTipo] = useState<string>("all");

  // Dados internos = mock por enquanto
  const filtrados = useMemo(() => {
    return mockImoveis.filter((i) => {
      if (estado !== "all" && i.estado !== estado) return false;
      if (cidade !== "all" && i.cidade !== cidade) return false;
      if (tipo !== "all" && i.tipo !== tipo) return false;
      return true;
    });
  }, [estado, cidade, tipo]);

  const estados = Array.from(new Set(mockImoveis.map((i) => i.estado)));
  const cidades = Array.from(new Set(mockImoveis.map((i) => i.cidade)));
  const tipos = Array.from(new Set(mockImoveis.map((i) => i.tipo)));

  const metricas = useMemo(() => {
    const valores = filtrados.map((i) => i.valor_mercado).filter(Boolean);
    const alugueis = filtrados.map((i) => i.aluguel_mensal ?? 0).filter(Boolean);
    const media = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
    const yields = filtrados
      .filter((i) => i.aluguel_mensal && i.valor_mercado)
      .map((i) => ((i.aluguel_mensal! * 12) / i.valor_mercado) * 100);
    return {
      qtd: filtrados.length,
      mediaValor: media(valores),
      mediaAluguel: media(alugueis),
      yieldMedio: media(yields),
    };
  }, [filtrados]);

  // FipeZAP
  const { data: fipezap = [] } = useQuery({
    queryKey: ["fipezap"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fipezap_indices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pesquisas = [] } = useQuery({
    queryKey: ["pesquisas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pesquisas_mercado")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addFipezap = useMutation({
    mutationFn: async (payload: {
      cidade: string;
      tipo_imovel: string;
      periodo: string;
      variacao_mensal: number;
      variacao_anual: number;
      valor_m2: number;
    }) => {
      const { error } = await supabase
        .from("fipezap_indices")
        .insert({ ...payload, criado_por: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Índice FipeZAP adicionado");
      qc.invalidateQueries({ queryKey: ["fipezap"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const addPesquisa = useMutation({
    mutationFn: async (p: Record<string, unknown>) => {
      const { error } = await supabase
        .from("pesquisas_mercado")
        .insert({ ...p, criado_por: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pesquisa registrada");
      qc.invalidateQueries({ queryKey: ["pesquisas"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <>
      <PageHeader title="Mercado" subtitle="Dados internos, FipeZAP e pesquisas comparativas" />

      {/* Filtros */}
      <Card className="mb-5">
        <CardContent className="p-4 flex flex-wrap gap-3">
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cidade} onValueChange={setCidade}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Cidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Seção 1 — Dados internos */}
      <h2 className="text-lg font-extralight text-foreground mb-3">Dados internos</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Imóveis" value={String(metricas.qtd)} />
        <MetricCard label="Média valor mercado" value={formatBRL(metricas.mediaValor, { compact: true })} />
        <MetricCard label="Média locação" value={formatBRL(metricas.mediaAluguel, { compact: true })} />
        <MetricCard label="Yield médio" value={formatPct(metricas.yieldMedio, false)} />
      </div>

      {/* Seção 2 — FipeZAP */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-extralight text-foreground">Índices FipeZAP</h2>
        {isGestor && <NovoFipezapDialog onSave={(p) => addFipezap.mutate(p)} />}
      </div>
      <Card className="mb-8">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cidade</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Var. mensal</TableHead>
                <TableHead className="text-right">Var. anual</TableHead>
                <TableHead className="text-right">R$/m²</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fipezap.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center font-light text-muted-foreground py-8">
                  Nenhum índice cadastrado ainda.
                </TableCell></TableRow>
              )}
              {fipezap.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.cidade}</TableCell>
                  <TableCell className="font-light">{f.tipo_imovel ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{f.periodo}</TableCell>
                  <TableCell className={`text-right ${pctClass(Number(f.variacao_mensal ?? 0))}`}>
                    {formatPct(Number(f.variacao_mensal ?? 0))}
                  </TableCell>
                  <TableCell className={`text-right ${pctClass(Number(f.variacao_anual ?? 0))}`}>
                    {formatPct(Number(f.variacao_anual ?? 0))}
                  </TableCell>
                  <TableCell className="text-right">{formatBRL(Number(f.valor_m2 ?? 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Seção 3 — Pesquisas */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-extralight text-foreground">Pesquisas comparativas</h2>
        {isGestor && <NovaPesquisaDialog onSave={(p) => addPesquisa.mutate(p)} />}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cidade / Bairro</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Área (m²)</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Fonte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pesquisas.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center font-light text-muted-foreground py-8">
                  Nenhuma pesquisa registrada ainda.
                </TableCell></TableRow>
              )}
              {pesquisas.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">
                    {p.data_pesquisa ? new Date(p.data_pesquisa).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="font-light">{p.cidade}{p.bairro ? ` · ${p.bairro}` : ""}</TableCell>
                  <TableCell className="font-light">{p.tipo_imovel}</TableCell>
                  <TableCell className="text-right">{p.area_m2 ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatBRL(Number(p.valor ?? 0))}</TableCell>
                  <TableCell className="font-light text-xs">{p.fonte}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="text-[11px] uppercase tracking-wider font-light text-muted-foreground">{label}</div>
      <div className="text-xl font-extralight text-foreground mt-1">{value}</div>
    </CardContent>
  </Card>
);

function NovoFipezapDialog({ onSave }: { onSave: (p: any) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    cidade: "", tipo_imovel: "", periodo: "",
    variacao_mensal: "", variacao_anual: "", valor_m2: "",
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground">
          <Plus className="h-4 w-4 mr-1" /> Novo índice
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-light">Adicionar índice FipeZAP</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cidade" value={form.cidade} onChange={(v) => setForm({ ...form, cidade: v })} />
          <Field label="Tipo" value={form.tipo_imovel} onChange={(v) => setForm({ ...form, tipo_imovel: v })} />
          <Field label="Período (ex: 2026-04)" value={form.periodo} onChange={(v) => setForm({ ...form, periodo: v })} />
          <Field label="R$/m²" type="number" value={form.valor_m2} onChange={(v) => setForm({ ...form, valor_m2: v })} />
          <Field label="Var. mensal %" type="number" value={form.variacao_mensal} onChange={(v) => setForm({ ...form, variacao_mensal: v })} />
          <Field label="Var. anual %" type="number" value={form.variacao_anual} onChange={(v) => setForm({ ...form, variacao_anual: v })} />
        </div>
        <Button
          className="bg-gold hover:bg-gold/90 text-gold-foreground"
          onClick={() => {
            onSave({
              cidade: form.cidade, tipo_imovel: form.tipo_imovel, periodo: form.periodo,
              variacao_mensal: Number(form.variacao_mensal),
              variacao_anual: Number(form.variacao_anual),
              valor_m2: Number(form.valor_m2),
            });
            setOpen(false);
            setForm({ cidade: "", tipo_imovel: "", periodo: "", variacao_mensal: "", variacao_anual: "", valor_m2: "" });
          }}
        >Salvar</Button>
      </DialogContent>
    </Dialog>
  );
}

function NovaPesquisaDialog({ onSave }: { onSave: (p: any) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    cidade: "", bairro: "", tipo_imovel: "", area_m2: "", valor: "",
    fonte: "ZAP", url: "", data_pesquisa: new Date().toISOString().slice(0, 10), observacoes: "",
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gold hover:bg-gold/90 text-gold-foreground">
          <Plus className="h-4 w-4 mr-1" /> Nova pesquisa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-light">Registrar pesquisa</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cidade" value={form.cidade} onChange={(v) => setForm({ ...form, cidade: v })} />
          <Field label="Bairro" value={form.bairro} onChange={(v) => setForm({ ...form, bairro: v })} />
          <Field label="Tipo" value={form.tipo_imovel} onChange={(v) => setForm({ ...form, tipo_imovel: v })} />
          <Field label="Área (m²)" type="number" value={form.area_m2} onChange={(v) => setForm({ ...form, area_m2: v })} />
          <Field label="Valor (R$)" type="number" value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} />
          <div className="space-y-1.5">
            <Label className="font-light text-xs uppercase tracking-wider">Fonte</Label>
            <Select value={form.fonte} onValueChange={(v) => setForm({ ...form, fonte: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["ZAP", "OLX", "QuintoAndar", "VivaReal", "Outro"].map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field label="Data" type="date" value={form.data_pesquisa} onChange={(v) => setForm({ ...form, data_pesquisa: v })} />
          <Field label="URL" value={form.url} onChange={(v) => setForm({ ...form, url: v })} />
          <div className="col-span-2"><Field label="Observações" value={form.observacoes} onChange={(v) => setForm({ ...form, observacoes: v })} /></div>
        </div>
        <Button
          className="bg-gold hover:bg-gold/90 text-gold-foreground"
          onClick={() => {
            onSave({
              ...form,
              area_m2: Number(form.area_m2) || null,
              valor: Number(form.valor) || null,
            });
            setOpen(false);
          }}
        >Salvar</Button>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-light text-xs uppercase tracking-wider">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
