import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { familias, imoveisPorFamilia, kpisFamilia, type Classificacao } from "@/data/mock";
import { formatBRL, formatPct, pctClass } from "@/lib/format";
import { Building2, Wallet, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FamiliaDetalhe() {
  const { id = "" } = useParams();
  const familia = familias.find((f) => f.id === id);
  if (!familia)
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Família não encontrada.</p>
        <Link to="/familias" className="text-gold underline mt-2 inline-block">Voltar</Link>
      </div>
    );

  const k = kpisFamilia(familia.id);
  const lista = imoveisPorFamilia(familia.id);

  const tabs: { key: "todos" | Classificacao; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "Residencial", label: "Residencial" },
    { key: "Comercial", label: "Comercial" },
    { key: "Terreno", label: "Terrenos" },
    { key: "Participacao", label: "Participações" },
  ];

  return (
    <>
      <div className="flex items-center gap-4 mb-2">
        <div
          className="h-14 w-14 rounded-full grid place-items-center text-white font-semibold text-xl shrink-0"
          style={{ backgroundColor: familia.cor_avatar }}
        >
          {familia.nome.split(" ").pop()?.[0]}
        </div>
        <PageHeader title={familia.nome} subtitle={`${k.total} imóveis sob gestão`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Imóveis" value={String(k.total)} icon={<Building2 className="h-4 w-4" />} />
        <KpiCard label="Valor de mercado" value={formatBRL(k.valor_mercado, { compact: true })} icon={<TrendingUp className="h-4 w-4" />} delta={k.valorizacao} />
        <KpiCard label="Receita mensal" value={formatBRL(k.receita_mensal, { compact: true })} icon={<Wallet className="h-4 w-4" />} hint={`${k.locados} locados`} />
        <KpiCard label="Membros" value={String(familia.membros.length)} icon={<Users className="h-4 w-4" />} />
      </div>

      <Card className="shadow-card mb-6">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">Membros</h3>
          <div className="flex flex-wrap gap-2">
            {familia.membros.map((m) => (
              <span
                key={m.id}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border",
                  m.tipo === "empresa"
                    ? "bg-primary/5 border-primary/20 text-primary"
                    : "bg-muted/40 border-border",
                )}
              >
                <span className="text-xs uppercase tracking-wider opacity-60">{m.tipo}</span>
                {m.nome}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="todos" className="w-full">
        <TabsList className="bg-muted/50">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="data-[state=active]:bg-card data-[state=active]:text-foreground">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => {
          const filtered = t.key === "todos" ? lista : lista.filter((i) => i.classificacao === t.key);
          return (
            <TabsContent key={t.key} value={t.key} className="mt-4">
              <Card className="shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground bg-muted/30 border-b">
                      <tr>
                        <th className="text-left px-4 py-3">Endereço</th>
                        <th className="text-left px-4 py-3">Cidade</th>
                        <th className="text-left px-4 py-3">Tipo</th>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="text-right px-4 py-3">Valor mercado</th>
                        <th className="text-right px-4 py-3">Aluguel/mês</th>
                        <th className="text-right px-4 py-3">Valorização</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((i) => (
                        <tr key={i.cod_imovel} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <Link to={`/imoveis/${i.cod_imovel}`} className="font-medium hover:text-gold">
                              {i.endereco}
                            </Link>
                            <div className="text-xs text-muted-foreground">{i.cod_interno} · {i.bairro}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{i.cidade}/{i.estado}</td>
                          <td className="px-4 py-3 text-muted-foreground">{i.tipo}</td>
                          <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                          <td className="px-4 py-3 text-right font-medium">{formatBRL(i.valor_mercado)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {i.valor_aluguel_mensal ? formatBRL(i.valor_aluguel_mensal) : "—"}
                          </td>
                          <td className={cn("px-4 py-3 text-right", pctClass(i.valorizacao_pct))}>
                            {formatPct(i.valorizacao_pct)}
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum imóvel nesta categoria.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </>
  );
}
