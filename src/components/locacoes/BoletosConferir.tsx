import { Fragment, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bloco } from "@/components/operacional/Shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tableClasses } from "./tabela";
import { brl, dt } from "@/lib/locacoes";
import { cn } from "@/lib/utils";

export function BoletosConferir({ edificio, itens, info, admin }: { edificio: string; itens: any[]; info: Map<string, any>; admin: boolean }) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function classificar(numero: string, natureza: "aluguel" | "outros") {
    setOcupado(true); setErro(null);
    try {
      const { error } = await supabase.rpc("loc_classificar_boleto", {
        p_edificio: edificio, p_nosso_numero: numero, p_natureza: natureza,
        p_descricao: natureza === "outros" ? descricao : null,
      });
      if (error) throw error;
      setEditando(null); setDescricao("");
      await Promise.all(["loc-planejamento", "loc-encargos", "loc-edificio"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
    } catch (e) { setErro(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Não foi possível classificar o boleto."); }
    finally { setOcupado(false); }
  }
  if (!itens.length) return null;
  return <Bloco titulo="Boletos a Conferir" acao={<span className="text-xs text-muted-foreground" title="Boletos de contrato com valor diferente do previsto do mês (diferença maior que R$ 2,00).">ⓘ</span>}>
    {erro && <p role="alert" className="mb-3 text-sm text-destructive">{erro}</p>}
    <table className={tableClasses.table}><thead><tr className={tableClasses.head}>
      {["Pagador", "Unidade", "Vencimento", "Valor do Boleto (R$)", "Previsto do Mês (R$)", "Status", ...(admin ? ["Ação"] : [])].map((h, i) => <th key={h} className={cn(tableClasses.th, (i === 3 || i === 4) && "text-right")}>{h}</th>)}
    </tr></thead><tbody>{itens.map((b) => <Fragment key={b.id}>
      <tr>
        <td className={tableClasses.td}>{b.pagador}</td><td className={tableClasses.td}>{info.get(b.contrato_id)?.unidades ?? "—"}</td>
        <td className={cn(tableClasses.td, "tabular-nums")}>{dt(b.data_vencimento)}</td>
        <td className={tableClasses.num}>{brl(b.valor_titulo)}</td><td className={tableClasses.num}>{brl(b.previsto_mes)}</td>
        <td className={tableClasses.td}>{({ paga: "Pago", vencida: "Vencido", a_vencer: "A Vencer" } as Record<string, string>)[b.status] ?? b.status}</td>
        {admin && <td className={tableClasses.td}><div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => classificar(b.nosso_numero, "aluguel")}>É Aluguel</Button>
          <Button size="sm" variant="outline" disabled={ocupado} onClick={() => { setEditando(b.nosso_numero); setDescricao(""); }}>Não É Aluguel</Button>
        </div></td>}
      </tr>
      {admin && editando === b.nosso_numero && <tr><td colSpan={7} className={tableClasses.td}>
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); classificar(b.nosso_numero, "outros"); }}>
          <Input aria-label="Descrição" placeholder="Descrição…" className="max-w-sm" value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={ocupado} />
          <Button type="submit" size="sm" disabled={ocupado}>Confirmar</Button>
        </form>
      </td></tr>}
    </Fragment>)}</tbody></table>
  </Bloco>;
}