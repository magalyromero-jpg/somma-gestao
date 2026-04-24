import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarketSearchResult } from "@/data/marketSearchMock";

const tipoColors: Record<string, string> = {
  "Studio": "hsl(var(--info))",
  "1 dorm": "hsl(var(--success))",
  "2 dorm": "hsl(var(--primary))",
  "3 dorm": "hsl(var(--gold))",
  "4+ dorm": "hsl(var(--destructive))",
};

const colorOf = (t: string) => tipoColors[t] ?? "hsl(var(--muted-foreground))";

export default function MarketMapView({ result }: { result: MarketSearchResult }) {
  const tiposAtivos = Array.from(new Set(result.listings.map((l) => l.tipologia)));

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-light tracking-tight">Mapa da pesquisa</CardTitle>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-light">
          Raio: {result.params.raio < 1000 ? `${result.params.raio}m` : `${result.params.raio / 1000}km`}
        </span>
      </CardHeader>
      <CardContent>
        {/* Map placeholder */}
        <div className="relative h-[420px] rounded-md overflow-hidden bg-[radial-gradient(ellipse_at_center,_hsl(var(--muted))_0%,_hsl(var(--background))_70%)] border border-border/60">
          {/* Grid background */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* Search radius circle */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-primary/40 bg-primary/5"
            style={{ width: 320, height: 320 }}
          />

          {/* Target pin (center) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center">
            <div className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-[10px] font-light shadow-md mb-1 whitespace-nowrap max-w-[200px] truncate">
              {result.params.enderecoAlvo || "Endereço-alvo"}
            </div>
            <MapPin className="h-9 w-9 text-primary drop-shadow-md" fill="hsl(var(--gold))" strokeWidth={1.5} />
          </div>

          {/* Listing pins arranged around target */}
          {result.listings.map((l, i) => {
            const angle = (i / result.listings.length) * Math.PI * 2;
            const radius = 90 + (i % 3) * 30;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <div
                key={l.id}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 group"
                style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
              >
                <MapPin
                  className="h-6 w-6 drop-shadow-md cursor-pointer transition-transform group-hover:scale-125"
                  fill={colorOf(l.tipologia)}
                  color={colorOf(l.tipologia)}
                  strokeWidth={1.5}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-foreground text-background rounded px-2 py-1 text-[10px] whitespace-nowrap font-light">
                  {l.tipologia} · {l.m2}m² · R$ {l.precoM2.toLocaleString("pt-BR")}/m²
                </div>
              </div>
            );
          })}

          {/* Watermark */}
          <div className="absolute bottom-2 right-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-light">
            Visualização demo · Google Maps em breve
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-light">Legenda:</span>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" fill="hsl(var(--gold))" strokeWidth={1.5} />
            <span className="font-light text-foreground">Endereço-alvo</span>
          </div>
          {tiposAtivos.map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" fill={colorOf(t)} color={colorOf(t)} strokeWidth={1.5} />
              <span className="font-light text-foreground">{t}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
