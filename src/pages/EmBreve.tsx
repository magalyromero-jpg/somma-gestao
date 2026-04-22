import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function EmBreve({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <>
      <PageHeader title={titulo} subtitle={subtitulo} />
      <Card className="shadow-card">
        <CardContent className="p-12 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-gold/15 text-gold mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <h3 className="text-lg font-semibold mb-1">Em breve nesta versão</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Esta área já está mapeada no escopo do produto e será habilitada após a sincronização
            com a API Lidderar via Edge Function.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
