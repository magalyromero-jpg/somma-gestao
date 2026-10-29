import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { tableClasses } from "@/components/locacoes/tabela";
import { cn } from "@/lib/utils";
import { brl, dt } from "@/lib/locacoes";
import { FORMA_LABEL, compararUnidades, parcelaDevida, situacaoIptu, type IptuLinha } from "@/lib/iptu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const db = supabase as any;

function hojeLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function isoHoje(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** Marca ou desmarca uma parcela (somente administrador). */
function Marcador({ admin, edificio, ano, unidade, n, pagoEm, devida, onMudou }: {
  admin: boolean; edificio: string; ano: number; unidade: string; n: number; pagoEm: string | null; devida: boolean; onMudou: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(isoHoje());
  const [salvando, setSalvando] = useState(false);
  const pago = pagoEm != null;
  const classe = pago
    ? "bg-primary text-primary-foreground border-primary"
    : devida
      ? "border-amber-500 text-amber-600"
      : "border-border text-muted-foreground/50";
  const titulo = pago ? `Paga em ${dt(pagoEm)}` : devida ? "Devida, sem registro de pagamento" : "Ainda não venceu";

  const salvar = async (valor: string | null) => {
    setSalvando(true);
    const r = await db.rpc("loc_iptu_marcar_parcela", { p_edificio: edificio, p_ano: ano, p_unidade: unidade, p_parcela: n, p_pago_em: valor });
    setSalvando(false);
    if (!r.error) { setAberto(false); onMudou(); }
  };

  const bolinha = <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px] tabular-nums", classe, admin && "cursor-pointer")}>{String(n).padStart(2, "0")}</span>;
  if (!admin) return <span title={titulo}>{bolinha}</span>;

  return <Popover open={aberto} onOpenChange={setAberto}>
    <PopoverTrigger asChild><button type="button" title={titulo} className="rounded-full">{bolinha}</button></PopoverTrigger>
    <PopoverContent className="w-56 space-y-2 p-3">
      <p className="text-xs font-semibold">Parcela {String(n).padStart(2, "0")} · {unidade}</p>
      {pago ? <>
        <p className="text-xs text-muted-foreground">Paga em <span className="tabular-nums">{dt(pagoEm)}</span></p>
        <Button size="sm" variant="outline" disabled={salvando} onClick={() => salvar(null)}>Desmarcar</Button>
      </> : <>
        <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-8 text-xs" />
        <Button size="sm" disabled={salvando || !data} onClick={() => salvar(data)}>Salvar</Button>
      </>}
    </PopoverContent>
  </Popover>;
}

/** Acompanhamento do IPTU repassado aos locatários: não entra no caixa de aluguel. */
export function Iptu({ data, admin }: { data: any; admin: boolean }) {
  const edificio = data.edificio.id as string;
  const qc = useQueryClient();
  const [anoSel, setAnoSel] = useState<number | null>(null);

  const { data: linhas = [] } = useQuery({
    queryKey: ["loc-iptu", edificio],
    queryFn: async () => {
      const r = await db.from("loc_iptu").select("*").eq("edificio_id", edificio).limit(5000);
      if (r.error) throw r.error;
      return (r.data ?? []) as (IptuLinha & { ano: number })[];
    },
  });
  const anos = useMemo(() => [...new Set(linhas.map((l) => l.ano))].sort((a, b) => b - a), [linhas]);
  const ano = anoSel ?? anos[0] ?? new Date().getFullYear();

  const { data: parcelas = [], refetch } = useQuery({
    queryKey: ["loc-iptu-parcelas", edificio, ano],
    enabled: anos.length > 0,
    queryFn: async () => {
      const r = await db.from("loc_iptu_parcelas").select("unidade,parcela,pago_em").eq("edificio_id", edificio).eq("ano", ano).limit(10000);
      if (r.error) throw r.error;
      return (r.data ?? []) as { unidade: string; parcela: number; pago_em: string | null }[];
    },
  });

  const hoje = hojeLocal();
  const doAno = useMemo(() => linhas.filter((l) => l.ano === ano).sort((a, b) => compararUnidades(a.unidade, b.unidade)), [linhas, ano]);
  const pagasPorUnidade = useMemo(() => {
    const m = new Map<string, Map<number, string | null>>();
    for (const p of parcelas) {
      if (!m.has(p.unidade)) m.set(p.unidade, new Map());
      m.get(p.unidade)!.set(p.parcela, p.pago_em);
    }
    return m;
  }, [parcelas]);

  const avista = doAno.filter((l) => l.forma === "avista");
  const totalAvista = avista.reduce((t, l) => t + Number(l.valor_sala ?? 0) + Number(l.valor_garagem ?? 0), 0);
  const totalSala = avista.reduce((t, l) => t + Number(l.valor_sala ?? 0), 0);
  const totalGaragem = avista.reduce((t, l) => t + Number(l.valor_garagem ?? 0), 0);

  let recebidas = 0, devidas = 0, pendentes = 0;
  for (const l of doAno) {
    if (l.forma !== "parcelado") continue;
    const pagas = pagasPorUnidade.get(l.unidade) ?? new Map<number, string | null>();
    for (let n = 1; n <= 10; n++) {
      if (!parcelaDevida(n, ano, hoje)) continue;
      devidas++;
      if (pagas.get(n) != null) recebidas++; else pendentes++;
    }
  }
  const semRegistro = doAno.filter((l) => l.forma === "sem_registro").length;

  const cards = [
    { l: "IPTU Pago à Vista", v: brl(totalAvista), d: `${avista.length} unidades · ${brl(totalSala)} de sala e ${brl(totalGaragem)} de garagem.` },
    { l: "Parcelas Recebidas", v: String(recebidas), d: `De ${devidas} parcelas devidas até hoje.` },
    { l: "Parcelas Pendentes", v: String(pendentes), d: "Devidas e ainda sem registro de pagamento." },
    { l: "Unidades Sem Registro", v: String(semRegistro), d: "Unidades que não aparecem na cobrança." },
  ];

  return <div className="space-y-4">
    {anos.length > 1 && <div className="w-40">
      <Select value={String(ano)} onValueChange={(v) => setAnoSel(Number(v))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
      </Select>
    </div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => <div key={c.l} title={c.d} className="rounded-md border bg-card p-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">{c.l}</div>
        <div className="mt-3 text-[24px] font-extralight leading-none tabular-nums">{c.v}</div>
      </div>)}
    </div>
    <div className="rounded-md border bg-card p-4">
      <table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Unidade", "Locatário", "Forma", "IPTU Pago (R$)", "Parcela da Sala (R$)", "Parcelas", "Situação"].map((h, i) =>
          <th key={h} className={cn(tableClasses.th, (i === 3 || i === 4) && "text-right")}>{h}</th>)}
      </tr></thead><tbody>
        {doAno.map((l) => {
          const pagas = pagasPorUnidade.get(l.unidade) ?? new Map<number, string | null>();
          const sit = situacaoIptu(l, new Set([...pagas.entries()].filter(([, v]) => v != null).map(([k]) => k)), ano, hoje);
          const pagoTotal = l.forma === "avista" ? Number(l.valor_sala ?? 0) + Number(l.valor_garagem ?? 0) : null;
          return <tr key={l.unidade}>
            <td className={tableClasses.td}>{l.unidade}</td>
            <td className={tableClasses.td}>{l.locatario ?? "—"}</td>
            <td className={tableClasses.td}>{FORMA_LABEL[l.forma]}</td>
            <td className={tableClasses.num} title={l.forma === "avista" && l.pago_em ? `Pago em ${dt(l.pago_em)}` : undefined}>{pagoTotal != null ? brl(pagoTotal) : "—"}</td>
            <td className={tableClasses.num}>{l.forma === "parcelado" && l.valor_sala != null ? brl(Number(l.valor_sala)) : "—"}</td>
            <td className={tableClasses.td}>{l.forma === "parcelado" && <span className="inline-flex flex-wrap gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const pagoEm = pagas.get(n) ?? null;
                return <Marcador key={n} admin={admin} edificio={edificio} ano={ano} unidade={l.unidade} n={n}
                  pagoEm={pagoEm} devida={parcelaDevida(n, ano, hoje)} onMudou={() => { refetch(); qc.invalidateQueries({ queryKey: ["loc-iptu-parcelas"] }); }} />;
              })}
            </span>}</td>
            <td className={tableClasses.td} title={l.observacao ?? undefined}>{sit.texto}</td>
          </tr>;
        })}
        <tr className="font-semibold">
          <td className={tableClasses.td} colSpan={3}>Total</td>
          <td className={tableClasses.num}>{brl(totalAvista)}</td>
          <td className={tableClasses.td} colSpan={3}></td>
        </tr>
      </tbody></table>
    </div>
  </div>;
}
