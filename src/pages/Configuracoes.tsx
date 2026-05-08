import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { HistoricoAtividades } from "./configuracoes/HistoricoAtividades";

export default function Configuracoes() {
  const [token, setToken] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", ["lidderar_bearer_token", "lidderar_usuario", "lidderar_senha"]);
      data?.forEach((row) => {
        if (row.chave === "lidderar_bearer_token" && row.valor) setToken(row.valor);
        if (row.chave === "lidderar_usuario" && row.valor) setUsuario(row.valor);
        if (row.chave === "lidderar_senha" && row.valor) setSenha(row.valor);
      });
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

  const handleSaveCredentials = async () => {
    if (!usuario.trim() || !senha.trim()) {
      toast.error("Informe usuário e senha");
      return;
    }
    setSavingCreds(true);
    const { error } = await supabase.from("configuracoes").upsert([
      { chave: "lidderar_usuario", valor: usuario.trim() },
      { chave: "lidderar_senha", valor: senha },
    ]);
    setSavingCreds(false);
    if (error) toast.error(error.message);
    else toast.success("Credenciais salvas — renovação automática habilitada");
  };

  const handleRenewNow = async () => {
    setRenewing(true);
    try {
      const { data, error } = await supabase.functions.invoke("lidderar-auth", {
        body: { usuario: usuario.trim(), senha },
      });
      if (error || (data as any)?.error) {
        throw new Error(error?.message ?? (data as any).error);
      }
      const preview = (data as any)?.token_preview;
      const ep = (data as any)?.endpoint_usado;
      toast.success(`Token renovado via ${ep} (${preview}…)`);
      // recarrega o token exibido
      const { data: row } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "lidderar_bearer_token")
        .maybeSingle();
      if (row?.valor) setToken(row.valor);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao renovar");
    } finally {
      setRenewing(false);
    }
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
      <PageHeader title="Configurações" subtitle="Token Lidderar, integrações e histórico" />

      <Tabs defaultValue="integracoes">
        <TabsList>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Atividades</TabsTrigger>
        </TabsList>

        <TabsContent value="integracoes" className="mt-4">
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
                <CardTitle className="font-light text-base">Renovação Automática — Login Lidderar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="font-light text-xs uppercase tracking-wider">Usuário / E-mail</Label>
                  <Input
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    placeholder={loading ? "Carregando…" : "seu.usuario@empresa.com"}
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-light text-xs uppercase tracking-wider">Senha</Label>
                  <div className="relative">
                    <Input
                      type={showSenha ? "text" : "password"}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder={loading ? "Carregando…" : "••••••••"}
                      className="pr-10"
                      disabled={loading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] font-light text-muted-foreground">
                    Com as credenciais salvas, o sistema renova o token automaticamente quando a
                    Lidderar retornar 401/403.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveCredentials}
                    disabled={savingCreds || loading}
                    className="bg-gold hover:bg-gold/90 text-gold-foreground"
                  >
                    {savingCreds && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar Credenciais
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRenewNow}
                    disabled={renewing || !usuario || !senha}
                  >
                    {renewing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Renovar Token Agora
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoricoAtividades />
        </TabsContent>
      </Tabs>
    </>
  );
}
