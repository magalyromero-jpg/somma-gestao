import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Bloco } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { EditarContrato } from "@/components/locacoes/GestaoContratos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MESES_LONGOS, brl, dt, indiceLabel } from "@/lib/locacoes";
import { RENOVACAO_LABEL, STATUS_LABEL, TIPO_LABEL, TIPO_LETRA, filtrar, itensAviso, mesDe, ordenar, pendentesAnteriores, type EventoAgenda, type FiltroAgenda } from "@/lib/agenda";

const db = supabase as any;
const hojeStr = () => new Date().toISOString().slice(0, 10);
const titulo = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const mesTitulo = (k: string) => { const [y, m] = k.split("-").map(Number); return `${titulo(MESES_LONGOS[m - 1])}/${y}`; };
const addM = (k: string, n: number) => { const [y, m] = k.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return t.toISOString().slice(0, 7); };
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(/\./g, "").replace(",", ".")));
const fmt = (v: number | null | undefined) => (v == null ? "" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function useAgenda(edificioId: string) {
  return useQuery({
    queryKey: ["loc-agenda", edificioId], enabled: !!edificioId,
    queryFn: async () => {
      const [ev, nt] = await Promise.all([
        db.from("loc_v_agenda_contratos").select("*").eq("edificio_id", edificioId).order("data_evento"),
        db.from("loc_v_agenda_notificacao").select("*").eq("edificio_id", edificioId).maybeSingle(),
      ]);
      if (ev.error) throw ev.error; if (nt.error) throw nt.error;
      return { eventos: (ev.data ?? []) as EventoAgenda[], notif: nt.data ?? { pendentes: 0, em_andamento: 0, vencem_60_dias: 0, reajustes_realizados_ano: 0, renovacoes_realizadas_ano: 0 } };
    },
  });
}

export const contadorAviso = (n: any) => Number(n?.pendentes ?? 0) + Number(n?.vencem_60_dias ?? 0);

function Tile({ label, valor, dica, ativo, onClick }: { label: string; valor: number | string; dica?: string; ativo?: boolean; onClick?: () => void }) {
  return <button type="button" title={dica} onClick={onClick} className={cn("rounded-md border bg-card p-5 text-left transition-colors hover:border-primary", ativo && "border-primary")}>
    <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">{label}</div>
    <div className="mt-3 text-[32px] font-extralight leading-none tabular-nums text-foreground">{valor}</div>
  </button>;
}
const lista = (evs: EventoAgenda[]) => evs.map((e) => `${e.unidades ?? "—"} · ${TIPO_LABEL[e.tipo]} · ${dt(e.data_evento)}`).join("\n") || "Nenhum item";

export function SituacaoTag({ s, renov }: { s: EventoAgenda["status"]; renov?: boolean }) {
  return <span className={cn("agenda-tag", `agenda-${s}`, "agenda-ev w-auto inline-block")}>{(renov ? RENOVACAO_LABEL : STATUS_LABEL)[s]}</span>;
}

/** Bloco da aba Reajustes: tiles, calendário e lista do mês. */
export function AgendaReajustes({ edificioId, admin, filtroInicial, onAbrir }: { edificioId: string; admin: boolean; filtroInicial?: FiltroAgenda; onAbrir: (e: EventoAgenda) => void }) {
  const { data, isLoading } = useAgenda(edificioId);
  const hoje = hojeStr();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [filtro, setFiltro] = useState<FiltroAgenda>(filtroInicial ?? "todos");
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const evs = data?.eventos ?? [];
  const n = data?.notif as any;
  const doMes = evs.filter((e) => mesDe(e.data_evento) === mes);
  const itens = ordenar(filtrar(evs, mes, filtro, hoje));
  const anteriores = pendentesAnteriores(evs, mes);
  const ano = hoje.slice(0, 4);

  const [y, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const dias = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const celulas: (number | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  while (celulas.length % 7) celulas.push(null);
  const porDia = (d: number) => ordenar(doMes.filter((e) => Number(e.data_evento.slice(8, 10)) === d));

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando agenda...</p>;
  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile label="Pendentes" valor={n?.pendentes ?? 0} dica={lista(evs.filter((e) => e.status === "pendente"))} ativo={filtro === "anteriores"} onClick={() => setFiltro("anteriores")} />
      <Tile label="Em Andamento" valor={n?.em_andamento ?? 0} dica={lista(evs.filter((e) => e.status === "em_andamento"))} ativo={filtro === "em_andamento"} onClick={() => setFiltro("em_andamento")} />
      <Tile label="Vencem em 60 Dias" valor={n?.vencem_60_dias ?? 0} dica={lista(filtrar(evs, mes, "a_vencer_60", hoje))} ativo={filtro === "a_vencer_60"} onClick={() => setFiltro("a_vencer_60")} />
      <Tile label="Realizados no Ano" valor={Number(n?.reajustes_realizados_ano ?? 0) + Number(n?.renovacoes_realizadas_ano ?? 0)} dica={`Reajustes ${n?.reajustes_realizados_ano ?? 0} · Renovações ${n?.renovacoes_realizadas_ano ?? 0} (${ano})`} ativo={filtro === "realizado_ano"} onClick={() => setFiltro("realizado_ano")} />
    </div>

    <Bloco titulo={`Agenda de Reajustes e Renovações · ${mesTitulo(mes)}`} acao={<div className="flex items-center gap-1">
      <Button size="icon" variant="outline" aria-label="Mês anterior" onClick={() => setMes(addM(mes, -1))}><ChevronLeft className="h-4 w-4" /></Button>
      <Button size="sm" variant="outline" onClick={() => setMes(hoje.slice(0, 7))}>Mês Atual</Button>
      <Button size="icon" variant="outline" aria-label="Mês seguinte" onClick={() => setMes(addM(mes, 1))}><ChevronRight className="h-4 w-4" /></Button>
    </div>}>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-sm border bg-border text-xs">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="bg-muted px-2 py-1 font-medium text-muted-foreground">{d}</div>)}
        {celulas.map((d, i) => {
          const es = d ? porDia(d) : [];
          const k = d ? `${mes}-${String(d).padStart(2, "0")}` : "";
          return <div key={i} className={cn("min-h-[84px] space-y-0.5 bg-card p-1", k === hoje && "ring-1 ring-inset ring-primary")}>
            {d && <div className="text-[11px] tabular-nums text-muted-foreground">{d}</div>}
            {es.slice(0, 3).map((e) => <button key={e.contrato_id + e.tipo} type="button" title={`${e.unidades} · ${e.locatario} · ${TIPO_LABEL[e.tipo]} · ${STATUS_LABEL[e.status]}`} className={cn("agenda-ev", `agenda-${e.status}`)} onClick={() => onAbrir(e)}>
              <b>{TIPO_LETRA[e.tipo]}</b> {e.unidades}
            </button>)}
            {es.length > 3 && <Popover open={diaAberto === k} onOpenChange={(o) => setDiaAberto(o ? k : null)}>
              <PopoverTrigger asChild><button type="button" className="text-[11px] font-medium text-primary">+{es.length - 3}</button></PopoverTrigger>
              <PopoverContent className="w-72 space-y-1">
                <div className="text-xs font-medium">{dt(k)}</div>
                {es.map((e) => <button key={e.contrato_id + e.tipo} type="button" className={cn("agenda-ev", `agenda-${e.status}`)} onClick={() => { setDiaAberto(null); onAbrir(e); }}><b>{TIPO_LETRA[e.tipo]}</b> {e.unidades}</button>)}
              </PopoverContent>
            </Popover>}
          </div>;
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span><b>R</b> Reajuste</span><span><b>D</b> Degrau do Contrato</span><span><b>N</b> Renovação</span>
        {(["pendente", "a_vencer", "em_andamento", "realizado", "dispensado"] as const).map((s) => <span key={s} className="inline-flex items-center gap-1"><span className={cn("inline-block h-3 w-3 rounded-sm", `agenda-${s}`)} style={{ borderWidth: 1 }} />{STATUS_LABEL[s]}</span>)}
      </div>
    </Bloco>

    <Bloco titulo={filtro === "anteriores" ? "Pendentes" : filtro === "a_vencer_60" ? "Vencem em 60 Dias" : filtro === "realizado_ano" ? `Realizados em ${ano}` : `Eventos de ${mesTitulo(mes)}`} acao={<div className="flex flex-wrap gap-1">
      {([["todos", "Todos"], ["pendente", "Pendentes"], ["em_andamento", "Em Andamento"], ["realizado", "Realizados"]] as const).map(([k, l]) =>
        <Button key={k} size="sm" variant={filtro === k ? "default" : "outline"} onClick={() => setFiltro(k)}>{l}</Button>)}
    </div>}>
      {anteriores.length > 0 && filtro !== "anteriores" && <button type="button" onClick={() => setFiltro("anteriores")} className="mb-3 w-full rounded-sm border border-destructive/40 bg-destructive/5 px-3 py-2 text-left text-sm text-destructive">
        {anteriores.length} {anteriores.length === 1 ? "Pendente de Meses Anteriores" : "Pendentes de Meses Anteriores"}
      </button>}
      {itens.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento.</p> :
        <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
          {["Data", "Unidade", "Locatário", "Tipo", "Índice", "Valor Atual", "Novo Valor", "Situação", ""].map((h, i) => <th key={i} className={cn(tableClasses.th, (i === 5 || i === 6) && "text-right")}>{h}</th>)}
        </tr></thead><tbody>{itens.map((e) => <tr key={e.contrato_id + e.tipo + e.data_evento}>
          <td className={cn(tableClasses.td, "tabular-nums")}>{dt(e.data_evento)}</td>
          <td className={cn(tableClasses.td, "font-medium zen-un")}>{e.unidades ?? "—"}</td>
          <td className={cn(tableClasses.td, "zen-txt")}>{e.locatario ?? "—"}</td>
          <td className={tableClasses.td}>{TIPO_LABEL[e.tipo]}</td>
          <td className={tableClasses.td}>{e.indice ? indiceLabel(e.indice) : "—"}</td>
          <td className={tableClasses.num}>{brl(e.valor_atual)}</td>
          <td className={tableClasses.num}>{e.tipo === "renovacao" ? (e.status === "realizado" && e.valor_novo != null ? brl(e.valor_novo) : "—") : e.valor_novo != null ? brl(e.valor_novo) : e.valor_sugerido != null ? <span className="text-muted-foreground" title="Sugerido pelo índice">{brl(e.valor_sugerido)}</span> : "—"}</td>
          <td className={tableClasses.td}><SituacaoTag s={e.status} /></td>
          <td className={tableClasses.td}><Button size="sm" variant="outline" onClick={() => onAbrir(e)}>{admin ? "Registrar" : "Ver"}</Button></td>
        </tr>)}</tbody></table></div>}
    </Bloco>
  </div>;
}

const Campo = ({ l, children }: { l: string; children: React.ReactNode }) => <div className="space-y-1"><Label className="text-xs">{l}</Label>{children}</div>;

/** Painel Registrar (somente leitura para quem não é admin). */
export function PainelRegistrar({ evento, admin, linha, vigencias, edificioId, onClose }: { evento: EventoAgenda | null; admin: boolean; linha: any; vigencias: any[]; edificioId: string; onClose: () => void }) {
  const e = evento;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [f, setF] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [aditivo, setAditivo] = useState(false);
  const docs = useQuery({
    queryKey: ["loc-agenda-docs", e?.contrato_id], enabled: !!e,
    queryFn: async () => { const r = await db.from("loc_documentos").select("id,titulo,tipo").eq("contrato_id", e!.contrato_id).order("created_at", { ascending: false }); if (r.error) throw r.error; return r.data ?? []; },
  });
  const chave = e ? e.contrato_id + e.tipo + e.data_evento : "";
  const [ultima, setUltima] = useState("");
  if (e && chave !== ultima) {
    setUltima(chave);
    setF({
      mes_ref: e.mes_referencia ?? "", pct: e.percentual_sugerido != null ? fmt(e.percentual_sugerido) : "",
      valor: e.tipo === "renovacao" ? (e.status === "realizado" && e.valor_novo != null ? fmt(e.valor_novo) : "") : fmt(e.valor_novo ?? e.valor_sugerido),
      vig: e.vigencia_sugerida ?? "", fim: "", doc: e.documento_id ?? "", obs: e.observacao ?? "",
    });
    setAditivo(false);
  }
  const set = (k: string) => (ev: any) => setF({ ...f, [k]: ev.target.value });
  const atualizarTudo = () => qc.invalidateQueries();
  const registrar = async (status: "realizado" | "em_andamento" | "dispensado") => {
    if (!e) return;
    if (status === "dispensado" && !f.obs?.trim()) return toast({ title: "Informe a observação para dispensar", variant: "destructive" });
    setSalvando(true);
    const { error } = await db.rpc("loc_registrar_agenda", {
      p_contrato: e.contrato_id, p_tipo: e.tipo, p_data_evento: e.data_evento, p_status: status,
      p_valor_novo: e.tipo === "renovacao" && status !== "realizado" ? null : num(f.valor ?? ""), p_vigencia_a_partir: f.vig || null, p_nova_data_fim: f.fim || null,
      p_indice: e.indice, p_percentual: num(f.pct ?? ""), p_documento: f.doc || null, p_observacao: f.obs?.trim() || null,
    });
    setSalvando(false);
    if (error) { toast({ title: "Não foi possível registrar", description: error.message, variant: "destructive" }); return false; }
    toast({ title: `Registrado como ${STATUS_LABEL[status]}` });
    await atualizarTudo(); onClose(); return true;
  };
  const marcarRealizado = () => {
    if (e?.tipo === "renovacao") {
      if (!f.fim || !f.valor || !f.vig) return toast({ title: "Preencha Nova Data Fim, Novo Valor e Início do Novo Valor", variant: "destructive" });
      setAditivo(true); return;
    }
    registrar("realizado");
  };
  const ro = !admin;
  const docSel = <Campo l="Documento"><Select value={f.doc || "nenhum"} onValueChange={(v) => setF({ ...f, doc: v === "nenhum" ? "" : v })} disabled={ro}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent><SelectItem value="nenhum">Sem documento</SelectItem>{(docs.data ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.titulo}</SelectItem>)}</SelectContent>
  </Select><p className="text-[11px] text-muted-foreground">Para anexar um novo, use a aba Documentos e depois escolha aqui.</p></Campo>;

  return <>
    <Dialog open={!!e && !aditivo} onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-xl">
      {e && <>
        <DialogHeader><DialogTitle>{TIPO_LABEL[e.tipo]} · {e.unidades}</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span>{e.locatario}</span><span>· {dt(e.data_evento)}</span><SituacaoTag s={e.status} /></div>
        {e.tipo === "reajuste" && e.indice_estimado && <p className="rounded-sm border border-warning/50 bg-warning/10 px-3 py-2 text-sm">Índice do mês ainda não divulgado, valor provisório.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {e.tipo === "reajuste" && <>
            <Campo l="Índice"><Input value={e.indice ? indiceLabel(e.indice) : "—"} readOnly /></Campo>
            <Campo l="Mês de Referência"><Input type="date" value={f.mes_ref} onChange={set("mes_ref")} readOnly={ro} /></Campo>
            <Campo l="Percentual (%)"><Input inputMode="decimal" value={f.pct} onChange={set("pct")} readOnly={ro} /></Campo>
            <Campo l="Novo Valor (R$)"><Input inputMode="decimal" value={f.valor} onChange={set("valor")} readOnly={ro} /></Campo>
            <Campo l="Início da Vigência"><Input type="date" value={f.vig} onChange={set("vig")} readOnly={ro} /></Campo>
            {docSel}
          </>}
          {e.tipo === "degrau" && <Campo l="Valor Confirmado (R$)"><Input inputMode="decimal" value={f.valor} onChange={set("valor")} readOnly={ro} /></Campo>}
          {e.tipo === "renovacao" && <>
            <Campo l="Nova Data Fim"><Input type="date" value={f.fim} onChange={set("fim")} readOnly={ro} /></Campo>
            <Campo l="Novo Valor (R$)"><Input inputMode="decimal" value={f.valor} onChange={set("valor")} readOnly={ro} placeholder="Informe após a assinatura do aditivo" /><p className="text-[11px] text-muted-foreground">Informe após a assinatura do aditivo.</p></Campo>
            <Campo l="Início do Novo Valor"><Input type="date" value={f.vig} onChange={set("vig")} readOnly={ro} /></Campo>
            {docSel}
          </>}
        </div>
        <Campo l="Observação"><Textarea value={f.obs} onChange={set("obs")} readOnly={ro} rows={3} /></Campo>
        <p className="text-xs text-muted-foreground">Valor Atual {brl(e.valor_atual)}{e.valor_sugerido != null && ` · Sugerido pelo índice ${brl(e.valor_sugerido)}`}. O Orçado não muda.</p>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>{admin ? "Cancelar" : "Fechar"}</Button>
          {admin && <>
            <Button variant="outline" disabled={salvando} onClick={() => registrar("dispensado")}>Dispensar</Button>
            <Button variant="outline" disabled={salvando} onClick={() => registrar("em_andamento")}>Em Andamento</Button>
            <Button disabled={salvando} onClick={marcarRealizado}>Marcar Realizado</Button>
          </>}
        </DialogFooter>
      </>}
    </DialogContent></Dialog>
    {e && aditivo && linha && <EditarContrato key={chave} linha={linha} vigencias={vigencias} edificioId={edificioId}
      aditivo={{ inicio: f.vig, fim: f.fim, valor: f.valor.replace(/\./g, "") }}
      onSalvo={async () => { await registrar("realizado"); }}
      onFechar={() => setAditivo(false)} />}
  </>;
}

/** Sino do cabeçalho com o contador de avisos. */
export function SinoAgenda({ edificioId, onAbrir }: { edificioId: string; onAbrir: (e: EventoAgenda) => void }) {
  const { data } = useAgenda(edificioId);
  const [open, setOpen] = useState(false);
  const itens = useMemo(() => itensAviso(data?.eventos ?? [], hojeStr()), [data]);
  const n = contadorAviso(data?.notif);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="outline" size="sm" aria-label="Avisos de reajustes e renovações" className="relative">
      <Bell className="h-4 w-4" />{n > 0 && <span className="ml-1 rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">{n}</span>}
    </Button></PopoverTrigger>
    <PopoverContent align="end" className="w-96 max-w-[90vw] p-2">
      <div className="px-2 pb-2 text-sm font-medium">Reajustes e Renovações</div>
      {itens.length === 0 ? <p className="px-2 pb-2 text-sm text-muted-foreground">Nenhum item pendente.</p> :
        <div className="max-h-96 space-y-1 overflow-y-auto">{itens.map((e) => <button key={e.contrato_id + e.tipo + e.data_evento} type="button" onClick={() => { setOpen(false); onAbrir(e); }}
          className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted">
          <span><span className="font-medium">{e.unidades}</span><br /><span className="text-muted-foreground">{TIPO_LABEL[e.tipo]} · {dt(e.data_evento)}</span></span>
          <SituacaoTag s={e.status} />
        </button>)}</div>}
    </PopoverContent>
  </Popover>;
}

/** Bloco da Visão Geral. */
export function BlocoAgendaVisaoGeral({ edificioId, onIr }: { edificioId: string; onIr: (f: FiltroAgenda) => void }) {
  const { data } = useAgenda(edificioId);
  const evs = data?.eventos ?? []; const n = data?.notif as any; const hoje = hojeStr(); const ano = hoje.slice(0, 4);
  const doAno = (t: string) => evs.filter((e) => e.status === "realizado" && e.tipo === t && e.data_evento.startsWith(ano));
  return <Bloco titulo="Reajustes e Renovações">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile label="Reajustes Realizados no Ano" valor={n?.reajustes_realizados_ano ?? 0} dica={lista(doAno("reajuste"))} onClick={() => onIr("realizado_ano")} />
      <Tile label="Renovações Realizadas no Ano" valor={n?.renovacoes_realizadas_ano ?? 0} dica={lista(doAno("renovacao"))} onClick={() => onIr("realizado_ano")} />
      <Tile label="Pendentes" valor={n?.pendentes ?? 0} dica={lista(evs.filter((e) => e.status === "pendente"))} onClick={() => onIr("anteriores")} />
      <Tile label="Vencem em 60 Dias" valor={n?.vencem_60_dias ?? 0} dica={lista(filtrar(evs, hoje.slice(0, 7), "a_vencer_60", hoje))} onClick={() => onIr("a_vencer_60")} />
    </div>
  </Bloco>;
}

export function FaixaPendentes({ edificioId, onIr }: { edificioId: string; onIr: () => void }) {
  const { data } = useAgenda(edificioId);
  const p = Number((data?.notif as any)?.pendentes ?? 0);
  if (!p) return null;
  return <button type="button" onClick={onIr} className="w-full rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-left text-sm text-destructive">
    {p} {p === 1 ? "Item Pendente" : "Itens Pendentes"} de Reajuste ou Renovação · <span className="underline">Abrir Reajustes</span>
  </button>;
}
