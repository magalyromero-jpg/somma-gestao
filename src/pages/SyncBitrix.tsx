import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";

export default function SyncBitrix() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  const iniciarSync = async () => {
    setLoading(true);
    setResultado(null);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("bitrix-sync", {
        body: { modo: "completo" },
      });
      if (error) throw error;
      setResultado(data);
    } catch (err: any) {
      setErro(err.message || "Erro ao sincronizar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sincronização Bitrix"
        subtitle="Sincronize todas as famílias e tarefas do Bitrix para o banco local"
      />

      <Card>
        <CardContent className="p-6 space-y-4">
          <Button
            onClick={iniciarSync}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Iniciar sincronização completa
              </>
            )}
          </Button>

          {erro && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {resultado && (
            <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-4 text-green-700">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">Sincronização concluída!</p>
                <p className="text-sm">
                  Famílias: <strong>{resultado.familias}</strong> — Tarefas sincronizadas:{" "}
                  <strong>{resultado.tarefas_sincronizadas}</strong>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
