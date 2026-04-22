import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function Configuracoes() {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "lidderar_bearer_token")
        .maybeSingle();
      if (data?.valor) setToken(data.valor);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!token.trim()) {
      toast.error("Informe o token");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("configuracoes")
      .upsert({ chave: "lidderar_bearer_token", valor: token.trim() });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Token salvo com segurança");
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("lidderar-proxy", {
        body: { endpoint: "/imoveis/getall", params: {} },
      });
      if (error || data?.error) throw new Error(error?.message ?? data.error);
      setTestResult("success");
      toast.success("Conexão Lidderar OK");
    } catch (e) {
      setTestResult("error");
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <PageHeader title="Configurações" subtitle="Token Lidderar e parâmetros do sistema" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="font-light text-base">API Lidderar — Bearer Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-light text-xs uppercase tracking-wider">Token</Label>
              <div className="relative">
                <Input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={loading ? "Carregando…" : "Cole o Bearer Token aqui"}
                  className="pr-10 font-mono text-xs"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] font-light text-muted-foreground">
                Para renovar: login em sistema.lidderar.com.br → DevTools → Network → copie o
                valor de <strong>Authorization</strong> (sem &quot;Bearer &quot;).
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || loading} className="bg-gold hover:bg-gold/90 text-gold-foreground">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Token
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing || !token}>
                {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Testar Conexão
              </Button>
            </div>

            {testResult === "success" && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" /> Conexão estabelecida
              </div>
            )}
            {testResult === "error" && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" /> Falha na conexão — verifique o token
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-light text-base">Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-light text-muted-foreground space-y-3">
            <p>
              O token é armazenado com segurança no backend e <strong>nunca é exposto</strong> ao
              navegador. Todas as chamadas à API Lidderar passam pela Edge Function{" "}
              <code className="px-1.5 py-0.5 bg-muted rounded text-xs">lidderar-proxy</code>.
            </p>
            <p>
              Após salvar e testar, as páginas Imóveis, Famílias e Detalhe poderão consumir os
              dados reais via o hook{" "}
              <code className="px-1.5 py-0.5 bg-muted rounded text-xs">useLidderar()</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
