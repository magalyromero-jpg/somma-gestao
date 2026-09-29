import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizarTexto } from "@/lib/operacional";
import { cn } from "@/lib/utils";

export function MultiFiltro({ id, opcoes, selecionados, onChange, todos, plural }: {
  id: string; opcoes: { nome: string; total: number }[]; selecionados: string[]; onChange: (v: string[]) => void; todos: string; plural: string;
}) {
  const rotulo = selecionados.length === 0 ? todos : selecionados.length === 1 ? selecionados[0] : `${selecionados.length} ${plural}`;
  const alternar = (nome: string) => onChange(selecionados.includes(nome) ? selecionados.filter((s) => s !== nome) : [...selecionados, nome]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 w-56 justify-between font-normal">
          <span className="truncate">{rotulo}</span><ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command filter={(value, busca) => (normalizarTexto(value).includes(normalizarTexto(busca)) ? 1 : 0)}>
          <CommandInput placeholder="Filtrar…" autoComplete="off" name={`filtro-operacional-${id}`} />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {opcoes.map((o) => (
                <CommandItem key={o.nome} value={o.nome} onSelect={() => alternar(o.nome)}>
                  <Check className={cn("mr-2 h-4 w-4", selecionados.includes(o.nome) ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{o.nome}</span>
                  <span className="ml-2 text-xs tabular-nums text-muted-foreground">{o.total}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
