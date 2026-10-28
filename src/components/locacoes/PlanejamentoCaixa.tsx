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
import { BoletosConferir } from "./BoletosConferir";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
const db = supabase as any;
const pctTxt = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "—");
const DICA_ATUAL = "Mês em andamento: o que já foi pago está no Realizado.";
const nomeMes = (k: string) => `${MESES_LONGOS[Number(k.slice(5, 7)) - 1]}/${k.slice(0, 4)}`;

export function PlanejamentoCaixa({ data, admin }: { data: any; admin: boolean }) {
  const edificio = data.edificio.id as string;
  const hoje = new Date().toISOString().slice(0, 10);
  const ano = Number(hoje.slice(0, 4));
  const atual = hoje.slice(0, 7);
  const meses = mesesPlanejamento(hoje);
  const [aberto, setAberto] = useState<string | null>(null);
  const { data: q, error: erroConsulta } = useQuery({
    queryKey: ["loc-planejamento", edificio, ano],
    queryFn: async () => {
      const [p, b, o, conferir] = await Promise.all([
        db.rpc("loc_planejamento_caixa", { p_edificio: edificio, p_ano: ano }),
        db.from("loc_boletos").select("id,nosso_numero,pagador,documento,contrato_id,outra_receita,natureza,descricao,data_vencimento,valor_titulo,status,atualizado_em").eq("edificio_id", edificio).limit(10000),
        db.rpc("loc_planejamento_outras", { p_edificio: edificio, p_ano: ano }),
        db.from("loc_v_boletos_a_conferir").select("*").eq("edificio_id", edificio).order("data_vencimento"),
      ]);
      if (p.error) throw p.error; if (b.error) throw b.error; if (o.error) throw o.error;
      if (conferir.error) throw conferir.error;
      return { plan: p.data ?? [], boletos: b.data ?? [], outras: o.data ?? [], conferir: conferir.data ?? [] };
    },
  });
  const info = useMemo(() => new Map<string, any>((data.contratosInfo ?? []).map((c: any) => [c.id, c])), [data.contratosInfo]);
  const nomesOutras = useMemo(() => [...new Set<string>((data.pags ?? []).filter((p: any) => !p.contrato_id && p.imovel_nome)
    .map((p: any) => String(p.imovel_nome).replace(/^Zen Tower\s*-\s*/i, "").trim()))].sort((a, b) => a.localeCompare(b, "pt-BR")), [data.pags]);
  const plan = q?.plan ?? [];
  const outras = q?.outras ?? [];
  const linhas = meses.map((k) => {
    const corrente = k === atual;
    const rs = plan.filter((r: any) => String(r.mes).startsWith(k));
    const os = outras.filter((r: any) => String(r.mes).startsWith(k) && Number(r.emitido) > 0);
    const s = (f: (r: any) => number) => rs.reduce((t: number, r: any) => t + f(r), 0);
    const outrasV = os.reduce((t: number, r: any) => t + Number(r.emitido), 0);
    const previsto = corrente ? 0 : s((r) => Number(r.previsto));
    const emitido = s((r) => Number(r.emitido));
    return { k, corrente, rs, os, previsto, emitido, fora: corrente ? 0 : s((r) => (r.fora_boleto ? Number(r.previsto) : 0)),
      sem: corrente ? 0 : s((r) => Number(r.sem_boleto)), outras: outrasV,
      aberto: s((r) => Number(r.em_aberto)) + outras.filter((r: any) => String(r.mes).startsWith(k)).reduce((t: number, r: any) => t + Number(r.em_aberto), 0),
      caixa: (corrente ? emitido : previsto) + outrasV };
  });
  const soma = (f: (l: any) => number) => linhas.reduce((t, l) => t + f(l), 0);
  const tot = { previsto: soma((l) => l.previsto), emitido: soma((l) => l.emitido), fora: soma((l) => l.fora), sem: soma((l) => l.sem), outras: soma((l) => l.outras), caixa: soma((l) => l.caixa), aberto: soma((l) => l.aberto) };
  const futuros = linhas.filter((l) => !l.corrente);
  const emitFut = futuros.reduce((t, l) => t + l.emitido, 0);
  const porOutra = new Map<string, number>();
  for (const l of linhas) for (const r of l.os) porOutra.set(r.outra_receita, (porOutra.get(r.outra_receita) ?? 0) + Number(r.emitido));
  const vencidos = (q?.boletos ?? []).filter((b: any) => b.status === "vencida" && String(b.data_vencimento).startsWith(String(ano)));
  const emAberto = vencidos.reduce((t: number, b: any) => t + Number(b.valor_titulo), 0);
  const atualizado = (q?.boletos ?? []).reduce((m: string, b: any) => (b.atualizado_em > m ? b.atualizado_em : m), "");
  const dicaOutra = (nome: string, mes?: string) => (q?.boletos ?? [])
    .filter((b: any) => (b.outra_receita ?? (b.natureza === "outros" ? "Outros Boletos" : null)) === nome && (!mes || String(b.data_vencimento).startsWith(mes)) && b.descricao)
    .map((b: any) => `${b.nosso_numero}: ${b.descricao}`).join(" · ");
  const traco = (l: any, v: number) => l.corrente ? <span title={DICA_ATUAL}>—</span> : brl(v);

  const cards = [
    { l: "Previsto", v: tot.previsto, d: "Previsto contratual dos meses seguintes." },
    { l: "Já Emitido", v: tot.emitido, d: `Somente boletos com status A Vencer · ${pctTxt(emitFut, tot.previsto)} do Previsto dos meses seguintes.` },
    { l: "Sem Boleto", v: tot.sem, d: "Previsto menos tudo que já tem boleto não cancelado no mês." },
    { l: "Fora do Boleto", v: tot.fora, d: "Contratos que não pagam por boleto (Município de Itajaí e Bradesco)." },
    { l: "Outras Receitas", v: tot.outras, d: porOutra.size ? [...porOutra].map(([n, v]) => `${n}: ${brl(v)}${dicaOutra(n) ? ` · ${dicaOutra(n)}` : ""}`).join(" · ") : "Nenhum boleto A Vencer de Outras Receitas." },
    { l: "Em Aberto", v: emAberto, d: "Posição do arquivo importado." },
  ];

  return <div className="space-y-4">
    {admin && <Importacao edificio={edificio} contratos={data.contratosInfo ?? []} outras={nomesOutras} boletos={q?.boletos ?? []} />}
    {erroConsulta && <p role="alert" className="text-sm text-destructive">Não foi possível consultar os boletos: {erroConsulta.message}</p>}
    <BoletosConferir edificio={edificio} itens={q?.conferir ?? []} info={info} admin={admin} />
    {atualizado && <p className="text-xs text-muted-foreground">Atualizado em <span className="tabular-nums">{dt(atualizado.slice(0, 10))}</span></p>}
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => <div key={c.l} title={c.d} className="rounded-md border bg-card p-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">{c.l}</div>
        <div className="mt-3 text-[24px] font-extralight leading-none tabular-nums">{brl(c.v)}</div>
      </div>)}
    </div>
    <Bloco titulo="Planejamento por Mês">
      <div className="h-72"><ResponsiveContainer><BarChart data={linhas.map((l) => ({ mes: nomeMes(l.k), ...l }))}>
        <CartesianGrid vertical={false} stroke={CORES.borda} />
        <XAxis dataKey="mes" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)} mil`} />
        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, n: any) => [brl(Number(v)), n]}
          labelFormatter={(lab: any, p: any) => { const x = p?.[0]?.payload; return x?.corrente ? `${lab} · mês em andamento` : `${lab} · ${pctTxt(x?.emitido ?? 0, x?.previsto ?? 0)} emitido`; }} />
        <Bar dataKey="emitido" name="Já Emitido" stackId="a" fill={CORES.marca} />
        <Bar dataKey="fora" name="Fora do Boleto" stackId="a" fill={CORES.ouro} />
        <Bar dataKey="sem" name="Sem Boleto" stackId="a" fill={CORES.cinza} />
        <Bar dataKey="outras" name="Outras Receitas" stackId="a" fill={CORES.verde} />
      </BarChart></ResponsiveContainer></div>
    </Bloco>
    <Bloco titulo="Detalhe por Mês">
      <table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Mês", "Previsto", "Já Emitido", "% Emitido", "Fora do Boleto", "Sem Boleto", "Outras Receitas", "Caixa Planejado", "Em Aberto"].map((h, i) => <th key={h} className={cn(tableClasses.th, i > 0 && "text-right")}>{h}</th>)}
      </tr></thead><tbody>
        {linhas.map((l) => <Fragment key={l.k}>
          <tr className="cursor-pointer hover:bg-muted/40" onClick={() => setAberto(aberto === l.k ? null : l.k)}>
            <td className={cn(tableClasses.td, "font-medium")}>{aberto === l.k ? "▾" : "▸"} {nomeMes(l.k)}</td>
            <td className={tableClasses.num}>{traco(l, l.previsto)}</td><td className={tableClasses.num}>{brl(l.emitido)}</td>
            <td className={tableClasses.num}>{l.corrente ? <span title={DICA_ATUAL}>—</span> : pctTxt(l.emitido, l.previsto)}</td><td className={tableClasses.num}>{traco(l, l.fora)}</td>
            <td className={tableClasses.num}>{traco(l, l.sem)}</td><td className={tableClasses.num}>{brl(l.outras)}</td>
            <td className={tableClasses.num}>{brl(l.caixa)}</td><td className={tableClasses.num}>{brl(l.aberto)}</td>
          </tr>
          {aberto === l.k && <tr><td colSpan={9} className="bg-muted/20 p-3 space-y-3">
            <table className={tableClasses.table}><thead><tr className={tableClasses.head}>
              {["Unidade", "Locatário", "Previsto", "Emitido", "Sem Boleto", "Em Aberto"].map((h, i) => <th key={h} className={cn(tableClasses.th, i > 1 && "text-right")}>{h}</th>)}
            </tr></thead><tbody>{l.rs.filter((r: any) => (!l.corrente && Number(r.previsto)) || Number(r.emitido) || Number(r.em_aberto))
              .map((r: any) => ({ ...r, c: info.get(r.contrato_id) }))
              .sort((a: any, b: any) => (a.c?.unidades ?? "").localeCompare(b.c?.unidades ?? "", "pt-BR", { numeric: true }))
              .map((r: any) => <tr key={r.contrato_id}>
                <td className={tableClasses.td}>{r.c?.unidades ?? "—"}</td>
                <td className={tableClasses.td}>{r.c?.locatario ?? "—"} {r.fora_boleto && <span className="op-tag op-tag-gray ml-1">Fora do Boleto</span>}</td>
                <td className={tableClasses.num}>{traco(l, r.previsto)}</td><td className={tableClasses.num}>{brl(r.emitido)}</td>
                <td className={tableClasses.num}>{traco(l, r.sem_boleto)}</td><td className={tableClasses.num}>{brl(r.em_aberto)}</td>
              </tr>)}</tbody></table>
            {l.os.length > 0 && <table className={tableClasses.table}><thead><tr className={tableClasses.head}>
              <th className={tableClasses.th}>Outras Receitas</th><th className={cn(tableClasses.th, "text-right")}>Emitido</th>
            </tr></thead><tbody>{l.os.map((r: any) => <tr key={r.outra_receita}>
              <td className={tableClasses.td} title={dicaOutra(r.outra_receita, l.k)}>{r.outra_receita}</td><td className={tableClasses.num}>{brl(r.emitido)}</td>
            </tr>)}</tbody></table>}
          </td></tr>}
        </Fragment>)}
        <tr className="font-semibold"><td className={tableClasses.td}>Total</td>
          <td className={tableClasses.num}>{brl(tot.previsto)}</td><td className={tableClasses.num}>{brl(tot.emitido)}</td>
          <td className={tableClasses.num}>{pctTxt(emitFut, tot.previsto)}</td><td className={tableClasses.num}>{brl(tot.fora)}</td>
          <td className={tableClasses.num}>{brl(tot.sem)}</td><td className={tableClasses.num}>{brl(tot.outras)}</td>
          <td className={tableClasses.num}>{brl(tot.caixa)}</td><td className={tableClasses.num}>{brl(tot.aberto)}</td></tr>
      </tbody></table>
    </Bloco>
    {vencidos.length > 0 && <Bloco titulo="Em Aberto" acao={<span title="Posição do arquivo importado." className="text-xs text-muted-foreground">{brl(emAberto)}</span>}>
      <table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Pagador", "Unidade", "Vencimento", "Valor (R$)"].map((h, i) => <th key={h} className={cn(tableClasses.th, i === 3 && "text-right")}>{h}</th>)}
      </tr></thead><tbody>{vencidos.sort((a: any, b: any) => a.data_vencimento.localeCompare(b.data_vencimento)).map((b: any) => <tr key={b.id}>
        <td className={tableClasses.td}>{b.pagador}</td><td className={tableClasses.td} title={b.descricao ?? undefined}>{b.natureza === "outros" ? b.outra_receita ?? "Outros Boletos" : info.get(b.contrato_id)?.unidades ?? b.outra_receita ?? "—"}</td>
        <td className={cn(tableClasses.td, "tabular-nums")}>{dt(b.data_vencimento)}</td><td className={tableClasses.num}>{brl(b.valor_titulo)}</td>
      </tr>)}</tbody></table>
    </Bloco>}
  </div>;
}

function Importacao({ edificio, contratos, outras, boletos }: { edificio: string; contratos: any[]; outras: string[]; boletos: any[] }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const semVinculo = useMemo(() => {
    const m = new Map<string, { pagador: string; documento: string; n: number }>();
    for (const b of boletos) if (b.natureza !== "outros" && !b.contrato_id && !b.outra_receita && b.documento) {
      const x = m.get(b.documento) ?? { pagador: b.pagador, documento: b.documento, n: 0 }; x.n++; m.set(b.documento, x);
    }
    return [...m.values()];
  }, [boletos]);
  const opcoes = [...contratos].sort((a, b) => a.unidades.localeCompare(b.unidades, "pt-BR", { numeric: true }));
  const recarregar = () => { qc.invalidateQueries({ queryKey: ["loc-planejamento"] }); qc.invalidateQueries({ queryKey: ["loc-encargos"] }); };

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
    const v = escolha[documento]; if (!v) return;
    setOcupado(true);
    const ehOutra = v.startsWith("o:");
    const b = await db.rpc("loc_vincular_pagador", { p_edificio: edificio, p_documento: documento, p_contrato: ehOutra ? null : v.slice(2), p_outra: ehOutra ? v.slice(2) : null });
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
          <option value="">Contrato ou Outra Receita…</option>
          <optgroup label="Contratos">{opcoes.map((c) => <option key={c.id} value={"c:" + c.id}>{c.unidades} · {c.locatario}</option>)}</optgroup>
          {outras.length > 0 && <optgroup label="Outras Receitas">{outras.map((o) => <option key={o} value={"o:" + o}>{o}</option>)}</optgroup>}
        </select>
        <Button size="sm" variant="outline" disabled={!escolha[p.documento] || ocupado} onClick={() => vincular(p.documento)}>Vincular</Button>
      </div>)}
    </div>}
  </Bloco>;
}
