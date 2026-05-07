import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";

type Perfil = "admin" | "gestor" | "analista" | "familia";
type Status = "ativo" | "pendente" | "inativo";

interface UsuarioRow {
  user_id: string;
  nome: string | null;
  email: string | null;
  status: Status;
  role: Perfil | null;
}

const perfilLabel: Record<Perfil, string> = {
  admin: "Admin",
  gestor: "Gestor",
  analista: "Analista",
  familia: "Família",
};

export default function Usuarios() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // form
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState<"admin" | "gestor" | "analista">("analista");
  const [modo, setModo] = useState<"convite" | "senha">("convite");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

  async function carregar() {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, nome, email, status").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const rolesByUser = new Map<string, Perfil>();
    (roles ?? []).forEach((r: any) => {
      const current = rolesByUser.get(r.user_id);
      // precedência admin > gestor > analista > familia
      const order: Record<Perfil, number> = { admin: 4, gestor: 3, analista: 2, familia: 1 };
      if (!current || order[r.role as Perfil] > order[current]) rolesByUser.set(r.user_id, r.role);
    });
    const rows: UsuarioRow[] = (profiles ?? []).map((p: any) => ({
      user_id: p.user_id,
      nome: p.nome,
      email: p.email,
      status: (p.status ?? "pendente") as Status,
      role: rolesByUser.get(p.user_id) ?? null,
    }));
    setUsuarios(rows);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function convidar(e: React.FormEvent) {
    e.preventDefault();
    if (modo === "senha" && senha.length < 8) {
      toast.error("Senha deve ter ao menos 8 caracteres");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { nome, email, perfil, ...(modo === "senha" ? { senha } : {}) },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Falha ao criar usuário");
      return;
    }
    toast.success(modo === "senha" ? "Usuário criado com senha" : "Convite enviado");
    setOpen(false);
    setNome(""); setEmail(""); setPerfil("analista"); setSenha(""); setModo("convite");
    carregar();
  }

  async function alterarStatus(user_id: string, status: Status) {
    const { error } = await supabase.from("profiles").update({ status }).eq("user_id", user_id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    carregar();
  }

  async function alterarPerfil(user_id: string, novo: "admin" | "gestor" | "analista") {
    await supabase.from("user_roles").delete().eq("user_id", user_id);
    const { error } = await supabase.from("user_roles").insert({ user_id, role: novo });
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    carregar();
  }

  async function reenviar(u: UsuarioRow) {
    if (!u.email) return;
    const perfilEnvio = (u.role && u.role !== "familia" ? u.role : "analista") as "admin" | "gestor" | "analista";
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: { nome: u.nome ?? u.email, email: u.email, perfil: perfilEnvio },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Falha ao reenviar convite");
      return;
    }
    toast.success(`Convite reenviado para ${u.email}`);
  }

  async function copiarLink(u: UsuarioRow) {
    if (!u.email) return;
    const { data, error } = await supabase.functions.invoke("get-invite-link", {
      body: { email: u.email },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Falha ao gerar link");
      return;
    }
    const link = (data as any)?.action_link;
    if (!link) return toast.error("Link não retornado");
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado! Válido por 24h.");
    } catch {
      toast.error("Não foi possível copiar", { description: link });
    }
  }

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Gerencie quem tem acesso à plataforma Somma"
        actions={
          isAdmin ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gold hover:bg-gold/90 text-gold-foreground gap-2">
                  <Plus className="h-4 w-4" /> Convidar usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" /> Convidar novo usuário
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={convidar} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome">Nome completo</Label>
                    <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Perfil</Label>
                    <Select value={perfil} onValueChange={(v) => setPerfil(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin — acesso total + gestão de usuários</SelectItem>
                        <SelectItem value="gestor">Gestor — acesso total</SelectItem>
                        <SelectItem value="analista">Analista — leitura + upload</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Modo de criação</Label>
                    <div className="flex gap-2">
                      <Button type="button" size="sm"
                        variant={modo === "convite" ? "default" : "outline"}
                        onClick={() => setModo("convite")}>
                        Enviar convite por e-mail
                      </Button>
                      <Button type="button" size="sm"
                        variant={modo === "senha" ? "default" : "outline"}
                        onClick={() => setModo("senha")}>
                        Definir senha agora
                      </Button>
                    </div>
                  </div>
                  {modo === "senha" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="senha">Senha (mín. 8 caracteres)</Label>
                      <Input
                        id="senha"
                        type="text"
                        autoComplete="new-password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        minLength={8}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        O usuário entra direto com este e-mail e senha. E-mail já vai confirmado.
                      </p>
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={busy} className="bg-gold hover:bg-gold/90 text-gold-foreground">
                      {busy ? "Enviando…" : modo === "senha" ? "Criar usuário" : "Enviar convite"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-muted/30 border-b">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">E-mail</th>
                <th className="text-left px-4 py-3">Perfil</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Carregando…</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhum usuário ainda.</td></tr>
              ) : usuarios.map((u) => (
                <tr key={u.user_id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{u.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    {isAdmin && u.role && u.role !== "familia" ? (
                      <Select value={u.role} onValueChange={(v) => alterarPerfil(u.user_id, v as any)}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="gestor">Gestor</SelectItem>
                          <SelectItem value="analista">Analista</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span>{u.role ? perfilLabel[u.role] : "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={u.status === "ativo" ? "default" : u.status === "pendente" ? "secondary" : "outline"}
                      className={
                        u.status === "ativo" ? "bg-green-100 text-green-800 hover:bg-green-100"
                        : u.status === "pendente" ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                        : "bg-muted text-muted-foreground"
                      }
                    >
                      {u.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin && u.status === "pendente" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => reenviar(u)}>
                          Reenviar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => copiarLink(u)}>
                          Copiar link
                        </Button>
                      </>
                    )}
                    {isAdmin && u.status !== "inativo" && (
                      <Button size="sm" variant="ghost" onClick={() => alterarStatus(u.user_id, "inativo")}>
                        Desativar
                      </Button>
                    )}
                    {isAdmin && u.status === "inativo" && (
                      <Button size="sm" variant="ghost" onClick={() => alterarStatus(u.user_id, "ativo")}>
                        Reativar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
