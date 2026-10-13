import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {  Bloco,   } from "@/components/operacional/Shared";
import { tableClasses } from "@/components/locacoes/tabela";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const db = supabase as any;

const MSG: Record<string, string> = {
  usuario_nao_encontrado: "Nenhum usuário com esse e-mail. Peça para a pessoa criar a conta primeiro.",
  usuario_da_equipe: "Esse e-mail é da equipe e já vê tudo.",
};

export function AcessosCliente({ edificioId }: { edificioId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);
  const key = ["loc-acessos", edificioId];
  const { data = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await db.rpc("loc_listar_acessos", { p_edificio: edificioId });
      if (error) throw error;
      return data as { user_id: string; email: string | null; nome: string | null; papel: string }[];
    },
  });

  const conceder = async () => {
    if (!email.trim()) return;
    setSalvando(true);
    const { data: r, error } = await db.rpc("loc_conceder_acesso", { p_edificio: edificioId, p_email: email });
    setSalvando(false);
    if (error) return toast({ title: "Não foi possível liberar", description: error.message, variant: "destructive" });
    if (r !== "ok") return toast({ title: "Acesso não liberado", description: MSG[r] ?? r, variant: "destructive" });
    toast({ title: "Acesso liberado", description: `${email} agora vê este edifício na Área do Cliente.` });
    setEmail("");
    qc.invalidateQueries({ queryKey: key });
  };

  const revogar = async (uid: string) => {
    const { error } = await db.rpc("loc_revogar_acesso", { p_edificio: edificioId, p_user: uid });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <Bloco titulo="Clientes com acesso (somente leitura)">
      <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); conceder(); }}>
        <Input type="email" autoComplete="off" name="email-cliente-acesso" placeholder="e-mail do cliente" value={email} onChange={(e) => setEmail(e.target.value)} className="max-w-xs" />
        <Button type="submit" disabled={salvando}>Liberar acesso</Button>
      </form>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente com acesso ainda.</p>
      ) : (
        <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>
          <th className={tableClasses.th}>Nome</th><th className={tableClasses.th}>E-mail</th><th className={tableClasses.th}></th>
        </tr></thead><tbody>{data.map((a) => <tr key={a.user_id}>
          <td className={tableClasses.td + " zen-txt"}>{a.nome ?? "—"}</td>
          <td className={tableClasses.td}>{a.email ?? "—"}</td>
          <td className={tableClasses.td}><Button size="sm" variant="ghost" onClick={() => revogar(a.user_id)}>Remover</Button></td>
        </tr>)}</tbody></table></div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">O cliente vê apenas Visão geral, Contratos e Fluxo de caixa deste edifício.</p>
    </Bloco>
  );
}
