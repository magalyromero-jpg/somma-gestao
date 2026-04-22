import { Link, useParams } from "react-router-dom";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { KpiCard } from "@/components/KpiCard";
import { imoveis, familias } from "@/data/mock";
import { formatBRL, formatPct, pctClass } from "@/lib/format";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { ExternalLink, MapPin, TrendingUp, Wallet, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Fix default Leaflet icon paths in Vite
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

export default function ImovelDetalhe() {
  const { codImovel = "" } = useParams();
  const imovel = imoveis.find((i) => String(i.cod_imovel) === codImovel);

  useEffect(() => {
    // ensure leaflet recalculates size after mount
    setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
  }, []);

  if (!imovel)
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Imóvel não encontrado.</p>
        <Link to="/imoveis" className="text-gold underline mt-2 inline-block">Voltar</Link>
      </div>
    );

  const familia = familias.find((f) => f.id === imovel.familia_id);
  const monthlyChart =
    imovel.contrato_ativo?.pagamentos.map((p) => ({
      mes: p.mes.slice(5),
      bruto: p.bruto,
      liquido: p.liquido,
    })) ?? [];

  return (
    <>
      <div className="text-sm text-muted-foreground mb-2">
        <Link to="/imoveis" className="hover:text-gold">Imóveis</Link> ·{" "}
        <Link to={`/familias/${familia?.id}`} className="hover:text-gold">{familia?.nome}</Link>
      </div>
      <PageHeader
        title={imovel.endereco}
        subtitle={`${imovel.cod_interno} · ${imovel.bairro}, ${imovel.cidade}/${imovel.estado}`}
        actions={<StatusBadge status={imovel.status} className="text-sm px-3 py-1" />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Valor de mercado" value={formatBRL(imovel.valor_mercado, { compact: true })} delta={imovel.valorizacao_pct} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label="Valor de compra" value={formatBRL(imovel.valor_compra, { compact: true })} hint="custo histórico" icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="Aluguel mensal" value={imovel.valor_aluguel_mensal ? formatBRL(imovel.valor_aluguel_mensal) : "—"} hint={imovel.status === "Locado" ? "ativo" : "—"} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="Área" value={`${imovel.area_m2.toLocaleString("pt-BR")} m²`} hint={imovel.tipo} icon={<Building2 className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="shadow-card overflow-hidden">
            <div className="aspect-[4/3] bg-gradient-navy grid place-items-center text-white/60">
              <div className="text-center">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <div className="text-sm">Galeria de fotos</div>
                <div className="text-xs opacity-70">Sincronizar com Lidderar</div>
              </div>
            </div>
          </Card>

          <Card className="shadow-card overflow-hidden">
            <div className="h-64 w-full">
              <MapContainer
                center={[imovel.lat, imovel.lng]}
                zoom={15}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap'
                />
                <Marker position={[imovel.lat, imovel.lng]}>
                  <Popup>{imovel.endereco}</Popup>
                </Marker>
              </MapContainer>
            </div>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-gold" />
                {imovel.bairro}, {imovel.cidade}/{imovel.estado}
              </div>
              <a
                href={`https://www.google.com/maps?q=${imovel.lat},${imovel.lng}`}
                target="_blank" rel="noreferrer"
                className="text-sm text-gold hover:underline inline-flex items-center gap-1"
              >
                Google Maps <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-3 space-y-5">
          <Card className="shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-base">Dados do imóvel</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Código interno" value={imovel.cod_interno} />
              <Field label="Família" value={familia?.nome ?? "—"} />
              <Field label="Tipo" value={imovel.tipo} />
              <Field label="Classificação" value={imovel.classificacao} />
              <Field label="Uso" value={imovel.uso} />
              <Field label="Área" value={`${imovel.area_m2} m²`} />
              <Field label="Status" value={<StatusBadge status={imovel.status} />} />
              <Field label="Valorização" value={<span className={pctClass(imovel.valorizacao_pct)}>{formatPct(imovel.valorizacao_pct)}</span>} />
            </CardContent>
          </Card>

          {imovel.contrato_ativo && (
            <Card className="shadow-card">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Contrato ativo</CardTitle>
                <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">ATIVO</span>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field label="Locatário(s)" value={imovel.contrato_ativo.locatarios.join(", ")} />
                <Field label="Valor" value={formatBRL(imovel.contrato_ativo.valor_aluguel)} />
                <Field label="Início" value={new Date(imovel.contrato_ativo.inicio).toLocaleDateString("pt-BR")} />
                <Field label="Fim" value={new Date(imovel.contrato_ativo.fim).toLocaleDateString("pt-BR")} />
              </CardContent>
            </Card>
          )}

          {monthlyChart.length > 0 && (
            <Card className="shadow-card">
              <CardHeader className="pb-2"><CardTitle className="text-base">Histórico financeiro (12 meses)</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      formatter={(v: number) => formatBRL(v)}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Bar dataKey="bruto" name="Bruto" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                    <Bar dataKey="liquido" name="Líquido" fill="hsl(var(--gold))" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {imovel.contrato_ativo && (
            <Card className="shadow-card overflow-hidden">
              <CardHeader className="pb-2"><CardTitle className="text-base">Pagamentos</CardTitle></CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground bg-muted/30 border-y">
                    <tr>
                      <th className="text-left px-4 py-2">Mês</th>
                      <th className="text-right px-4 py-2">Bruto</th>
                      <th className="text-right px-4 py-2">Líquido</th>
                      <th className="text-left px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...imovel.contrato_ativo.pagamentos].reverse().map((p) => (
                      <tr key={p.mes} className="border-b last:border-0">
                        <td className="px-4 py-2">{p.mes}</td>
                        <td className="px-4 py-2 text-right">{formatBRL(p.bruto)}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{formatBRL(p.liquido)}</td>
                        <td className="px-4 py-2">
                          <span className={cn(
                            "inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border",
                            p.status === "Pago"
                              ? "bg-success/10 text-success border-success/30"
                              : "bg-warning/10 text-warning border-warning/30"
                          )}>{p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-0.5 font-medium text-foreground">{value}</div>
  </div>
);
