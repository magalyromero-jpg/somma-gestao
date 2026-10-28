import { Fragment, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Bloco, CORES, chartTooltipStyle } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MESES_LONGOS, brl, dt } from "@/lib/locacoes";
import { agruparLinhas, lerBoletos, mesesPlanejamento, pareceBoleto } from "@/lib/boletos";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
const db = supabase as any;
const pctTxt = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "—");
const nomeMes = (k: string) => `${MESES_LONGOS[Number(k.slice(5, 7)) - 1]}/${k.slice(0, 4)}`;

export function PlanejamentoCaixa({ data, admin }: { data: any; admin: boolean }) {
  const edificio = data.edificio.id as string;
  const hoje = new Date().toISOString().slice(0, 10);
  const ano = Number(hoje.slice(0, 4));
  const meses = mesesPlanejamento(hoje);
  const [aberto, setAberto] = useState<string | null>(null);
  const { data: q } = useQuery({
    queryKey: ["loc-planejamento", edificio, ano],
    queryFn: async () => {
      const [p, b] = await Promise.all([
        db.rpc("loc_planejamento_caixa", { p_edificio: edificio, p_ano: ano }),
        db.from("loc_boletos").select("id,nosso_numero,pagador,documento,contrato_id,data_vencimento,valor_titulo,status,atualizado_em").eq("edificio_id", edificio).limit(10000),
      ]);
      if (p.error) throw p.error; if (b.error) throw b.error;
      return { plan: p.data ?? [], boletos: b.data ?? [] };
    },
  });
  const info = useMemo(() => new Map<string, any>((data.contratosInfo ?? []).map((c: any) => [c.id, c])), [data.contratosInfo]);
  const plan = q?.plan ?? [];
  const linhas = meses.map((k) => {
    const rs = plan.filter((r: any) => String(r.mes).startsWith(k));
    const s = (f: (r: any) => number) => rs.reduce((t: number, r: any) => t + f(r), 0);
    const fora = s((r) => (r.fora_boleto ? Number(r.previsto) : 0));
    return { k, rs, previsto: s((r) => Number(r.previsto)), emitido: s((r) => Number(r.emitido)), fora, sem: s((r) => Number(r.sem_boleto)), aberto: s((r) => Number(r.em_aberto)) };
  });
  const tot = linhas.reduce((t, l) => ({ previsto: t.previsto + l.previsto, emitido: t.emitido + l.emitido, fora: t.fora + l.fora, sem: t.sem + l.sem }), { previsto: 0, emitido: 0, fora: 0, sem: 0 });
  const vencidos = (q?.boletos ?? []).filter((b: any) => b.status === "vencida" && String(b.data_vencimento).startsWith(String(ano)));
  const emAberto = vencidos.reduce((t: number, b: any) => t + Number(b.valor_titulo), 0);
  const atualizado = (q?.boletos ?? []).reduce((m: string, b: any) => (b.atualizado_em > m ? b.atualizado_em : m), "");

  const cards = [
    { l: "Previsto", v: tot.previsto, d: "Previsto contratual dos meses exibidos." },
    { l: "Já Emitido", v: tot.emitido, d: `Somente boletos com status A Vencer · ${pctTxt(tot.emitido, tot.previsto)} do Previsto.` },
    { l: "Sem Boleto", v: tot.sem, d: "Previsto menos tudo que já tem boleto não cancelado no mês." },
    { l: "Fora do Boleto", v: tot.fora, d: "Contratos que não pagam por boleto (Município de Itajaí e Bradesco)." },
    { l: "Em Aberto", v: emAberto, d: "Posição do arquivo importado." },
  ];

  return <div className="space-y-4">
    {admin && <Importacao edificio={edificio} contratos={data.contratosInfo ?? []} boletos={q?.boletos ?? []} />}
    {atualizado && <p className="text-xs text-muted-foreground">Atualizado em <span className="tabular-nums">{dt(atualizado.slice(0, 10))}</span></p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => <div key={c.l} title={c.d} className="rounded-md border bg-card p-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">{c.l}</div>
        <div className="mt-3 text-[26px] font-extralight leading-none tabular-nums">{brl(c.v)}</div>
      </div>)}
    </div>
    {!meses.length ? <p className="text-sm text-muted-foreground">Não há meses restantes no ano.</p> : <>
      <Bloco titulo="Planejamento por Mês">
        <div className="h-72"><ResponsiveContainer><BarChart data={linhas.map((l) => ({ mes: nomeMes(l.k), ...l }))}>
          <CartesianGrid vertical={false} stroke={CORES.borda} />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)} mil`} />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, n: any) => [brl(Number(v)), n]}
            labelFormatter={(lab: any, p: any) => `${lab} · ${pctTxt(p?.[0]?.payload?.emitido ?? 0, p?.[0]?.payload?.previsto ?? 0)} emitido`} />
          <Bar dataKey="emitido" name="Já Emitido" stackId="a" fill={CORES.marca} />
          <Bar dataKey="fora" name="Fora do Boleto" stackId="a" fill={CORES.ouro} />
          <Bar dataKey="sem" name="Sem Boleto" stackId="a" fill={CORES.cinza} />
        </BarChart></ResponsiveContainer></div>
      </Bloco>
      <Bloco titulo="Detalhe por Mês">
        <table className={tableClasses.table}><thead><tr className={tableClasses.head}>
          {["Mês", "Previsto", "Já Emitido", "% Emitido", "Fora do Boleto", "Sem Boleto", "Em Aberto"].map((h, i) => <th key={h} className={cn(tableClasses.th, i > 0 && "text-right")}>{h}</th>)}
        </tr></thead><tbody>
          {linhas.map((l) => <Fragment key={l.k}>
            <tr key={l.k} className="cursor-pointer hover:bg-muted/40" onClick={() => setAberto(aberto === l.k ? null : l.k)}>
              <td className={cn(tableClasses.td, "font-medium")}>{aberto === l.k ? "▾" : "▸"} {nomeMes(l.k)}</td>
              <td className={tableClasses.num}>{brl(l.previsto)}</td><td className={tableClasses.num}>{brl(l.emitido)}</td>
              <td className={tableClasses.num}>{pctTxt(l.emitido, l.previsto)}</td><td className={tableClasses.num}>{brl(l.fora)}</td>
              <td className={tableClasses.num}>{brl(l.sem)}</td><td className={tableClasses.num}>{brl(l.aberto)}</td>
            </tr>
            {aberto === l.k && <tr key={l.k + "d"}><td colSpan={7} className="bg-muted/20 p-3">
              <table className={tableClasses.table}><thead><tr className={tableClasses.head}>
                {["Unidade", "Locatário", "Previsto", "Emitido", "Sem Boleto", "Em Aberto"].map((h, i) => <th key={h} className={cn(tableClasses.th, i > 1 && "text-right")}>{h}</th>)}
              </tr></thead><tbody>{l.rs.filter((r: any) => Number(r.previsto) || Number(r.emitido) || Number(r.em_aberto))
                .map((r: any) => ({ ...r, c: info.get(r.contrato_id) }))
                .sort((a: any, b: any) => (a.c?.unidades ?? "").localeCompare(b.c?.unidades ?? "", "pt-BR", { numeric: true }))
                .map((r: any) => <tr key={r.contrato_id}>
                  <td className={tableClasses.td}>{r.c?.unidades ?? "—"}</td>
                  <td className={tableClasses.td}>{r.c?.locatario ?? "—"} {r.fora_boleto && <span className="op-tag op-tag-gray ml-1">Fora do Boleto</span>}</td>
                  <td className={tableClasses.num}>{brl(r.previsto)}</td><td className={tableClasses.num}>{brl(r.emitido)}</td>
                  <td className={tableClasses.num}>{brl(r.sem_boleto)}</td><td className={tableClasses.num}>{brl(r.em_aberto)}</td>
                </tr>)}</tbody></table>
            </td></tr>}
          </Fragment>)}
          <tr className="font-semibold"><td className={tableClasses.td}>Total</td>
            <td className={tableClasses.num}>{brl(tot.previsto)}</td><td className={tableClasses.num}>{brl(tot.emitido)}</td>
            <td className={tableClasses.num}>{pctTxt(tot.emitido, tot.previsto)}</td><td className={tableClasses.num}>{brl(tot.fora)}</td>
            <td className={tableClasses.num}>{brl(tot.sem)}</td><td className={tableClasses.num}>{brl(linhas.reduce((t, l) => t + l.aberto, 0))}</td></tr>
        </tbody></table>
      </Bloco>
    </>}
    {vencidos.length > 0 && <Bloco titulo="Em Aberto" acao={<span title="Posição do arquivo importado." className="text-xs text-muted-foreground">{brl(emAberto)}</span>}>
      <table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Pagador", "Unidade", "Vencimento", "Valor (R$)"].map((h, i) => <th key={h} className={cn(tableClasses.th, i === 3 && "text-right")}>{h}</th>)}
      </tr></thead><tbody>{vencidos.sort((a: any, b: any) => a.data_vencimento.localeCompare(b.data_vencimento)).map((b: any) => <tr key={b.id}>
        <td className={tableClasses.td}>{b.pagador}</td><td className={tableClasses.td}>{info.get(b.contrato_id)?.unidades ?? "—"}</td>
        <td className={cn(tableClasses.td, "tabular-nums")}>{dt(b.data_vencimento)}</td><td className={tableClasses.num}>{brl(b.valor_titulo)}</td>
      </tr>)}</tbody></table>
    </Bloco>}
  </div>;
}

function Importacao({ edificio, contratos, boletos }: { edificio: string; contratos: any[]; boletos: any[] }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const semVinculo = useMemo(() => {
    const m = new Map<string, { pagador: string; documento: string; n: number }>();
    for (const b of boletos) if (!b.contrato_id && b.documento) {
      const x = m.get(b.documento) ?? { pagador: b.pagador, documento: b.documento, n: 0 }; x.n++; m.set(b.documento, x);
    }
    return [...m.values()];
  }, [boletos]);
  const opcoes = [...contratos].sort((a, b) => a.unidades.localeCompare(b.unidades, "pt-BR", { numeric: true }));
  const recarregar = () => qc.invalidateQueries({ queryKey: ["loc-planejamento"] });

  async function importar(f: File) {
    if (!f.name.toLowerCase().endsWith(".pdf")) { setMsg("Envie somente arquivo .pdf."); return; }
    setOcupado(true); setMsg(null);
    try {
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
      const linhas: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        linhas.push(...agruparLinhas((tc.items as any[]).filter((i) => typeof i.str === "string").map((i) => {
          const t = pdfjsLib.Util.transform(vp.transform, i.transform);
          return { str: i.str, x: t[4], y: t[5] };
        })));
      }
      const lidos = lerBoletos(linhas);
      if (!lidos.length) { setMsg("Não reconheci o formato deste PDF. Envie a exportação de movimentações de cobrança do banco."); return; }
      const naoLidas = linhas.filter(pareceBoleto).length - lidos.length;
      const { data, error } = await db.rpc("loc_importar_boletos", { p_edificio: edificio, p_boletos: lidos, p_arquivo: f.name });
      if (error) throw error;
      setMsg(`${lidos.length} Boletos Lidos · ${data.novos} Novos · ${data.atualizados} Atualizados · ${data.sem_vinculo} Sem Vínculo${naoLidas > 0 ? ` · ${naoLidas} linhas não foram lidas` : ""}`);
      recarregar();
    } catch (e: any) { setMsg(`Não foi possível importar: ${e.message ?? e}`); }
    finally { setOcupado(false); if (input.current) input.current.value = ""; }
  }

  async function vincular(documento: string) {
    const contrato = escolha[documento]; if (!contrato) return;
    setOcupado(true);
    const a = await db.from("loc_pagador_vinculo").upsert({ edificio_id: edificio, documento, contrato_id: contrato });
    const b = a.error ? a : await db.from("loc_boletos").update({ contrato_id: contrato }).eq("edificio_id", edificio).eq("documento", documento);
    setOcupado(false);
    if (b.error) setMsg(`Não foi possível vincular: ${b.error.message}`); else recarregar();
  }

  return <Bloco titulo="Anexar Exportação de Boletos">
    <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) importar(f); }}
      onClick={() => input.current?.click()}
      className="cursor-pointer rounded-md border-2 border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/30">
      {ocupado ? "Lendo…" : "Arraste o PDF aqui ou clique para escolher"}
      <input ref={input} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
    </div>
    {msg && <p className="mt-3 text-sm">{msg}</p>}
    {semVinculo.length > 0 && <div className="mt-4 space-y-2">
      <h4 className="text-sm font-semibold">Pagadores Sem Vínculo</h4>
      {semVinculo.map((p) => <div key={p.documento} className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{p.pagador}</span><span className="text-muted-foreground tabular-nums">{p.documento} · {p.n} boletos</span>
        <select className="h-8 rounded-md border bg-background px-2 text-sm" value={escolha[p.documento] ?? ""} onChange={(e) => setEscolha({ ...escolha, [p.documento]: e.target.value })}>
          <option value="">Contrato…</option>
          {opcoes.map((c) => <option key={c.id} value={c.id}>{c.unidades} · {c.locatario}</option>)}
        </select>
        <Button size="sm" variant="outline" disabled={!escolha[p.documento] || ocupado} onClick={() => vincular(p.documento)}>Vincular</Button>
      </div>)}
    </div>}
  </Bloco>;
}
