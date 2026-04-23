import { useMemo } from "react";
import { useLidderar } from "@/hooks/useLidderar";
import {
  adaptFamiliaConta,
  adaptImovel,
  buildFamiliaIndex,
  deriveFamiliasFromImoveis,
  extractList,
  type FamiliaConta,
  type FamiliaIndex,
} from "@/lib/lidderar-adapters";
import type { Familia, Imovel } from "@/data/mock";

/** Contas (famílias) reais vindas de /cadastros/conta/getall. */
export function useContas() {
  const query = useLidderar<unknown>("/cadastros/conta/getall");
  const contas = useMemo<FamiliaConta[]>(
    () => extractList(query.data).map((raw) => adaptFamiliaConta(raw)),
    [query.data],
  );
  const index = useMemo<FamiliaIndex>(() => buildFamiliaIndex(contas), [contas]);
  return { ...query, contas, index };
}

/** All properties from Lidderar, normalized and linked to family accounts. */
export function useImoveis() {
  const imoveisQuery = useLidderar<unknown>("/imoveis/getall");
  const { contas, index, isLoading: loadingContas, error: errorContas } = useContas();

  const imoveis = useMemo<Imovel[]>(
    () =>
      extractList(imoveisQuery.data)
        .map((raw) => adaptImovel(raw, index))
        .filter((i) => i.cod_imovel > 0),
    [imoveisQuery.data, index],
  );

  return {
    ...imoveisQuery,
    imoveis,
    contas,
    isLoading: imoveisQuery.isLoading || loadingContas,
    error: imoveisQuery.error || errorContas,
  };
}

/** Famílias = contas reais (com fallback à derivação via participações se a API falhar). */
export function useFamilias() {
  const { imoveis, contas, isLoading, error } = useImoveis();
  const familias = useMemo<Familia[]>(() => {
    if (contas && contas.length > 0) {
      return contas.map(({ cliente_ids, empresa_ids, ...rest }) => rest);
    }
    return deriveFamiliasFromImoveis(imoveis);
  }, [contas, imoveis]);
  return { familias, imoveis, isLoading, error };
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
