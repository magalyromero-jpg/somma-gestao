import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bloco } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MESES, MESES_LONGOS, brl, dt } from "@/lib/locacoes";

const db = supabase as any;
const n = (v: any) => Number(v ?? 0);
const mesLabel = (s: string) => `${MESES[Number(s.slice(5, 7)) - 1]}/${s.slice(0, 4)}`;

/** Valor em aberto: âmbar quando > 0, "—" quando zero. */
function Aberto({ v }: { v: number }) {
  return v > 0.004 ? <span className="op-tag op-tag-amber tabular-nums">{brl(v)}</span> : <>—</>;
}
const valOuTraco = (v: number) => (Math.abs(v) > 0.004 ? brl(v) : "—");

export function RealizadoEmAberto({ edificioId, admin, ultimaData }: { edificioId: string; admin: boolean; ultimaData: string }) {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [aberto, setAberto] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["loc-realizado", edificioId, ano],
    queryFn: async () => {
      const [cx, ea, cf] = await Promise.all([
        db.rpc("loc_caixa_mensal", { p_edificio: edificioId, p_ano: ano }),
        db.rpc("loc_em_aberto", { p_edificio: edificioId, p_ano: ano }),
        db.rpc("loc_conferencia", { p_edificio: edificioId, p_ano: ano }),
      ]);
      for (const r of [cx, ea, cf]) if (r.error) throw r.error;
      return { caixa: (cx.data ?? []) as any[], emAberto: (ea.data ?? []) as any[], conf: (cf.data ?? []) as any[] };
    },
  });

  const caixa = q.data?.caixa ?? [];
  const ativos = (q.data?.emAberto ?? []).filter((e) => !e.encerrado).sort((a, b) => n(b.saldo) - n(a.saldo));
  const encerrados = (q.data?.emAberto ?? []).filter((e) => e.encerrado).sort((a, b) => n(b.saldo) - n(a.saldo));
  const totAtivos = ativos.reduce((s, e) => s + n(e.saldo), 0);
  const totEnc = encerrados.reduce((s, e) => s + n(e.saldo), 0);
  const maior = ativos[0];

  const cols: { k: string; label: string; aberto?: boolean; soAdmin?: boolean }[] = [
    { k: "orcado", label: "Orçado" },
    { k: "previsto_contratual", label: "Previsto pelos contratos" },
    { k: "recebido_da_competencia", label: "Recebido da competência" },
    { k: "em_aberto", label: "Em aberto", aberto: true },
    { k: "em_aberto_encerrados", label: "Em aberto de contratos encerrados", aberto: true, soAdmin: true },
    { k: "recebido_a_maior", label: "Recebido a maior" },
    { k: "outras_receitas", label: "Outras receitas" },
    { k: "entrou_no_caixa", label: "Entrou no caixa" },
    { k: "de_meses_anteriores", label: "Recebido de meses anteriores" },
    { k: "recebido_no_mes_seguinte", label: "Pago no mês seguinte" },
  ].filter((c) => admin || !c.soAdmin);

  const ultimoMes = ultimaData ? `${MESES_LONGOS[Number(ultimaData.slice(5, 7)) - 1]} de ${ultimaData.slice(0, 4)}` : "—";

  const tabelaAberto = (linhas: any[], enc: boolean) => (
    <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
      {["Unidade", "Locatário", "Previsto no ano", "Recebido", "Saldo em aberto", "Competências em aberto"].map((h, i) =>
        <th key={h} className={cn(tableClasses.th, i >= 2 && i <= 4 && "text-right")}>{h}</th>)}
    </tr></thead><tbody>
      {linhas.length === 0 && <tr><td colSpan={6} className={cn(tableClasses.td, "text-muted-foreground")}>Nenhum valor em aberto.</td></tr>}
      {linhas.map((e) => {
        const exp = aberto === e.contrato_id;
        const meses = (q.data?.conf ?? []).filter((c) => c.contrato_id === e.contrato_id).sort((a, b) => a.mes.localeCompare(b.mes));
        return <Fragment key={e.contrato_id}>
          <tr className="cursor-pointer" aria-expanded={exp} onClick={() => setAberto(exp ? null : e.contrato_id)}>
            <td className={cn(tableClasses.td, "font-medium zen-un")}>{e.unidades ?? "—"}{enc && " (encerrado)"}</td>
            <td className={cn(tableClasses.td, "zen-txt")}>{e.locatario ?? "—"}</td>
            <td className={tableClasses.num}>{brl(e.previsto)}</td>
            <td className={tableClasses.num}>{brl(e.recebido)}</td>
            <td className={tableClasses.num}><Aberto v={n(e.saldo)} /></td>
            <td className={cn(tableClasses.td, "zen-txt tabular-nums")}>{e.competencias ?? "—"}</td>
          </tr>
          {exp && <tr><td colSpan={6} className="border-b bg-muted/40 px-[10px] py-3">
            <table className={cn(tableClasses.table, "zen-wide")}><thead><tr className={tableClasses.head}>
              {["Competência", "Previsto", "Recebido", "Data do pagamento", "Saldo", "Situação"].map((h, i) =>
                <th key={h} className={cn(tableClasses.th, [1, 2, 4].includes(i) && "text-right")}>{h}</th>)}
            </tr></thead><tbody>{meses.map((m) => <tr key={m.mes}>
              <td className={cn(tableClasses.td, "tabular-nums")}>{mesLabel(m.mes)}</td>
              <td className={tableClasses.num}>{brl(m.previsto)}</td>
              <td className={tableClasses.num}>{valOuTraco(n(m.recebido))}</td>
              <td className={cn(tableClasses.td, "tabular-nums")}>{dt(m.pago_em)}</td>
              <td className={tableClasses.num}>{n(m.saldo) > 2 ? <Aberto v={n(m.saldo)} /> : valOuTraco(n(m.saldo))}</td>
              <td className={tableClasses.td}><span className={cn("op-tag", m.situacao === "Conforme" ? "op-tag-green" : m.situacao === "Recebido a maior" ? "op-tag-gray" : "op-tag-amber")}>{m.situacao}</span></td>
            </tr>)}</tbody></table>
          </td></tr>}
        </Fragment>;
      })}
    </tbody></table></div>
  );

  return <Bloco titulo="Realizado e valores em aberto" acao={
    <Select value={String(ano)} onValueChange={(v) => { setAno(Number(v)); setAberto(null); }}>
      <SelectTrigger className="h-8 w-28 text-xs" aria-label="Ano"><SelectValue /></SelectTrigger>
      <SelectContent>{[anoAtual - 1, anoAtual].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
    </Select>}>
    <p className="mb-4 text-[13px] text-muted-foreground">Pagamentos importados até {ultimoMes}.</p>
    {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : q.error ? <p className="text-sm text-destructive">Não foi possível carregar os valores.</p> : <div className="space-y-6">
      <div className="portal-kpis">
        <div className="portal-kpi"><div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Em aberto (contratos ativos)</div><div className="mt-1 text-2xl font-extralight tabular-nums">{totAtivos > 0 ? <span className="text-warning">{brl(totAtivos)}</span> : "—"}</div></div>
        <div className="portal-kpi"><div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Contratos com saldo em aberto</div><div className="mt-1 text-2xl font-extralight tabular-nums">{ativos.length}</div></div>
        <div className="portal-kpi"><div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Maior saldo em aberto</div><div className="mt-1 text-2xl font-extralight tabular-nums">{maior ? brl(maior.saldo) : "—"}</div>{maior && <div className="mt-1 text-xs text-muted-foreground">{maior.locatario}</div>}</div>
        {admin && <div className="portal-kpi"><div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Contratos encerrados em aberto</div><div className="mt-1 text-2xl font-extralight tabular-nums">{totEnc > 0 ? brl(totEnc) : "—"}</div><div className="mt-1 text-xs text-muted-foreground">Detalhe em Contratos encerrados</div></div>}
      </div>

      <div>
        <h4 className="mb-2 text-[15px] font-medium">Fluxo de caixa realizado</h4>
        <div className={tableClasses.wrap}><table className={cn(tableClasses.table, "zen-wide")}><thead><tr className={tableClasses.head}>
          <th className={tableClasses.th}>Mês</th>{cols.map((c) => <th key={c.k} className={cn(tableClasses.th, "text-right wrap")}>{c.label}</th>)}
        </tr></thead><tbody>
          {caixa.map((m) => <tr key={m.mes}><td className={cn(tableClasses.td, "tabular-nums")}>{mesLabel(m.mes)}</td>
            {cols.map((c) => <td key={c.k} className={tableClasses.num}>{c.aberto ? <Aberto v={n(m[c.k])} /> : valOuTraco(n(m[c.k]))}</td>)}</tr>)}
          <tr className="font-bold"><td className={tableClasses.td}>Total</td>
            {cols.map((c) => { const t = caixa.reduce((s, m) => s + n(m[c.k]), 0); return <td key={c.k} className={tableClasses.num}>{c.aberto ? <Aberto v={t} /> : valOuTraco(t)}</td>; })}</tr>
        </tbody></table></div>
        <p className="mt-2 text-xs text-muted-foreground">Previsto pelos contratos considera os valores vigentes hoje, inclusive aditivos e contratos novos. Competência é o mês do vencimento do boleto; "Entrou no caixa" considera a data do pagamento.</p>
      </div>

      <div>
        <h4 className="mb-2 text-[15px] font-medium">Valores em aberto por contrato</h4>
        {tabelaAberto(ativos, false)}
      </div>
      {admin && <div>
        <h4 className="mb-2 text-[15px] font-medium">Contratos encerrados</h4>
        {tabelaAberto(encerrados, true)}
      </div>}
    </div>}
  </Bloco>;
}
