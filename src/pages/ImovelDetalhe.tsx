import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { KpiCard } from "@/components/KpiCard";
import { useImovel, useContratos, useFamilias } from "@/hooks/useApiData";
import { adaptImovel, extractList } from "@/lib/lidderar-adapters";
import { parseBRL } from "@/hooks/useLidderar";
import { formatBRL, formatPct, pctClass } from "@/lib/format";
import { ExternalLink, MapPin, TrendingUp, Wallet, Building2 } from "lucide-react";
import { LoadingSkeleton, ErrorState } from "@/components/LoadingState";

// Fix default Leaflet icon paths in Vite
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

export default function ImovelDetalhe() {
  const { codImovel = "" } = useParams();
  const { data, isLoading, error } = useImovel(codImovel);
  const { data: contratosData } = useContratos(codImovel);
  const { familias } = useFamilias();

  useEffect(() => {
    setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
  }, []);

  const imovel = useMemo(() => {
    if (!data) return null;
    // /imoveis/get may return single object or {data:{}}
    const raw = (data as any)?.data ?? data;
    return adaptImovel(raw);
  }, [data]);

  const activeContract = useMemo(() => {
    const list = extractList(contratosData);
    return list.find((c: any) => String(c?.status ?? "").toLowerCase().includes("ativ")) ?? list[0] ?? null;
  }, [contratosData]);

  if (isLoading) return <LoadingSkeleton rows={10} />;
  if (error) return <ErrorState error={error} />;
  if (!imovel || imovel.cod_imovel === 0)
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Imóvel não encontrado.</p>
        <Link to="/imoveis" className="text-gold underline mt-2 inline-block">Voltar</Link>
      </div>
    );

  const familia = familias.find((f) => f.id === imovel.familia_id);
  const valorContrato = activeContract ? parseBRL(activeContract.valor_aluguel ?? activeContract.valor_bruto) : 0;

  return (
    <>
      <div className="text-sm text-muted-foreground mb-2">
        <Link to="/imoveis" className="hover:text-gold">Imóveis</Link>
        {familia && <> · <Link to={`/familias/${familia.id}`} className="hover:text-gold">{familia.nome}</Link></>}
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
        <div className="lg:col-span-2 space-y-5">
          <Card className="shadow-card overflow-hidden">
            {imovel.fotos.length > 0 ? (
              <img src={imovel.fotos[0]} alt={imovel.endereco} className="w-full aspect-[4/3] object-cover" />
            ) : (
              <div className="aspect-[4/3] bg-gradient-navy grid place-items-center text-white/60">
                <div className="text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <div className="text-sm">Sem fotos disponíveis</div>
                </div>
              </div>
            )}
          </Card>

          <Card className="shadow-card overflow-hidden">
            <div className="h-64 w-full">
              <MapContainer
                center={[imovel.lat, imovel.lng]}
                zoom={15}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
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

          {activeContract && (
            <Card className="shadow-card">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Contrato</CardTitle>
                <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
                  {String(activeContract.status ?? "ATIVO").toUpperCase()}
                </span>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field label="Locatário(s)" value={String(activeContract.locatario ?? activeContract.nome ?? "—")} />
                <Field label="Valor" value={valorContrato ? formatBRL(valorContrato) : "—"} />
                <Field label="Início" value={String(activeContract.data_inicio ?? activeContract.inicio ?? "—")} />
                <Field label="Fim" value={String(activeContract.data_fim ?? activeContract.fim ?? "—")} />
              </CardContent>
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
