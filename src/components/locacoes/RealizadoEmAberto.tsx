import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Bloco } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { cn } from "@/lib/utils";
import { MESES, MESES_LONGOS, brl, dt } from "@/lib/locacoes";

const db = supabase as any;
const n = (v: any) => Number(v ?? 0);
const mesCurto = (s: string) => `${MESES[Number(s.slice(5, 7)) - 1]}/${s.slice(0, 4)}`;
const mesExtenso = (s: string) => { const m = MESES_LONGOS[Number(s.slice(5, 7)) - 1]; return m.charAt(0).toUpperCase() + m.slice(1); };
const valOuTraco = (v: number) => (Math.abs(v) > 0.004 ? brl(v) : "—");
/** Em aberto: texto âmbar quando > 0; zero como "—". */
const Aberto = ({ v }: { v: number }) => (v > 0.004 ? <span className="text-warning">{brl(v)}</span> : <>—</>);

function Indicador({ label, valor, apoio, alerta }: { label: string; valor: string; apoio?: string; alerta?: boolean }) {
  return <div className="rounded-sm border bg-card p-4">
    <div className="text-[12px] text-muted-foreground">{label}</div>
    <div className={cn("mt-1 text-[22px] font-light tabular-nums", alerta && "text-warning")}>{valor}</div>
    <div className="mt-1 min-h-[1rem] text-xs text-muted-foreground">{apoio}</div>
  </div>;
}

