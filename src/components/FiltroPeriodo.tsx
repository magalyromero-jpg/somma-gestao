import { useState } from "react";
import { CalendarRange, Check } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  PERIODO_LABEL,
  PERIODO_OPCOES,
  type PeriodoPreset,
  type PeriodoRange,
  dateParaYmd,
  labelRange,
  ymdParaDate,
} from "@/lib/periodo";

export function FiltroPeriodo({
  preset,
  custom,
  range,
  onChange,
}: {
  preset: PeriodoPreset;
  custom: PeriodoRange | null;
  range: PeriodoRange | null;
  onChange: (preset: PeriodoPreset, custom: PeriodoRange | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState<DateRange | undefined>(
    custom ? { from: ymdParaDate(custom.inicio), to: ymdParaDate(custom.fim) } : undefined,
  );

  const escolher = (p: PeriodoPreset) => {
    if (p === "personalizado") {
      onChange(p, custom);
      return;
    }
    onChange(p, null);
    setAberto(false);
  };

  const escolherRange = (r: DateRange | undefined) => {
    setSel(r);
    if (r?.from && r?.to) {
      onChange("personalizado", { inicio: dateParaYmd(r.from), fim: dateParaYmd(r.to) });
      setAberto(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <CalendarRange className="mr-2 h-4 w-4" />
            Concluídas: {PERIODO_LABEL[preset]}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex flex-col">
            {PERIODO_OPCOES.map((p) => (
              <button
                key={p}
                onClick={() => escolher(p)}
                className={cn(
                  "flex items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                  preset === p && "font-medium",
                )}
              >
                {PERIODO_LABEL[p]}
                {preset === p && <Check className="ml-4 h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
          {preset === "personalizado" && (
            <div className="mt-2 border-t pt-2">
              <Calendar
                mode="range"
                selected={sel}
                onSelect={escolherRange}
                numberOfMonths={1}
                className={cn("p-3 pointer-events-auto")}
              />
            </div>
          )}
        </PopoverContent>
      </Popover>
      <span className="text-xs text-muted-foreground">{labelRange(range)}</span>
    </div>
  );
}
