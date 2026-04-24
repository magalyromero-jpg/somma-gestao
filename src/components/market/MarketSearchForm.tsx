import { useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  MARGENS,
  PORTAIS,
  RAIOS,
  TIPOLOGIAS_RESIDENCIAL,
  TIPOLOGIAS_COMERCIAL,
  TIPOLOGIAS_TERRENO,
  UFS,
  type Finalidade,
  type MarketSearchParams,
} from "@/data/marketSearchMock";

interface Props {
  initial?: Partial<MarketSearchParams>;
  onSubmit: (params: MarketSearchParams) => void;
  loading?: boolean;
}

const defaults: MarketSearchParams = {
  uf: "SP",
  cidade: "São Paulo",
  bairro: "Itaim Bibi",
  enderecoAlvo: "",
  tipologias: ["2 dorm", "3 dorm"],
  m2Min: 90,
  m2Max: 110,
  margem: 10,
  portais: ["Viva Real", "ZAP Imóveis"],
  finalidade: "venda",
  raio: 500,
};

const computeRange = (m2: number, margem: number) => {
  const factor = margem / 100;
  return {
    min: Math.max(0, Math.round(m2 * (1 - factor))),
    max: Math.round(m2 * (1 + factor)),
  };
};

const Chip = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 rounded-full text-xs font-light border transition-all",
      active
        ? "bg-primary text-primary-foreground border-primary shadow-sm"
        : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
    )}
  >
    {label}
  </button>
);

export default function MarketSearchForm({ initial, onSubmit, loading }: Props) {
  const [p, setP] = useState<MarketSearchParams>({ ...defaults, ...initial });
  const [m2, setM2] = useState<number>(
    initial?.m2Min && initial?.m2Max
      ? Math.round((initial.m2Min + initial.m2Max) / 2)
      : 100,
  );

  const range = computeRange(m2, p.margem);

  const toggle = (key: "tipologias" | "portais", v: string) =>
    setP((s) => ({
      ...s,
      [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v],
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...p, m2Min: range.min, m2Max: range.max });
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-lg font-light tracking-tight">Parâmetros da pesquisa</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Localização */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-light">UF</Label>
              <Select value={p.uf} onValueChange={(v) => setP({ ...p, uf: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-light">Cidade</Label>
              <Input className="mt-1.5" value={p.cidade} onChange={(e) => setP({ ...p, cidade: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-light">Bairro</Label>
              <Input className="mt-1.5" value={p.bairro} onChange={(e) => setP({ ...p, bairro: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-light">Raio</Label>
              <Select value={String(p.raio)} onValueChange={(v) => setP({ ...p, raio: Number(v) })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RAIOS.map((r) => <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-12">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-light">Endereço alvo</Label>
              <Input
                className="mt-1.5"
                placeholder="Ex.: R. Bandeira Paulista, 530 — ou nome do prédio"
                value={p.enderecoAlvo}
                onChange={(e) => setP({ ...p, enderecoAlvo: e.target.value })}
              />
            </div>
          </div>

          {/* Tipologias agrupadas */}
          <div className="space-y-4">
            {[
              { label: "Residencial", items: TIPOLOGIAS_RESIDENCIAL },
              { label: "Comercial", items: TIPOLOGIAS_COMERCIAL },
              { label: "Terrenos", items: TIPOLOGIAS_TERRENO },
            ].map((grupo) => (
              <div key={grupo.label}>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-light">
                  {grupo.label}
                </Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {grupo.items.map((t) => (
                    <Chip
                      key={t}
                      label={t}
                      active={p.tipologias.includes(t)}
                      onClick={() => toggle("tipologias", t)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Metragem */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-light">Metragem (m²)</Label>
              <Input
                type="number"
                min={1}
                className="mt-1.5"
                value={m2}
                onChange={(e) => setM2(Math.max(0, Number(e.target.value) || 0))}
              />
              <p className="mt-1.5 text-xs text-muted-foreground font-light">
                Buscando de {range.min}m² a {range.max}m²
              </p>
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-light">Margem</Label>
              <Select value={String(p.margem)} onValueChange={(v) => setP({ ...p, margem: Number(v) })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MARGENS.map((m) => (
                    <SelectItem key={m} value={String(m)}>{m === 0 ? "0%" : `±${m}%`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-light">Finalidade</Label>
              <div className="mt-1.5 flex rounded-md border border-input p-1 bg-background">
                {(["venda", "locacao"] as Finalidade[]).map((f) => (
                  <button
                    type="button"
                    key={f}
                    onClick={() => setP({ ...p, finalidade: f })}
                    className={cn(
                      "flex-1 text-xs font-light px-3 py-1.5 rounded transition-colors capitalize",
                      p.finalidade === f
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f === "venda" ? "Venda" : "Locação"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Portais */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-light">Portais a pesquisar</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {PORTAIS.map((portal) => (
                <Chip key={portal} label={portal} active={p.portais.includes(portal)} onClick={() => toggle("portais", portal)} />
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border/60">
            <Button type="submit" disabled={loading} className="gap-2">
              <Search className="h-4 w-4" strokeWidth={1.75} />
              {loading ? "Pesquisando…" : "Pesquisar mercado"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
