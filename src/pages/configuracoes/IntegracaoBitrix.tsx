import { useEffect, useState } from "react";
import { Save, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Familia { id: string; nome: string; bitrix_marcador: string | null; }

export default function IntegracaoBitrix() {
  const { toast } = useToast();

  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSalvo, setWebhookSalvo] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testando, setTestando] = useState(false);
  const [testeOk, setTesteOk] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ familias: number; tarefas_sincronizadas: number } | null>(null);

  const [familias, setFamilias] = useState<Familia[]>([]);
  const [marcadores, setMarcadores] = useState<Record<string, string>>({});
  const [marcadoresBitrix, setMarcadoresBitrix] = useState<string[]>([]);
  const [loadingMarcadores, setLoadingMarcadores] = useState(false);
  const [savingFamilias, setSavingFamilias] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: cfg }, { data: fams }] = await Promise.all([
        supabase.from("configuracoes").select("valor").eq("chave", "bitrix_webhook_url").single(),
        supabase.from("familias_onboarding").select("id, nome, bitrix_marcador").order("nome"),
      ]);
      if (cfg?.valor) { setWebhookUrl(cfg.valor); setWebhookSalvo(cfg.valor); }
      if (fams) {
        setFamilias(fams as Familia[]);
        const map: Record<string, string> = {};
        fams.forEach((f: Familia) => { map[f.id] = f.bitrix_marcador ?? ""; });
        setMarcadores(map);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (webhookSalvo) buscarMarcadoresBitrix();
  }, [webhookSalvo]);

  async function salvarWebhook() {
    if (!webhookUrl.trim()) return;
    setSavingWebhook(true);
    const { error } = await supabase.from("configuracoes").upsert({
      chave: "bitrix_webhook_url", valor: webhookUrl.trim(),
    });
    setSavingWebhook(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    setWebhookSalvo(webhookUrl.trim());
    toast({ title: "Webhook salvo!" });
  }

  async function testarConexao() {
    setTestando(true); setTesteOk(null);
    try {
      const { data, error } = await supabase.functions.invoke("bitrix-proxy", {
        body: { action: "resumo_dashboard" },
      });
      setTesteOk(!error && data != null);
    } catch { setTesteOk(false); }
    finally { setTestando(false); }
  }

  async function sincronizarTudo() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("bitrix-sync", { body: {} });
      if (error) throw error;
      setSyncResult({ familias: data?.familias ?? 0, tarefas_sincronizadas: data?.tarefas_sincronizadas ?? 0 });
      toast({ title: "Sincronização concluída!", description: `${data?.tarefas_sincronizadas ?? 0} tarefas em ${data?.familias ?? 0} famílias.` });
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

    setLoadingMarcadores(true);
    try {
      const { data, error } = await supabase.functions.invoke("bitrix-proxy", {
        body: { action: "listar_marcadores" },
      });
      if (!error && data?.marcadores) setMarcadoresBitrix(data.marcadores);
    } catch { }
    finally { setLoadingMarcadores(false); }
  }

  async function salvarMarcadores() {
    setSavingFamilias(true);
    await Promise.all(
      Object.entries(marcadores).map(([id, marcador]) =>
        supabase.from("familias_onboarding")
          .update({ bitrix_marcador: marcador || null })
          .eq("id", id)
      )
    );
    setSavingFamilias(false);
    toast({ title: "Associações salvas!", description: "Cada família agora está vinculada ao seu marcador no Bitrix." });
  }

  return (
    <>
      <PageHeader
        title="Integração Bitrix24"
        subtitle="Configure a sincronização com o Bitrix24"
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Webhook de entrada</CardTitle>
          <CardDescription>
            URL gerada em{" "}
            <a
              href="https://sommainvestimentos.bitrix24.com.br/devops/rest/"
              target="_blank" rel="noopener noreferrer"
              className="underline inline-flex items-center gap-1"
            >
              Recursos para desenvolvedores <ExternalLink className="w-3 h-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>URL do Webhook</Label>
            <Input
              type="url"
              placeholder="https://sommainvestimentos.bitrix24.com.br/rest/1884/TOKEN/"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Mantenha esta URL em segredo.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={salvarWebhook} disabled={savingWebhook || !webhookUrl.trim()}>
              <Save className="w-4 h-4 mr-2" />
              {savingWebhook ? "Salvando..." : "Salvar"}
            </Button>
            {webhookSalvo && (
              <Button variant="outline" onClick={testarConexao} disabled={testando}>
                <RefreshCw className={`w-4 h-4 mr-2 ${testando ? "animate-spin" : ""}`} />
                Testar conexão
              </Button>
            )}
            {testeOk === true && (
              <Badge className="bg-green-100 text-green-800 border-0">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Conectado
              </Badge>
            )}
            {testeOk === false && (
              <Badge className="bg-red-100 text-red-800 border-0">
                <AlertTriangle className="w-3 h-3 mr-1" /> Falha na conexão
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Vincular famílias aos marcadores</CardTitle>
              <CardDescription className="mt-1">
                Selecione qual marcador do Bitrix corresponde a cada família.
                Os marcadores são carregados automaticamente das suas tarefas.
              </CardDescription>
            </div>
            {webhookSalvo && (
              <Button variant="outline" size="sm" onClick={buscarMarcadoresBitrix} disabled={loadingMarcadores}>
                {loadingMarcadores
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />}
                <span className="ml-2">Atualizar lista</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!webhookSalvo && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">Salve o webhook primeiro para carregar os marcadores do Bitrix.</p>
            </div>
          )}

          {webhookSalvo && loadingMarcadores && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Buscando marcadores do Bitrix...
            </div>
          )}

          {webhookSalvo && !loadingMarcadores && marcadoresBitrix.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <AlertTriangle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Nenhum marcador encontrado. Verifique se o webhook tem permissão de Tarefas e se há tarefas com marcadores no Bitrix.
              </p>
            </div>
          )}

          {webhookSalvo && !loadingMarcadores && marcadoresBitrix.length > 0 && (
            <>
              <div className="space-y-3">
                {familias.map(f => (
                  <div key={f.id} className="flex items-center gap-4">
                    <span className="text-sm font-medium w-52 flex-shrink-0 truncate">{f.nome}</span>
                    <Select
                      value={marcadores[f.id] || "__none__"}
                      onValueChange={val => setMarcadores(m => ({ ...m, [f.id]: val === "__none__" ? "" : val }))}
                    >
                      <SelectTrigger className="max-w-xs">
                        <SelectValue placeholder="Selecione o marcador..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Sem vínculo —</SelectItem>
                        {marcadoresBitrix.map(tag => (
                          <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={salvarMarcadores} disabled={savingFamilias} className="mt-2">
                <Save className="w-4 h-4 mr-2" />
                {savingFamilias ? "Salvando..." : "Salvar vínculos"}
              </Button>
            </>
          )}

          {familias.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma família cadastrada ainda.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
