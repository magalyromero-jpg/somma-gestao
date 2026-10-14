import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Bloco } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { cn } from "@/lib/utils";
import { brl, dt } from "@/lib/locacoes";

const db = supabase as any;
const MOTIVOS = ["fim de prazo", "rescisão", "distrato", "despejo", "outro"];
const INDICES = [
  { v: "IPCA", l: "IPCA" }, { v: "IGPM", l: "IGP-M" }, { v: "MEDIA", l: "Média IPCA/IGP-M" }, { v: "FIXO", l: "Fixo/degraus" }, { v: "NENHUM", l: "Nenhum" },
];
const n = (s: string) => (s === "" ? null : Number(String(s).replace(/\./g, "").replace(",", ".")));

function useRecarregar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["loc-edificio"] });
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

function SelIndice({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>{INDICES.map((i) => <SelectItem key={i.v} value={i.v}>{i.l}</SelectItem>)}</SelectContent></Select>;
}

type Degrau = { a_partir: string; valor: string; origem: string };
function GradeDegraus({ itens, set }: { itens: Degrau[]; set: (d: Degrau[]) => void }) {
  return <div className="space-y-2">
    <div className="flex items-center justify-between"><Label className="text-xs">Degraus (opcional)</Label>
      <Button type="button" size="sm" variant="outline" onClick={() => set([...itens, { a_partir: "", valor: "", origem: "degrau" }])}>Adicionar degrau</Button></div>
    {itens.map((g, i) => <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
      <Input type="date" value={g.a_partir} onChange={(e) => set(itens.map((x, j) => j === i ? { ...x, a_partir: e.target.value } : x))} aria-label="A partir de" />
      <Input inputMode="decimal" placeholder="Valor" value={g.valor} onChange={(e) => set(itens.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} />
      <Select value={g.origem} onValueChange={(v) => set(itens.map((x, j) => j === i ? { ...x, origem: v } : x))}><SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="degrau">Degrau</SelectItem><SelectItem value="reajuste">Reajuste</SelectItem><SelectItem value="acordo">Acordo</SelectItem></SelectContent></Select>
      <Button type="button" size="sm" variant="ghost" onClick={() => set(itens.filter((_, j) => j !== i))}>Remover</Button>
    </div>)}
  </div>;
}

async function gravarDegraus(vigenciaId: string, itens: Degrau[]) {
  const rows = itens.filter((g) => g.a_partir && g.valor).map((g) => ({ vigencia_id: vigenciaId, a_partir: g.a_partir, valor_mensal: n(g.valor), origem: g.origem }));
  if (rows.length) { const { error } = await db.from("loc_vigencia_degraus").insert(rows); if (error) throw error; }
}

export function EncerrarContrato({ contratoId, edificioId, unidade }: { contratoId: string; edificioId: string; unidade: string }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ saida: "", motivo: "fim de prazo", cond: "", pauta: "" });
  const [salvando, setSalvando] = useState(false);
  const { toast } = useToast(); const recarregar = useRecarregar();
  const salvar = async () => {
    if (!f.saida) return toast({ title: "Informe a data de saída", variant: "destructive" });
    setSalvando(true);
    const { error } = await db.from("loc_contratos").update({ status: "encerrado", data_saida: f.saida, motivo_encerramento: f.motivo, debito_condominio: n(f.cond) ?? 0, data_em_pauta: f.pauta || null }).eq("id", contratoId).eq("edificio_id", edificioId);
    setSalvando(false);
    if (error) return toast({ title: "Não foi possível encerrar", description: error.message, variant: "destructive" });
    toast({ title: `Contrato de ${unidade} encerrado` }); setOpen(false); recarregar();
  };
  return <>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Encerrar</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent>
      <DialogHeader><DialogTitle>Encerrar contrato · {unidade}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Data de saída *"><Input type="date" value={f.saida} onChange={(e) => setF({ ...f, saida: e.target.value })} /></Campo>
        <Campo label="Motivo"><Select value={f.motivo} onValueChange={(v) => setF({ ...f, motivo: v })}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{MOTIVOS.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent></Select></Campo>
        <Campo label="Condomínio em Aberto (R$)"><Input inputMode="decimal" value={f.cond} onChange={(e) => setF({ ...f, cond: e.target.value })} /></Campo>
        <Campo label="Disponível desde"><Input type="date" value={f.pauta} onChange={(e) => setF({ ...f, pauta: e.target.value })} /></Campo>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={salvar} disabled={salvando}>Encerrar contrato</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}

export function EditarContrato({ linha, vigencias, edificioId }: { linha: any; vigencias: any[]; edificioId: string }) {
  const atual = [...vigencias].filter((v) => v.contrato_id === linha.contrato_id).sort((a, b) => b.seq - a.seq)[0];
  const [open, setOpen] = useState<"" | "editar" | "aditivo">("");
  const ini = () => ({
    dia: String(linha.contrato?.dia_vencimento ?? ""), ret: String(linha.contrato?.retencao_pct ?? 0),
    inicio: open === "aditivo" ? "" : atual?.inicio ?? "", fim: open === "aditivo" ? "" : atual?.fim ?? "",
    valor: open === "aditivo" ? "" : String(atual?.valor_mensal ?? ""), area: String(atual?.area_contrato_m2 ?? ""),
    indice: atual?.indice ?? linha.indice ?? "NENHUM", mes: String(atual?.mes_reajuste ?? ""),
  });
  const [f, setF] = useState(ini());
  const [degraus, setDegraus] = useState<Degrau[]>([]);
  const [salvando, setSalvando] = useState(false);
  const { toast } = useToast(); const recarregar = useRecarregar();
  const abrir = (m: "editar" | "aditivo") => { setOpen(m); setDegraus([]); setTimeout(() => setF({ ...ini(), ...(m === "aditivo" ? { inicio: "", fim: "", valor: "" } : { inicio: atual?.inicio ?? "", fim: atual?.fim ?? "", valor: String(atual?.valor_mensal ?? "") }) })); };
  const salvar = async () => {
    if (!f.inicio || !f.fim || !f.valor) return toast({ title: "Preencha início, fim e valor", variant: "destructive" });
    if (f.fim < f.inicio) return toast({ title: "O fim deve ser igual ou posterior ao início", variant: "destructive" });
    setSalvando(true);
    try {
      const vig = { inicio: f.inicio, fim: f.fim, valor_mensal: n(f.valor), area_contrato_m2: n(f.area), indice: f.indice, mes_reajuste: n(f.mes) };
      let vigId = atual?.id;
      if (open === "aditivo") {
        if (atual && f.inicio <= atual.inicio) throw new Error("O aditivo deve começar depois do início da vigência atual");
        const { data, error } = await db.from("loc_vigencias").insert({ ...vig, edificio_id: edificioId, contrato_id: linha.contrato_id, seq: (atual?.seq ?? -1) + 1, tipo: "aditivo" }).select("id").single();
        if (error) throw error; vigId = data.id;
      } else if (atual) {
        const { error } = await db.from("loc_vigencias").update(vig).eq("id", atual.id); if (error) throw error;
      }
      if (vigId) await gravarDegraus(vigId, degraus);
      const { error } = await db.from("loc_contratos").update({ dia_vencimento: n(f.dia), retencao_pct: n(f.ret) ?? 0, indice: f.indice, mes_reajuste: n(f.mes), data_fim: f.fim, ...(open === "aditivo" ? { data_inicio_vigente: f.inicio } : {}) }).eq("id", linha.contrato_id);
      if (error) throw error;
      toast({ title: open === "aditivo" ? "Aditivo cadastrado" : "Contrato atualizado" }); setOpen(""); recarregar();
    } catch (e: any) { toast({ title: "Não foi possível salvar", description: e.message, variant: "destructive" }); }
    setSalvando(false);
  };
  return <>
    <Button size="sm" variant="outline" onClick={() => abrir("editar")}>Editar</Button>
    <Button size="sm" variant="outline" onClick={() => abrir("aditivo")}>Novo aditivo</Button>
    <Dialog open={!!open} onOpenChange={(o) => !o && setOpen("")}><DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{open === "aditivo" ? "Novo aditivo" : "Editar contrato"} · {linha.unidades}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo label="Início *"><Input type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></Campo>
        <Campo label="Fim *"><Input type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></Campo>
        <Campo label="Valor mensal (R$) *"><Input inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Campo>
        <Campo label="Índice"><SelIndice value={f.indice} onChange={(v) => setF({ ...f, indice: v })} /></Campo>
        <Campo label="Mês de reajuste (1–12)"><Input type="number" min={1} max={12} value={f.mes} onChange={(e) => setF({ ...f, mes: e.target.value })} /></Campo>
        <Campo label="m² do contrato"><Input inputMode="decimal" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Campo>
        <Campo label="Dia de vencimento"><Input type="number" min={1} max={31} value={f.dia} onChange={(e) => setF({ ...f, dia: e.target.value })} /></Campo>
        <Campo label="Retenção %"><Input inputMode="decimal" value={f.ret} onChange={(e) => setF({ ...f, ret: e.target.value })} /></Campo>
      </div>
      <GradeDegraus itens={degraus} set={setDegraus} />
      <DialogFooter><Button variant="outline" onClick={() => setOpen("")}>Cancelar</Button><Button onClick={salvar} disabled={salvando}>Salvar</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}

export function NovoContrato({ edificioId, locatarios, unidades }: { edificioId: string; locatarios: any[]; unidades: any[] }) {
  const [open, setOpen] = useState(false);
  const vazio = { loc: "", novoLoc: "", dia: "5", indice: "IPCA", mes: "", ret: "0", inicio: "", fim: "", valor: "", area: "" };
  const [f, setF] = useState(vazio);
  const [uns, setUns] = useState<string[]>([]);
  const [degraus, setDegraus] = useState<Degrau[]>([]);
  const [salvando, setSalvando] = useState(false);
  const { toast } = useToast(); const recarregar = useRecarregar();
  const vagas = unidades.filter((u) => u.situacao !== "locada").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  const salvar = async () => {
    if ((!f.loc || (f.loc === "novo" && !f.novoLoc.trim())) || !uns.length || !f.inicio || !f.fim || !f.valor) return toast({ title: "Preencha locatário, unidades, início, fim e valor", variant: "destructive" });
    if (f.fim < f.inicio) return toast({ title: "O fim deve ser igual ou posterior ao início", variant: "destructive" });
    setSalvando(true);
    try {
      let locId = f.loc;
      if (f.loc === "novo") { const { data, error } = await db.from("loc_locatarios").insert({ nome: f.novoLoc.trim() }).select("id").single(); if (error) throw error; locId = data.id; }
      const { data: c, error } = await db.from("loc_contratos").insert({
        edificio_id: edificioId, locatario_id: locId, tipo: "locacao", status: "ativo", no_orcamento: false,
        data_inicio: f.inicio, data_inicio_vigente: f.inicio, data_fim: f.fim, dia_vencimento: n(f.dia), indice: f.indice, mes_reajuste: n(f.mes), retencao_pct: n(f.ret) ?? 0, valor_inicial: n(f.valor),
      }).select("id").single();
      if (error) throw error;
      const r1 = await db.from("loc_contrato_unidades").insert(uns.map((u) => ({ contrato_id: c.id, unidade_id: u, edificio_id: edificioId }))); if (r1.error) throw r1.error;
      const { data: v, error: e2 } = await db.from("loc_vigencias").insert({ edificio_id: edificioId, contrato_id: c.id, seq: 0, tipo: "contrato", inicio: f.inicio, fim: f.fim, valor_mensal: n(f.valor), area_contrato_m2: n(f.area), indice: f.indice, mes_reajuste: n(f.mes) }).select("id").single();
      if (e2) throw e2;
      await gravarDegraus(v.id, degraus);
      toast({ title: "Contrato cadastrado" }); setOpen(false); setF(vazio); setUns([]); setDegraus([]); recarregar();
    } catch (e: any) { toast({ title: "Não foi possível salvar", description: e.message, variant: "destructive" }); }
    setSalvando(false);
  };
  return <>
    <Button size="sm" onClick={() => setOpen(true)}>Novo contrato</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Novo contrato</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3 grid gap-3 sm:grid-cols-2">
          <Campo label="Locatário *"><Select value={f.loc} onValueChange={(v) => setF({ ...f, loc: v })}><SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
            <SelectContent><SelectItem value="novo">+ Novo locatário</SelectItem>{[...locatarios].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent></Select></Campo>
          {f.loc === "novo" && <Campo label="Nome do novo locatário *"><Input value={f.novoLoc} onChange={(e) => setF({ ...f, novoLoc: e.target.value })} /></Campo>}
        </div>
        <div className="sm:col-span-3 space-y-1"><Label className="text-xs">Unidades * (somente vagas)</Label>
          <div className="flex flex-wrap gap-3 rounded-md border p-3">{vagas.length === 0 ? <span className="text-xs text-muted-foreground">Nenhuma unidade vaga.</span> : vagas.map((u) =>
            <label key={u.unidade_id} className="flex items-center gap-2 text-[13px]"><Checkbox checked={uns.includes(u.unidade_id)} onCheckedChange={(c) => setUns(c ? [...uns, u.unidade_id] : uns.filter((x) => x !== u.unidade_id))} />{u.nome}</label>)}</div></div>
        <Campo label="Início *"><Input type="date" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></Campo>
        <Campo label="Fim *"><Input type="date" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></Campo>
        <Campo label="Valor mensal (R$) *"><Input inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Campo>
        <Campo label="Índice"><SelIndice value={f.indice} onChange={(v) => setF({ ...f, indice: v })} /></Campo>
        <Campo label="Mês de reajuste (1–12)"><Input type="number" min={1} max={12} value={f.mes} onChange={(e) => setF({ ...f, mes: e.target.value })} /></Campo>
        <Campo label="m² do contrato"><Input inputMode="decimal" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></Campo>
        <Campo label="Dia de vencimento"><Input type="number" min={1} max={31} value={f.dia} onChange={(e) => setF({ ...f, dia: e.target.value })} /></Campo>
        <Campo label="Retenção %"><Input inputMode="decimal" value={f.ret} onChange={(e) => setF({ ...f, ret: e.target.value })} /></Campo>
      </div>
      <GradeDegraus itens={degraus} set={setDegraus} />
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={salvar} disabled={salvando}>Salvar contrato</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}

function CondominioEditavel({ e }: { e: any }) {
  const [v, setV] = useState(""); const [ed, setEd] = useState(false);
  const { toast } = useToast(); const recarregar = useRecarregar();
  const gravar = async (valor: number) => {
    const { error } = await db.from("loc_contratos").update({ debito_condominio: valor }).eq("id", e.contrato_id);
    if (error) return toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    setEd(false); recarregar();
  };
  if (ed) return <div className="flex items-center justify-end gap-1"><Input className="h-7 w-28 text-right" inputMode="decimal" value={v} onChange={(x) => setV(x.target.value)} autoFocus />
    <Button size="sm" variant="outline" onClick={() => gravar(n(v) ?? 0)}>OK</Button></div>;
  return <div className="flex items-center justify-end gap-2"><span>{brl(e.debito_condominio)}</span>
    <Button size="sm" variant="ghost" onClick={() => { setV(String(e.debito_condominio ?? 0).replace(".", ",")); setEd(true); }}>Editar</Button>
    {Number(e.debito_condominio) > 0 && <Button size="sm" variant="ghost" onClick={() => gravar(0)}>Dar baixa</Button>}</div>;
}

export function ContratosEncerrados({ encerrados, admin }: { encerrados: any[]; admin: boolean }) {
  const linhas = [...(encerrados ?? [])].sort((a, b) => (b.data_saida ?? "").localeCompare(a.data_saida ?? ""));
  return <Bloco titulo="Contratos Encerrados" acao={<span className="text-xs text-muted-foreground">{linhas.length} contratos</span>}>
    {linhas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum contrato encerrado.</p> :
      <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Unidade", "Locatário", "Saída", "Aluguéis em aberto", "Condomínio em aberto", "Em pauta desde"].map((h, i) => <th key={h} className={cn(tableClasses.th, (i === 3 || i === 4) && "text-right")}>{h}</th>)}
      </tr></thead><tbody>{linhas.map((e) => <tr key={e.contrato_id}>
        <td className={cn(tableClasses.td, "font-medium zen-un")}>{e.unidades ?? "—"}</td>
        <td className={cn(tableClasses.td, "zen-txt")}>{e.locatario}</td>
        <td className={cn(tableClasses.td, "tabular-nums")}>{dt(e.data_saida)}</td>
        <td className={cn(tableClasses.num, Number(e.alugueis_em_aberto) > 0 && "text-destructive")}>{brl(e.alugueis_em_aberto)}</td>
        <td className={tableClasses.num}>{admin ? <CondominioEditavel e={e} /> : brl(e.debito_condominio)}</td>
        <td className={cn(tableClasses.td, "tabular-nums")}>{dt(e.data_em_pauta)}</td>
      </tr>)}</tbody></table></div>}
  </Bloco>;
}
