import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Home, ExternalLink } from "lucide-react";
import type { MarketSearchResult } from "@/data/marketSearchMock";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtM2 = (v: number | null | undefined) =>
  v == null ? "—" : `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/m²`;

const Metric = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <Card className="border-border/60">
    <CardContent className="p-5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-light">{label}</div>
      <div className="text-2xl font-light text-foreground mt-1.5 tracking-tight">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1 font-light">{hint}</div>}
    </CardContent>
  </Card>
);

const HorizontalBar = ({
  label,
  value,
  max,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-light text-foreground">{label}</span>
        <span className="text-muted-foreground font-light">
          {value}{suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const ConclusionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-md bg-card border border-border/60 border-l-4 border-l-primary p-4">
    <div className="text-xs uppercase tracking-wider text-primary font-medium mb-1.5">{title}</div>
    <div className="text-sm text-foreground/80 font-light leading-relaxed">{children}</div>
  </div>
);

export default function MarketResultsDashboard({ result }: { result: MarketSearchResult }) {
  const { metricas, tipologias, portais, listings, conclusoes } = result;
  const maxTipo = Math.max(...tipologias.map((t) => t.count));
  const maxPortal = Math.max(...portais.map((p) => p.count));

  // Range strip percentages
  const range = metricas.maximo.valor - metricas.minimo.valor || 1;
  const medianaPct = ((metricas.mediana - metricas.minimo.valor) / range) * 100;
  const mediaPct = ((metricas.media - metricas.minimo.valor) / range) * 100;

  return (
    <div className="space-y-6">
      {/* Métricas principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric label="Média R$/m²" value={fmtM2(metricas.media)} />
        <Metric label="Mediana R$/m²" value={fmtM2(metricas.mediana)} />
        <Metric
          label="Mínimo"
          value={fmtM2(metricas.minimo.valor)}
          hint={`${metricas.minimo.m2}m² · ${metricas.minimo.tipologia}`}
        />
        <Metric
          label="Máximo"
          value={fmtM2(metricas.maximo.valor)}
          hint={`${metricas.maximo.m2}m² · ${metricas.maximo.tipologia}`}
        />
        <Metric label="Anúncios" value={String(metricas.total)} />
        <Metric label="Desvio padrão" value={fmtM2(metricas.desvioPadrao)} />
      </div>

      {/* Range strip */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-light tracking-tight">Faixa de preço por m²</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pt-6 pb-10">
            <div className="h-3 rounded-full bg-gradient-to-r from-success/30 via-warning/40 to-destructive/40" />
            {/* Mediana marker */}
            <div
              className="absolute top-3 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${medianaPct}%` }}
            >
              <div className="h-5 w-0.5 bg-primary" />
              <div className="text-[10px] uppercase tracking-wider text-primary font-medium mt-1">Mediana</div>
              <div className="text-xs font-light text-foreground">{fmtM2(metricas.mediana)}</div>
            </div>
            {/* Média marker */}
            <div
              className="absolute -top-1 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${mediaPct}%` }}
            >
              <div className="text-[10px] uppercase tracking-wider text-gold font-medium">Média</div>
              <div className="h-5 w-0.5 bg-gold mt-0.5" />
            </div>
            {/* Min/Max labels */}
            <div className="flex justify-between text-xs font-light text-muted-foreground mt-2">
              <span>{fmtM2(metricas.minimo.valor)}</span>
              <span>{fmtM2(metricas.maximo.valor)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos de barra */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-light tracking-tight">Tipologias dominantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tipologias.map((t) => (
              <HorizontalBar key={t.tipo} label={`${t.tipo} · ${t.pct}%`} value={t.count} max={maxTipo} suffix="anúncios" />
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-light tracking-tight">Anúncios por portal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {portais.map((p) => (
              <HorizontalBar key={p.portal} label={p.portal} value={p.count} max={maxPortal} suffix="anúncios" />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Lista de anúncios */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-light tracking-tight">Anúncios encontrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {listings.map((l) => (
            <div
              key={l.id}
              className="flex flex-col md:flex-row gap-4 p-4 rounded-md border border-border/60 hover:border-primary/40 transition-colors bg-background"
            >
              <div className="h-24 w-full md:w-32 shrink-0 rounded-md bg-muted grid place-items-center">
                <Building2 className="h-8 w-8 text-muted-foreground/50" strokeWidth={1.25} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-light text-foreground truncate">{l.titulo}</div>
                    <div className="text-xs text-muted-foreground font-light mt-0.5">{l.endereco}</div>
                  </div>
                  <Badge variant="outline" className="font-light">{l.tipologia}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 text-xs">
                  <div>
                    <div className="text-muted-foreground font-light">Área</div>
                    <div className="font-light text-foreground">{l.m2} m²</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-light">Dorms</div>
                    <div className="font-light text-foreground">{l.dorms}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-light">Vagas</div>
                    <div className="font-light text-foreground">{l.vagas}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-light">Preço</div>
                    <div className="font-light text-foreground">{fmtBRL(l.preco)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground font-light">R$/m²</div>
                    <div className="font-medium text-primary">{fmtM2(l.precoM2)}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-light">
                    Origem: {l.portal}
                  </div>
                  {l.url && (
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-light text-primary hover:underline"
                    >
                      Ver anúncio
                      <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Conclusões */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-light tracking-tight flex items-center gap-2">
            <Home className="h-4 w-4 text-primary" strokeWidth={1.5} />
            Análise automática
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ConclusionCard title="Posicionamento do ativo">{conclusoes.posicionamento}</ConclusionCard>
          <ConclusionCard title="Oferta × demanda">{conclusoes.ofertaDemanda}</ConclusionCard>
          <ConclusionCard title="Tipologia dominante">{conclusoes.tipologiaDominante}</ConclusionCard>
          <ConclusionCard title="Competitividade">{conclusoes.competitividade}</ConclusionCard>
          <div className="md:col-span-2 rounded-md bg-primary text-primary-foreground p-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-primary-foreground/70 font-light">
                Estimativa do ativo-alvo
              </div>
              <div className="text-3xl font-light tracking-tight mt-1">{fmtBRL(conclusoes.estimativaAtivo)}</div>
            </div>
            <div className="text-right text-xs font-light text-primary-foreground/70 max-w-[40%]">
              Calculado a partir da metragem estimada × mediana regional
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
