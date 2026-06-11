import { useEffect, useState } from "react";
import { Save, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Familia { id: string; nome: string; bitrix_marcador: string | null; }

export default function IntegracaoBitrix() {
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSalvo, setWebhookSalvo] = useState("");
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [marcadores, setMarcadores] = useState<Record<string, string>>({});
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [savingFamilias, setSavingFamilias] = useState(false);
  const [testando, setTestando] = useState(false);
  const [testeOk, setTesteOk] = useState<boolean | null>(null);

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

  async function salvarWebhook() {
    if (!webhookUrl.trim()) return;
    setSavingWebhook(true);
    const { error } = await supabase.from("configuracoes").upsert({ chave: "bitrix_webhook_url", valor: webhookUrl.trim() });
    setSavingWebhook(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    setWebhookSalvo(webhookUrl.trim());
    toast({ title: "Webhook salvo com sucesso!" });
  }

  async function testarConexao() {
    setTestando(true); setTesteOk(null);
    try {
      const { data, error } = await supabase.functions.invoke("bitrix-proxy", { body: { action: "resumo_dashboard" } });
      setTesteOk(!error && data != null);
    } catch { setTesteOk(false); } finally { setTestando(false); }
  }

  async function salvarMarcadores() {
    setSavingFamilias(true);
    await Promise.all(Object.entries(marcadores).map(([id, marcador]) =>
      supabase.from("familias_onboarding").update({ bitrix_marcador: marcador || null }).eq("id", id)
    ));
    setSavingFamilias(false);
    toast({ title: "Marcadores salvos!", description: "Associações família ↔ Bitrix atualizadas." });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Integração Bitrix" description="Configure a sincronização com o Bitrix24." />

      <Card>
        <CardHeader>
          <CardTitle>Webhook de entrada</CardTitle>
          <CardDescription>
            URL gerada em{" "}
            <a href="https://www.bitrix24.com.br/apps/webhook/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              Recursos para desenvolvedores <ExternalLink size={12} className="inline ml-0.5" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="webhook">URL do Webhook</Label>
            <Input id="webhook" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://sua-conta.bitrix24.com.br/rest/..." />
            <p className="text-xs text-muted-foreground">Mantenha esta URL em segredo.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={salvarWebhook} disabled={savingWebhook || !webhookUrl.trim()}>
              <Save size={16} className="mr-2" />
              {savingWebhook ? "Salvando..." : "Salvar"}
            </Button>
            {webhookSalvo && (
              <Button variant="outline" onClick={testarConexao} disabled={testando}>
                <RefreshCw size={16} className={`mr-2 ${testando ? "animate-spin" : ""}`} />
                Testar conexão
              </Button>
            )}
            {testeOk === true && <Badge variant="outline" className="text-green-600 border-green-300"><CheckCircle2 size={14} className="mr-1" /> Conectado</Badge>}
            {testeOk === false && <Badge variant="outline" className="text-red-600 border-red-300"><AlertTriangle size={14} className="mr-1" /> Falha na conexão</Badge>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Marcadores por família</CardTitle>
          <CardDescription>Informe o marcador exato do Bitrix que identifica cada família. Ex: "F. Glavam", "F. Tavares"</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            {familias.map(f => (
              <div key={f.id} className="grid gap-1.5">
                <Label htmlFor={`m-${f.id}`}>{f.nome}</Label>
                <Input id={`m-${f.id}`} value={marcadores[f.id] ?? ""} onChange={e => setMarcadores(m => ({ ...m, [f.id]: e.target.value }))} placeholder="Marcador Bitrix" className="max-w-xs" />
              </div>
            ))}
          </div>
          {familias.length > 0 && (
            <Button onClick={salvarMarcadores} disabled={savingFamilias}>
              <Save size={16} className="mr-2" />
              {savingFamilias ? "Salvando..." : "Salvar marcadores"}
            </Button>
          )}
          {familias.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma família cadastrada ainda.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
