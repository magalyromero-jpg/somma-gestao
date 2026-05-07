import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoWhite from "@/assets/somma-logo-white.png";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("E-mail de redefinição enviado");
  };

  return (
    <div className="min-h-screen grid place-items-center bg-card p-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <img src={logoWhite} alt="Somma" className="w-40" />
        </div>
        <div>
          <h1 className="text-2xl font-extralight text-foreground">Esqueci minha senha</h1>
          <p className="text-sm font-light text-muted-foreground mt-1">
            Informe o e-mail cadastrado e enviaremos um link para redefinir sua senha.
          </p>
        </div>
        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se houver uma conta para <strong>{email}</strong>, o link foi enviado. Verifique sua caixa
              de entrada e o spam.
            </p>
            <Link to="/login" className="text-sm text-gold hover:underline">
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-light text-xs uppercase tracking-wider">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-gold hover:bg-gold/90 text-gold-foreground"
            >
              {busy ? "Enviando…" : "Enviar link"}
            </Button>
            <div className="text-center">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
                Voltar ao login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
