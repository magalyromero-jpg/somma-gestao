import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useImoveis } from "@/hooks/useApiData";
import { useFamilias } from "@/hooks/useApiData";
import type { Classificacao, StatusLocacao } from "@/data/mock";
import { formatBRL, formatPct, pctClass } from "@/lib/format";
import { Download, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSkeleton, ErrorState } from "@/components/LoadingState";

export default function ImoveisLidderar() {
  const { imoveis, isLoading, error } = useImoveis();
  const { familias } = useFamilias();

  const [familia, setFamilia] = useState("todas");
  const [status, setStatus] = useState<string>("todos");
  const [classif, setClassif] = useState<string>("todas");
  const [cidade, setCidade] = useState("todas");
  const [q, setQ] = useState("");

  const cidades = useMemo(() => Array.from(new Set(imoveis.map((i) => i.cidade))).sort(), [imoveis]);

  const filtered = useMemo(
    () =>
      imoveis.filter(
        (i) =>
          (familia === "todas" || i.familia_id === familia) &&
          (status === "todos" || i.status === status) &&
          (classif === "todas" || i.classificacao === classif) &&
          (cidade === "todas" || i.cidade === cidade) &&
          (q === "" || `${i.endereco} ${i.cod_interno} ${i.bairro}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [imoveis, familia, status, classif, cidade, q],
  );

  const exportCSV = () => {
    const header = ["Cod", "Endereço", "Cidade", "UF", "Tipo", "Status", "Valor mercado", "Aluguel"];
    const rows = filtered.map((i) => [
      i.cod_interno,
      `"${i.endereco}"`,
      i.cidade,
      i.estado,
      i.tipo,
      i.status,
      i.valor_mercado,
      i.valor_aluguel_mensal,
    ]);
    const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "imoveis-somma.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Carregando portfólio..." : `${filtered.length} de ${imoveis.length} no portfólio Lidderar`}
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2" disabled={isLoading}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {error && <ErrorState error={error} hint="Verifique o token Lidderar em /configuracoes." />}

      <Card className="p-4 mb-4 shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar endereço / código" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={familia} onValueChange={setFamilia}>
            <SelectTrigger><SelectValue placeholder="Família" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as famílias</SelectItem>
              {familias.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              {(["Locado","Vago","Carencia","EmDesenvolvimento","Inativo"] as StatusLocacao[]).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={classif} onValueChange={setClassif}>
            <SelectTrigger><SelectValue placeholder="Classificação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas classificações</SelectItem>
              {(["Residencial","Comercial","Terreno","Participacao"] as Classificacao[]).map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cidade} onValueChange={setCidade}>
            <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas cidades</SelectItem>
              {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <LoadingSkeleton rows={8} />
      ) : (
        <Card className="shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/30 border-b">
                <tr>
                  <th className="text-left px-4 py-3">Imóvel</th>
                  <th className="text-left px-4 py-3">Família</th>
                  <th className="text-left px-4 py-3">Cidade</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Valor mercado</th>
                  <th className="text-right px-4 py-3">Aluguel</th>
                  <th className="text-right px-4 py-3">Valorização</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const fam = familias.find((f) => f.id === i.familia_id);
                  return (
                    <tr key={i.cod_imovel} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link to={`/imoveis/${i.cod_imovel}`} className="font-medium hover:text-gold">{i.endereco}</Link>
                        <div className="text-xs text-muted-foreground">{i.cod_interno} · {i.tipo}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fam?.nome ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{i.cidade}/{i.estado}</td>
                      <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                      <td className="px-4 py-3 text-right font-medium">{formatBRL(i.valor_mercado)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{i.valor_aluguel_mensal ? formatBRL(i.valor_aluguel_mensal) : "—"}</td>
                      <td className={cn("px-4 py-3 text-right", pctClass(i.valorizacao_pct))}>{formatPct(i.valorizacao_pct)}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhum imóvel encontrado com esses filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