export function RealizadoEmAberto({ ano, edificioId, admin, ultimaData }: { ano: number; edificioId: string; admin: boolean; ultimaData: string }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState(false);

  const q = useQuery({
    queryKey: ["loc-realizado", edificioId, ano, admin],
    queryFn: async () => {
      const [cx, ea, cf, enc] = await Promise.all([
        db.rpc("loc_caixa_mensal", { p_edificio: edificioId, p_ano: ano }),
        db.rpc("loc_em_aberto", { p_edificio: edificioId, p_ano: ano }),
        db.rpc("loc_conferencia", { p_edificio: edificioId, p_ano: ano }),
        admin ? db.from("loc_v_encerrados").select("contrato_id, alugueis_em_aberto").eq("edificio_id", edificioId) : Promise.resolve({ data: [], error: null }),
      ]);
      for (const r of [cx, ea, cf, enc]) if (r.error) throw r.error;
      return { caixa: (cx.data ?? []) as any[], emAberto: (ea.data ?? []) as any[], conf: (cf.data ?? []) as any[], enc: (enc.data ?? []) as any[] };
    },
  });

  const limite = ultimaData.slice(0, 7);
  const caixa = (q.data?.caixa ?? []).filter((m) => !limite || m.mes.slice(0, 7) <= limite);
  const ativos = (q.data?.emAberto ?? []).filter((e) => !e.encerrado).sort((a, b) => n(b.saldo) - n(a.saldo));
  const totAtivos = ativos.reduce((s, e) => s + n(e.saldo), 0);
  const totEnc = (q.data?.enc ?? []).reduce((s, e) => s + n(e.alugueis_em_aberto), 0);
  const maior = ativos[0];

  const cols: { k: string; label: string; aberto?: boolean }[] = [
    { k: "orcado", label: "Orçado" },
    { k: "previsto_contratual", label: "Previsto pelos contratos" },
    { k: "entrou_no_caixa", label: "Entrou no caixa" },
    { k: "em_aberto", label: "Em aberto", aberto: true },
    ...(detalhe ? [
      { k: "recebido_da_competencia", label: "Recebido da competência" },
      { k: "recebido_a_maior", label: "Recebido a maior" },
      { k: "outras_receitas", label: "Outras receitas" },
      { k: "de_meses_anteriores", label: "Recebido de meses anteriores" },
      { k: "recebido_no_mes_seguinte", label: "Pago no mês seguinte" },
    ] : []),
  ];

  const ultimoMes = ultimaData ? `${MESES_LONGOS[Number(ultimaData.slice(5, 7)) - 1]} de ${ultimaData.slice(0, 4)}` : "—";

  const tabelaAberto = (linhas: any[]) => (
    <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
      <th className={cn(tableClasses.th, "w-6")}></th>
      {["Unidade", "Locatário", "Saldo em aberto", "Competências em aberto"].map((h, i) =>
        <th key={h} className={cn(tableClasses.th, i === 2 && "text-right")}>{h}</th>)}
    </tr></thead><tbody>
      {linhas.length === 0 && <tr><td colSpan={5} className={cn(tableClasses.td, "text-muted-foreground")}>Nenhum valor em aberto.</td></tr>}
      {linhas.map((e) => {
        const exp = aberto === e.contrato_id;
        const meses = (q.data?.conf ?? []).filter((c) => c.contrato_id === e.contrato_id).sort((a, b) => a.mes.localeCompare(b.mes));
        return <Fragment key={e.contrato_id}>
          <tr className="cursor-pointer" aria-expanded={exp} onClick={() => setAberto(exp ? null : e.contrato_id)}>
            <td className={cn(tableClasses.td, "text-muted-foreground")}>{exp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
            <td className={cn(tableClasses.td, "font-medium zen-un")}>{e.unidades ?? "—"}</td>
            <td className={cn(tableClasses.td, "zen-txt")}>{e.locatario ?? "—"}</td>
            <td className={tableClasses.num}><Aberto v={n(e.saldo)} /></td>
            <td className={cn(tableClasses.td, "zen-txt tabular-nums")}>{e.competencias ?? "—"}</td>
          </tr>
          {exp && <tr><td colSpan={5} className="border-b bg-muted/40 px-[10px] py-3">
            <table className={cn(tableClasses.table, "zen-wide")}><thead><tr className={tableClasses.head}>
              {["Competência", "Previsto", "Recebido", "Data do pagamento", "Saldo", "Situação"].map((h, i) =>
                <th key={h} className={cn(tableClasses.th, [1, 2, 4].includes(i) && "text-right")}>{h}</th>)}
            </tr></thead><tbody>{meses.map((m) => <tr key={m.mes}>
              <td className={cn(tableClasses.td, "tabular-nums")}>{mesCurto(m.mes)}</td>
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

  return <Bloco titulo={`Realizado e valores em aberto, ${ano}`}>
    <p className="-mt-1 mb-6 text-[13px] text-muted-foreground">Pagamentos importados até {ultimoMes}</p>
    {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : q.error ? <p className="text-sm text-destructive">Não foi possível carregar os valores.</p> : <div className="space-y-10">
      <div className={cn("grid grid-cols-2 gap-4", admin ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <Indicador label="Em aberto dos contratos ativos" valor={totAtivos > 0.004 ? brl(totAtivos) : "—"} alerta={totAtivos > 0.004} apoio={`${ativos.length} contrato${ativos.length === 1 ? "" : "s"}`} />
        <Indicador label="Contratos com saldo" valor={String(ativos.length)} apoio="Contratos ativos" />
        <Indicador label="Maior saldo" valor={maior ? brl(maior.saldo) : "—"} alerta={!!maior} apoio={maior?.locatario} />
        {admin && <Indicador label="Contratos encerrados em aberto" valor={totEnc > 0.004 ? brl(totEnc) : "—"} alerta={totEnc > 0.004} apoio="Detalhe em Contratos encerrados" />}
      </div>

      <section>
        <h4 className="mb-3 text-[15px] font-medium">Fluxo de caixa realizado</h4>
        <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
          <th className={tableClasses.th}>Mês</th>{cols.map((c) => <th key={c.k} className={cn(tableClasses.th, "text-right wrap")}>{c.label}</th>)}
        </tr></thead><tbody>
          {caixa.map((m) => <tr key={m.mes}><td className={tableClasses.td}>{mesExtenso(m.mes)}</td>
            {cols.map((c) => <td key={c.k} className={tableClasses.num}>{c.aberto ? <Aberto v={n(m[c.k])} /> : valOuTraco(n(m[c.k]))}</td>)}</tr>)}
          <tr className="font-bold [&>td]:border-b-0 [&>td]:border-t-2 [&>td]:border-t-border"><td className={tableClasses.td}>Total</td>
            {cols.map((c) => { const t = caixa.reduce((s, m) => s + n(m[c.k]), 0); return <td key={c.k} className={tableClasses.num}>{c.aberto ? <Aberto v={t} /> : valOuTraco(t)}</td>; })}</tr>
        </tbody></table></div>
        <button type="button" className="mt-3 text-[13px] font-medium text-secondary-foreground underline-offset-4 hover:underline" aria-expanded={detalhe} onClick={() => setDetalhe((x) => !x)}>
          {detalhe ? "Ocultar detalhamento" : "Ver detalhamento"}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">Competência é o mês do vencimento do boleto. "Entrou no caixa" considera a data do pagamento.</p>
      </section>

      <section>
        <h4 className="mb-3 text-[15px] font-medium">Valores em aberto por contrato</h4>
        {tabelaAberto(ativos)}
      </section>
    </div>}
  </Bloco>;
}
