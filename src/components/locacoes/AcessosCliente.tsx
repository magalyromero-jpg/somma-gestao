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

/** Acesso de um usuário aos edifícios (Administração › Usuários). Só admin. */
export function AcessoEdificios({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["loc-acessos-usuario", userId],
    queryFn: async () => {
      const [ed, ac] = await Promise.all([
        db.from("loc_edificios").select("id,nome").order("nome"),
        db.rpc("loc_acessos_do_usuario", { p_user: userId }),
      ]);
      if (ed.error) throw ed.error;
      if (ac.error) throw ac.error;
      return { edificios: ed.data ?? [], acessos: new Map<string, string>((ac.data ?? []).map((a: any) => [a.edificio_id, a.papel])) };
    },
  });
  const [papeis, setPapeis] = useState<Record<string, string>>({});
  const recarregar = () => qc.invalidateQueries({ queryKey: ["loc-acessos-usuario", userId] });
  const conceder = async (edificio: string) => {
    const papel = papeis[edificio] ?? data?.acessos.get(edificio) ?? "cliente";
    const { error } = await db.rpc("loc_definir_acesso", { p_edificio: edificio, p_user: userId, p_papel: papel });
    if (error) return toast({ title: "Não foi possível conceder", description: error.message, variant: "destructive" });
    toast({ title: "Acesso concedido" }); recarregar();
  };
  const revogar = async (edificio: string) => {
    const { error } = await db.rpc("loc_revogar_acesso", { p_edificio: edificio, p_user: userId });
    if (error) return toast({ title: "Não foi possível revogar", description: error.message, variant: "destructive" });
    toast({ title: "Acesso revogado" }); recarregar();
  };
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  return <div className="space-y-2">
    <h3 className="text-[15px] font-medium">Acesso a edifícios</h3>
    <table className="w-full text-[13px]"><thead><tr className="border-b text-left text-[11px] font-bold uppercase tracking-[0.04em] text-secondary">
      <th className="px-[10px] py-2">Edifício</th><th className="px-[10px] py-2">Papel</th><th className="px-[10px] py-2">Situação</th><th className="px-[10px] py-2"></th>
    </tr></thead><tbody>{(data?.edificios ?? []).map((e: any) => {
      const atual = data?.acessos.get(e.id);
      return <tr key={e.id} className="border-b">
        <td className="px-[10px] py-2.5 font-medium">{e.nome}</td>
        <td className="px-[10px] py-2.5"><Select value={papeis[e.id] ?? atual ?? "cliente"} onValueChange={(v) => setPapeis((p) => ({ ...p, [e.id]: v }))}>
          <SelectTrigger className="h-8 w-52 text-xs" aria-label={`Papel em ${e.nome}`}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="admin">Admin Somma</SelectItem><SelectItem value="cliente">Cliente somente leitura</SelectItem></SelectContent>
        </Select></td>
        <td className="px-[10px] py-2.5">{atual ? <span className="op-tag op-tag-green">{atual === "admin" ? "Admin Somma" : "Cliente"}</span> : <span className="op-tag op-tag-gray">Sem acesso</span>}</td>
        <td className="px-[10px] py-2.5 text-right whitespace-nowrap">
          <Button size="sm" onClick={() => conceder(e.id)}>Conceder</Button>
          {atual && <Button size="sm" variant="outline" className="ml-2" onClick={() => revogar(e.id)}>Revogar</Button>}
        </td>
      </tr>;
    })}</tbody></table>
  </div>;
}
