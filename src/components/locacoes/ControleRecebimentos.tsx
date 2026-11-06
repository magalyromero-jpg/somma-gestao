import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MESES_LONGOS, num2 } from "@/lib/locacoes";
import sommaLogo from "@/assets/somma-logo-dark.png";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const db = supabase as any;
const c = (n: number) => Math.round(n * 100);
const titulo = (a: number, m: number) => `${MESES_LONGOS[m].charAt(0).toUpperCase()}${MESES_LONGOS[m].slice(1)}/${a}`;

export function statusBoleto(l: { situacao: string | null; recebido: number } | undefined) {
  if (!l) return "Verificar";
  if (l.situacao === "fora_do_boleto") return "Fora do Boleto";
  if (l.situacao === "boleto_emitido" || l.situacao === "vencido" || l.situacao === "pago_no_boleto" || l.recebido > 0) return "Emitido";
  return "Verificar";
}

export function ControleRecebimentos({ data }: { data: any; ano?: number; outras?: any[] }) {
  const edificio = data.edificio.id;
  const hoje = new Date();
  const [ref, setRef] = useState({ a: hoje.getFullYear(), m: hoje.getMonth() });
  const minT = hoje.getFullYear() * 12, maxT = (hoje.getFullYear() + 1) * 12 + 11;
  const opcoes = Array.from({ length: maxT - minT + 1 }, (_, i) => minT + i);
  const tAtual = ref.a * 12 + ref.m;
  const irPara = (t: number) => setRef({ a: Math.floor(t / 12), m: t % 12 });
  const mover = (d: number) => { const t = tAtual + d; if (t >= minT && t <= maxT) irPara(t); };
  const mes = `${ref.a}-${String(ref.m + 1).padStart(2, "0")}-01`;
  const { data: q, error, isLoading } = useQuery({
    queryKey: ["loc-controle-recebimentos", edificio, "mes", ref.a], staleTime: Infinity,
    queryFn: async () => {
      const rs = await Promise.all([
        db.rpc("loc_controle_recebimentos", { p_edificio: edificio, p_ano: ref.a }),
        db.rpc("loc_esperado_caixa", { p_edificio: edificio, p_ano: ref.a }),
      ]);
      for (const r of rs) if (r.error) throw r.error;
      return { linhas: rs[0].data ?? [], esperado: rs[1].data ?? [] };
    },
  });
  const doMes = (r: any) => String(r.mes).slice(0, 10) === mes;
  const valores = new Map<string, number>();
  for (const e of (q?.esperado ?? []).filter(doMes)) valores.set(e.contrato_id, (c(valores.get(e.contrato_id) ?? 0) + c(Number(e.valor))) / 100);
  const info = (id: string) => data.contratosInfo.find((x: any) => x.id === id);
  const ids = [...valores.keys()].filter((id) => valores.get(id)! > 0).sort((a, b) => String(info(a)?.unidades ?? "").localeCompare(String(info(b)?.unidades ?? ""), "pt-BR", { numeric: true }));
  const linhas = (q?.linhas ?? []).filter(doMes).map((l: any) => ({ ...l, recebido: Number(l.recebido) }));
  const total = ids.reduce((s, id) => s + c(valores.get(id)!), 0) / 100;
  const mesNome = `${MESES_LONGOS[ref.m].charAt(0).toUpperCase()}${MESES_LONGOS[ref.m].slice(1)}`;
  const emitidoEm = hoje.toLocaleDateString("pt-BR");
  const exportarPdf = () => {
    const tituloAnterior = document.title;
    document.title = `Valores a Receber - Zen Tower - ${mesNome} ${ref.a}`;
    document.body.classList.add("imprimindo-previsao");
    const st = document.createElement("style");
    st.id = "previsao-print-page";
    st.textContent = `@page { size: A4 portrait; margin: 0 14mm 18mm;
      @bottom-left { width: 90mm; content: "Somma MFO"; font: 8pt Inter, sans-serif; color: #4D6571; }
      @bottom-right { width: 90mm; text-align: right; white-space: nowrap; content: "Página " counter(page) " de " counter(pages); font: 8pt Inter, sans-serif; color: #4D6571; } }`;
    document.head.appendChild(st);
    const limpar = () => {
      document.body.classList.remove("imprimindo-previsao");
      document.title = tituloAnterior;
      st.remove();
      window.removeEventListener("afterprint", limpar);
    };
    window.addEventListener("afterprint", limpar);
    window.print();
  };
  return <section className="space-y-4" aria-label="Valores a Receber">
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" aria-label="Mês anterior" disabled={tAtual <= minT} onClick={() => mover(-1)}><ChevronLeft className="h-4 w-4" /></Button>
      <h2>Valores a Receber de {titulo(ref.a, ref.m)}</h2>
      <Select value={String(tAtual)} onValueChange={(v) => irPara(Number(v))}>
        <SelectTrigger className="w-44" aria-label="Mês"><SelectValue /></SelectTrigger>
        <SelectContent>{opcoes.map((t) => <SelectItem key={t} value={String(t)}>{titulo(Math.floor(t / 12), t % 12)}</SelectItem>)}</SelectContent>
      </Select>
      <Button variant="ghost" size="icon" aria-label="Mês seguinte" disabled={tAtual >= maxT} onClick={() => mover(1)}><ChevronRight className="h-4 w-4" /></Button>
      <Button variant="outline" size="sm" className="ml-auto" onClick={exportarPdf} disabled={isLoading || !!error}><Download className="h-4 w-4" />Exportar PDF</Button>
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
          <tr className="font-semibold"><td className="py-2">Total a Receber</td><td></td><td className="text-right tabular-nums">{num2(total)}</td><td></td></tr>
        </tfoot>
      </table>}
    <div className="previsao-print hidden" aria-hidden="true">
      <div className="pp-cabecalho">
        <img src={sommaLogo} alt="Somma" />
        <div className="pp-cab-dir">
          <p>Zen Tower | Gestão de Locações</p>
          <p>Emitido em {emitidoEm}</p>
        </div>
      </div>
      <h1 className="pp-titulo">Valores a Receber de {titulo(ref.a, ref.m)}</h1>
      <table className="pp-tabela">
        <thead>
          <tr className="pp-espaco"><td colSpan={4}></td></tr>
          <tr><th>Unidade</th><th>Locatário</th><th>Valor a Receber</th><th>Boleto</th></tr>
        </thead>
        <tbody>{ids.map((id) => <tr key={id}>
          <td>{info(id)?.unidades || "—"}</td><td>{info(id)?.locatario || "—"}</td>
          <td>{num2(valores.get(id))}</td>
          <td>{statusBoleto(linhas.find((l: any) => l.contrato_id === id))}</td>
        </tr>)}</tbody>
        <tfoot>
          <tr className="pp-total"><td>Total a Receber</td><td></td><td>{num2(total)}</td><td></td></tr>
        </tfoot>
      </table>
    </div>
  </section>;
}
