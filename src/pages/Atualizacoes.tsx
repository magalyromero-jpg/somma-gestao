import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatPct, pctClass } from "@/lib/format";

export default function Atualizacoes() {
  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["historico_valores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_valores")
        .select("*")
        .order("data_atualizacao", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <PageHeader title="Atualizações" subtitle="Histórico de revisões de valor de mercado" />

      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-base font-extralight text-foreground mb-1">Histórico de revisões</h2>
          <p className="text-sm font-light text-muted-foreground">
            Edições de valor de mercado feitas no portfólio aparecem registradas abaixo.
          </p>
        </CardContent>
      </Card>

      <h2 className="text-lg font-extralight text-foreground mb-3">Histórico</h2>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Imóvel</TableHead>
                <TableHead className="text-right">Anterior</TableHead>
                <TableHead className="text-right">Novo</TableHead>
                <TableHead className="text-right">Variação</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Justificativa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center py-6 font-light text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && historico.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 font-light text-muted-foreground">Nenhuma atualização registrada ainda.</TableCell></TableRow>
              )}
              {historico.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-mono text-xs">
                    {new Date(h.data_atualizacao).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="font-light">{h.cod_interno ?? `#${h.cod_imovel}`}</TableCell>
                  <TableCell className="text-right">{formatBRL(Number(h.valor_anterior ?? 0))}</TableCell>
                  <TableCell className="text-right">{formatBRL(Number(h.valor_novo ?? 0))}</TableCell>
                  <TableCell className={`text-right ${pctClass(Number(h.variacao_pct ?? 0))}`}>
                    {formatPct(Number(h.variacao_pct ?? 0))}
                  </TableCell>
                  <TableCell className="font-light text-xs">{h.fonte ?? "—"}</TableCell>
                  <TableCell className="font-light text-xs text-muted-foreground max-w-xs truncate">
                    {h.justificativa ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
