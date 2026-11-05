import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MESES_LONGOS, num2 } from "@/lib/locacoes";
import { Button } from "@/components/ui/button";

const db = supabase as any;
const c = (n: number) => Math.round(n * 100);
const titulo = (a: number, m: number) => `${MESES_LONGOS[m].charAt(0).toUpperCase()}${MESES_LONGOS[m].slice(1)}/${a}`;

export function statusBoleto(l: { situacao: string | null; recebido: number } | undefined) {
  if (!l) return "Não Emitido";
  if (l.situacao === "fora_do_boleto") return "Fora do Boleto";
  if (l.situacao === "boleto_emitido" || l.situacao === "vencido" || l.situacao === "pago_no_boleto" || l.recebido > 0) return "Emitido";
  return "Não Emitido";
}

export function ControleRecebimentos({ data }: { data: any; ano?: number; outras?: any[] }) {
  const edificio = data.edificio.id;
  const hoje = new Date();
  const [ref, setRef] = useState({ a: hoje.getFullYear(), m: hoje.getMonth() });
  const mover = (d: number) => setRef(({ a, m }) => { const t = a * 12 + m + d; return { a: Math.floor(t / 12), m: t % 12 }; });
  const mes = `${ref.a}-${String(ref.m + 1).padStart(2, "0")}-01`;
  const { data: q, error, isLoading } = useQuery({
    queryKey: ["loc-controle-recebimentos", edificio, "mes", ref.a], staleTime: Infinity,
    queryFn: async () => {
      const rs = await Promise.all([
        db.rpc("loc_controle_recebimentos", { p_edificio: edificio, p_ano: ref.a }),
        db.rpc("loc_esperado_caixa", { p_edificio: edificio, p_ano: ref.a }),
        db.rpc("loc_planejamento_outras", { p_edificio: edificio, p_ano: ref.a }),
      ]);
      for (const r of rs) if (r.error) throw r.error;
      return { linhas: rs[0].data ?? [], esperado: rs[1].data ?? [], outras: rs[2].data ?? [] };
    },
  });
  const doMes = (r: any) => String(r.mes).slice(0, 10) === mes;
  const valores = new Map<string, number>();
  for (const e of (q?.esperado ?? []).filter(doMes)) valores.set(e.contrato_id, (c(valores.get(e.contrato_id) ?? 0) + c(Number(e.valor))) / 100);
  const info = (id: string) => data.contratosInfo.find((x: any) => x.id === id);
  const ids = [...valores.keys()].filter((id) => valores.get(id)! > 0).sort((a, b) => String(info(a)?.unidades ?? "").localeCompare(String(info(b)?.unidades ?? ""), "pt-BR", { numeric: true }));
  const linhas = (q?.linhas ?? []).filter(doMes).map((l: any) => ({ ...l, recebido: Number(l.recebido) }));
  const outras = (q?.outras ?? []).filter(doMes).reduce((s: number, o: any) => s + c(Number(o.emitido)), 0) / 100;
  const total = (ids.reduce((s, id) => s + c(valores.get(id)!), 0) + c(outras)) / 100;
  return <section className="space-y-4" aria-label="Valores a Receber">
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => mover(-1)}><ChevronLeft className="h-4 w-4" /></Button>
      <h2>Valores a Receber de {titulo(ref.a, ref.m)}</h2>
      <Button variant="ghost" size="icon" aria-label="Mês seguinte" onClick={() => mover(1)}><ChevronRight className="h-4 w-4" /></Button>
    </div>
    {error ? <p role="alert" className="text-destructive">Não foi possível consultar os valores: {error.message}</p> : isLoading ? <p>Carregando…</p> :
      <table className="w-full text-sm" aria-label="Valores a receber por contrato">
        <thead><tr className="border-b text-left"><th className="py-2">Unidade</th><th>Locatário</th><th className="text-right">Valor a Receber</th><th className="pl-6">Boleto</th></tr></thead>
        <tbody>{ids.map((id) => <tr key={id} className="border-b">
          <td className="py-1.5">{info(id)?.unidades || "—"}</td><td>{info(id)?.locatario || "—"}</td>
          <td className="text-right tabular-nums">{num2(valores.get(id))}</td>
          <td className="pl-6">{statusBoleto(linhas.find((l: any) => l.contrato_id === id))}</td>
        </tr>)}</tbody>
        <tfoot>
          <tr className="border-b"><td className="py-1.5">Outras Receitas</td><td></td><td className="text-right tabular-nums">{num2(outras)}</td><td></td></tr>
          <tr className="font-semibold"><td className="py-2">Total a Receber</td><td></td><td className="text-right tabular-nums">{num2(total)}</td><td></td></tr>
        </tfoot>
      </table>}
  </section>;
}
