import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoWhite from "@/assets/somma-logo-white.png";

interface Props {
  mode: "set" | "reset";
}

export default function SetPassword({ mode }: Props) {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Supabase coloca a sessão automaticamente quando vem do link de invite/recovery
    supabase.auth.getSession().then(({ data: { session } }) => setHasSession(!!session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (senha !== confirmar) {
      toast.error("As senhas não coincidem");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(mode === "set" ? "Senha definida com sucesso" : "Senha redefinida com sucesso");
    navigate("/familias", { replace: true });
  };

  const titulo = mode === "set" ? "Definir senha de acesso" : "Redefinir senha";
  const subtitulo =
    mode === "set"
      ? "Crie uma senha para acessar a plataforma Somma."
      : "Crie uma nova senha para sua conta.";

  return (
    <div className="min-h-screen grid place-items-center bg-card p-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <img src={logoWhite} alt="Somma" className="w-40" />
        </div>
        <div>
          <h1 className="text-2xl font-extralight text-foreground">{titulo}</h1>
          <p className="text-sm font-light text-muted-foreground mt-1">{subtitulo}</p>
        </div>
        {hasSession === false ? (
          <p className="text-sm text-muted-foreground">
            Link inválido ou expirado. Solicite um novo link na tela de login.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="senha" className="font-light text-xs uppercase tracking-wider">
                Nova senha
              </Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmar" className="font-light text-xs uppercase tracking-wider">
                Confirmar senha
              </Label>
              <Input
                id="confirmar"
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              disabled={busy || hasSession === null}
              className="w-full bg-gold hover:bg-gold/90 text-gold-foreground"
            >
              {busy ? "Salvando…" : mode === "set" ? "Definir senha e entrar" : "Redefinir senha"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
