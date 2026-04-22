import { useMemo } from "react";
import { useLidderar } from "@/hooks/useLidderar";
import { adaptFamilia, adaptImovel, extractList } from "@/lib/lidderar-adapters";
import type { Familia, Imovel } from "@/data/mock";

/** All properties from Lidderar, normalized. */
export function useImoveis() {
  const query = useLidderar<unknown>("/imoveis/getall");
  const imoveis = useMemo<Imovel[]>(
    () => extractList(query.data).map(adaptImovel).filter((i) => i.cod_imovel > 0),
    [query.data],
  );
  return { ...query, imoveis };
}

/** All families/accounts from Lidderar, normalized + augmented with property counts. */
export function useFamilias() {
  const query = useLidderar<unknown>("/cadastros/conta/getall");
  const familias = useMemo<Familia[]>(
    () => extractList(query.data).map(adaptFamilia),
    [query.data],
  );
  return { ...query, familias };
}

/** Single property detail. */
export function useImovel(codImovel: string | number | undefined) {
  return useLidderar<unknown>(codImovel ? "/imoveis/get" : null, codImovel ? { chave: codImovel } : undefined);
}

/** Property contracts list. */
export function useContratos(codImovel: string | number | undefined) {
  return useLidderar<unknown>(
    codImovel ? "/imoveis/getContratos" : null,
    codImovel ? { chave: codImovel } : undefined,
  );
}
