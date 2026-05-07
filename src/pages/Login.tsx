import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoWhite from "@/assets/somma-logo-white.png";

export default function Login() {
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  if (!authLoading && user) {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/familias";
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } =
      mode === "signin" ? await signIn(email, password) : await signUp(email, password, nome);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (mode === "signup") {
      toast.success("Conta criada! Verifique seu e-mail e faça login.");
      setMode("signin");
    } else {
      navigate("/familias", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado esquerdo escuro */}
      <div className="hidden md:flex md:w-1/2 bg-primary text-primary-foreground relative overflow-hidden flex-col justify-between p-12">
        {/* SVG ondas decorativas */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.07]"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 800 800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          {Array.from({ length: 14 }).map((_, i) => (
            <path
              key={i}
              d={`M -100 ${100 + i * 50} Q 200 ${50 + i * 50}, 400 ${120 + i * 50} T 900 ${100 + i * 50}`}
              stroke="white"
              strokeWidth="1"
              fill="none"
            />
          ))}
        </svg>

        <div className="relative z-10 flex flex-col items-center justify-center flex-1">
          <img src={logoWhite} alt="Somma Multi-Family Office" className="w-64 mb-8 brightness-0 invert" />
          <p className="text-center text-lg font-extralight tracking-wide text-white/85">
            Gestão de Ativos Imobiliários
          </p>
        </div>

        <div className="relative z-10 text-xs font-light text-white/60 text-center">
          Somma Multi-Family Office · Plataforma Restrita
        </div>
      </div>

      {/* Lado direito: formulário */}
      <div className="flex-1 flex items-center justify-center bg-card p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="md:hidden flex justify-center">
            <img src={logoWhite} alt="Somma" className="w-40" />
          </div>
          <div>
            <h1 className="text-2xl font-extralight text-foreground">
              {mode === "signin" ? "Acessar plataforma" : "Criar conta"}
            </h1>
            <p className="text-sm font-light text-muted-foreground mt-1">
              {mode === "signin"
                ? "Entre com suas credenciais Somma"
                : "Cadastro inicial — acesso será liberado pelo gestor"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="nome" className="font-light text-xs uppercase tracking-wider">
                  Nome
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            )}
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
            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-light text-xs uppercase tracking-wider">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-gold hover:bg-gold/90 text-gold-foreground font-medium tracking-wide"
            >
              {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>

            {mode === "signin" && (
              <div className="text-center">
                <Link to="/auth/forgot-password" className="text-xs font-light text-muted-foreground hover:text-foreground">
                  Esqueci minha senha
                </Link>
              </div>
            )}
          </form>

          <div className="text-center text-sm">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground font-light"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
            </button>
          </div>

          <div className="pt-6 border-t border-border text-[11px] text-center font-light text-muted-foreground">
            Somma Multi-Family Office · Plataforma Restrita
          </div>
        </div>
      </div>
    </div>
  );
}
