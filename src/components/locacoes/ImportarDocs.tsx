import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {  Bloco,   } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { brl, dt, num2, formatoPagamentoPermitido } from "@/lib/locacoes";

const db = supabase as any;

function Zona({ titulo, detalhe, accept, onFiles, ocupado }: { titulo: string; detalhe: React.ReactNode; accept: string; onFiles: (f: File[]) => void; ocupado?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  return <div
    role="button" tabIndex={0}
    onClick={() => ref.current?.click()} onKeyDown={(e) => e.key === "Enter" && ref.current?.click()}
    onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
    onDrop={(e) => { e.preventDefault(); setSobre(false); onFiles([...e.dataTransfer.files]); }}
    className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-input bg-card px-6 py-8 text-center", sobre && "border-gold", ocupado && "opacity-60")}>
    <Upload className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
    <div className="text-sm font-medium">{ocupado ? "Enviando…" : titulo}</div>
    <div className="text-xs text-muted-foreground">{detalhe}</div>
    <input ref={ref} type="file" accept={accept} multiple className="hidden" onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
  </div>;
}

const COLS = ["Código", "Imóvel", "Data de Vencimento", "Data de Pagamento", "Valor Bruto", "Valor Líquido"];
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const paraData = (v: any): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : null; }
  const m = String(v).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(v).slice(0, 10);
};
const paraNum = (v: any) => (typeof v === "number" ? v : v ? Number(String(v).replace(/[R$\s.]/g, "").replace(",", ".")) : null);

export function ImportarPagamentos({ data, porContrato }: { data: any; porContrato: Map<string, any> }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [res, setRes] = useState<any>(null);
  const [ocupado, setOcupado] = useState(false);
  const [codigos, setCodigos] = useState<any[] | null>(null);

  const carregarCodigos = async () => {
    const { data: c } = await db.from("loc_codigos_lidderar").select("codigo,nome_no_lidderar,contrato_id").eq("edificio_id", data.edificio.id).is("contrato_id", null);
    setCodigos(c ?? []);
  };
  if (codigos === null) void carregarCodigos();

  const importar = async (files: File[]) => {
    const f = files[0]; if (!f) return;
    if (files.some((file) => !formatoPagamentoPermitido(file.name))) {
      toast({ title: "Formato não permitido", description: "Envie pagamentos em .xlsx, .xls ou .csv.", variant: "destructive" });
      return;
    }
    setOcupado(true);
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true });
      const hi = rows.findIndex((r) => r.some((c) => norm(String(c ?? "")) === "codigo"));
      if (hi < 0) throw new Error("Colunas não encontradas. Use o export \"Pagamentos Recebidos\".");
      const idx = COLS.map((c) => rows[hi].findIndex((h) => norm(String(h ?? "")) === norm(c)));
      if (idx.some((i) => i < 0)) throw new Error(`Faltam colunas: ${COLS.filter((_, i) => idx[i] < 0).join(", ")}`);
      const linhas = rows.slice(hi + 1).filter((r) => r[idx[0]] != null && r[idx[3]]).map((r) => ({
        codigo: String(r[idx[0]]).trim(), imovel: r[idx[1]] ?? null, vencimento: paraData(r[idx[2]]), pagamento: paraData(r[idx[3]]), bruto: paraNum(r[idx[4]]), liquido: paraNum(r[idx[5]]),
      }));
      const { data: out, error } = await db.rpc("loc_importar_pagamentos", { p_edificio: data.edificio.id, p_arquivo: f.name, p_linhas: linhas });
      if (error) throw error;
      setRes(out);
      await carregarCodigos();
      qc.invalidateQueries({ queryKey: ["loc-edificio"] });
    } catch (e) {
      toast({ title: "Não foi possível importar", description: (e as Error).message, variant: "destructive" });
    } finally { setOcupado(false); }
  };

  const vincular = async (codigo: string, valor: string) => {
    if (valor === "eventual") return;
    const { error } = await db.from("loc_codigos_lidderar").update({ contrato_id: valor }).eq("edificio_id", data.edificio.id).eq("codigo", codigo);
    if (error) return toast({ title: "Não foi possível vincular", description: error.message, variant: "destructive" });
    await db.rpc("loc_remapear_pagamentos", { p_edificio: data.edificio.id });
    await carregarCodigos();
    qc.invalidateQueries({ queryKey: ["loc-edificio"] });
    toast({ title: "Código vinculado" });
  };

  const contagem = (codigo: string) => data.pags.filter((p: any) => p.codigo === codigo).length;
  const contratos = [...porContrato.values()];

  return <div className="space-y-4">
    <Zona titulo="Solte aqui o export &quot;Pagamentos Recebidos&quot; (.xlsx ou .csv)" detalhe={COLS.join(" | ")} accept=".xlsx,.xls,.csv" onFiles={importar} ocupado={ocupado} />
    <div className="grid gap-4 sm:grid-cols-4">
      {[["Linhas lidas", res?.linhas], ["Novas", res?.novas], ["Repetidas ignoradas", res?.duplicadas], ["Sem contrato", res?.sem_mapeamento]].map(([l, v]) =>
        <div key={l} className="rounded-md border bg-card p-5"><div className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">{l}</div><div className="mt-3 text-[32px] font-extralight leading-none tabular-nums">{v ?? "—"}</div></div>)}
    </div>
    <Bloco titulo="Códigos a Vincular">
      {!codigos?.length ? <p className="text-sm text-muted-foreground">Nenhum código pendente.</p> :
        <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
          <th className={tableClasses.th}>Código</th><th className={tableClasses.th}>Nome no Lidderar</th><th className={cn(tableClasses.th, "text-right")}>Linhas</th><th className={tableClasses.th}>Vincular a</th>
        </tr></thead><tbody>{codigos.map((c) => <tr key={c.codigo}>
          <td className={cn(tableClasses.td, "tabular-nums")}>{c.codigo}</td>
          <td className={cn(tableClasses.td, "zen-txt")}>{c.nome_no_lidderar ?? "—"}</td>
          <td className={tableClasses.num}>{contagem(c.codigo)}</td>
          <td className={tableClasses.td}><Select defaultValue="eventual" onValueChange={(v) => vincular(c.codigo, v)}>
            <SelectTrigger className="h-8 w-64 text-xs" aria-label={`Vincular ${c.codigo}`}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="eventual">Receita eventual</SelectItem>{contratos.map((l: any) => <SelectItem key={l.contrato_id} value={l.contrato_id}>{l.unidades} · {l.locatario}</SelectItem>)}</SelectContent>
          </Select></td>
        </tr>)}</tbody></table></div>}
      <p className="mt-3 text-xs text-muted-foreground">Reenviar o mesmo arquivo não duplica pagamentos: só acrescenta o que ainda não existe.</p>
    </Bloco>
    <Bloco titulo="Pagamentos Recebidos" acao={<span className="text-xs text-muted-foreground">{data.pags.length} pagamentos</span>}>
      <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
        {["Pagamento", "Vencimento", "Código", "Imóvel", "Contrato", "Atraso", "Valor líquido"].map((h, i) => <th key={h} className={cn(tableClasses.th, i >= 5 && "text-right")}>{h}</th>)}
      </tr></thead><tbody>{data.pags.map((p: any) => <tr key={p.id}>
        <td className={cn(tableClasses.td, "tabular-nums")}>{dt(p.data_pagamento)}</td>
        <td className={cn(tableClasses.td, "tabular-nums")}>{dt(p.data_vencimento)}</td>
        <td className={cn(tableClasses.td, "whitespace-nowrap tabular-nums text-muted-foreground")}>{p.codigo}</td>
        <td className={tableClasses.td}>{p.imovel_nome?.replace(`${data.edificio.nome} - `, "")}</td>
        <td className={cn(tableClasses.td, "zen-txt")}>{p.contrato_id ? (() => { const l = porContrato.get(p.contrato_id); return l ? `${l.unidades} · ${l.locatario}` : "—"; })() : <span className="op-tag op-tag-gray">Receita eventual</span>}</td>
        <td className={cn(tableClasses.num, p.dias_atraso > 3 && "text-destructive")}>{p.dias_atraso ? `${p.dias_atraso} d` : "—"}</td>
        <td className={tableClasses.num}>{brl(p.valor_liquido)}</td>
      </tr>)}</tbody></table></div>
    </Bloco>
  </div>;
}

export { num2 };
