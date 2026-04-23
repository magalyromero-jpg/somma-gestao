import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLidderar } from "@/hooks/useLidderar";
import { supabase } from "@/integrations/supabase/client";
import {
  adaptCliente,
  adaptFamiliaConta,
  adaptImovel,
  buildFamiliaIndex,
  buildPerfilIndex,
  deriveFamiliasFromImoveis,
  extractList,
  type Cliente,
  type FamiliaConta,
  type FamiliaIndex,
  type PerfilIndex,
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

/** Clientes (pessoas/empresas) com perfil — /cadastros/clientes/getall. */
export function useClientes() {
  const query = useLidderar<unknown>("/cadastros/clientes/getall");
  const clientes = useMemo<Cliente[]>(
    () => extractList(query.data).map((raw) => adaptCliente(raw)),
    [query.data],
  );
  const perfilIndex = useMemo<PerfilIndex>(() => buildPerfilIndex(clientes), [clientes]);
  return { ...query, clientes, perfilIndex };
}

/** Mapeamento manual familia_membros (Supabase) → índice cliente/empresa → familia_id. */
export function useMembrosMapping() {
  return useQuery({
    queryKey: ["familia_membros_mapping"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familia_membros")
        .select("familia_id, lidderar_entity_id, tipo");
      if (error) throw error;
      const clienteToFamilia = new Map<number, string>();
      const empresaToFamilia = new Map<number, string>();
      for (const m of data ?? []) {
        const id = Number(m.lidderar_entity_id);
        if (!id) continue;
        if (String(m.tipo).toLowerCase().includes("empresa")) empresaToFamilia.set(id, m.familia_id);
        else clienteToFamilia.set(id, m.familia_id);
      }
      return { clienteToFamilia, empresaToFamilia };
    },
  });
}

/** All properties from Lidderar, normalized and linked to family accounts + perfis. */
export function useImoveis() {
  const imoveisQuery = useLidderar<unknown>("/imoveis/getall");
  const { contas, index, isLoading: loadingContas, error: errorContas } = useContas();
  const { clientes, perfilIndex, isLoading: loadingClientes, error: errorClientes } = useClientes();
  const { data: membrosIndex, isLoading: loadingMembros } = useMembrosMapping();

  const imoveis = useMemo<Imovel[]>(
    () =>
      extractList(imoveisQuery.data)
        .map((raw) => adaptImovel(raw, index, perfilIndex, membrosIndex ?? undefined))
        .filter((i) => i.cod_imovel > 0),
    [imoveisQuery.data, index, perfilIndex, membrosIndex],
  );

  return {
    ...imoveisQuery,
    imoveis,
    contas,
    clientes,
    isLoading: imoveisQuery.isLoading || loadingContas || loadingClientes || loadingMembros,
    error: imoveisQuery.error || errorContas || errorClientes,
  };
}

/** Famílias = contas reais (com fallback à derivação via participações se a API falhar). */
export function useFamilias() {
  const { imoveis, contas, clientes, isLoading, error } = useImoveis();
  const familias = useMemo<Familia[]>(() => {
    if (contas && contas.length > 0) {
      return contas.map(({ cliente_ids, empresa_ids, ...rest }) => rest);
    }
    return deriveFamiliasFromImoveis(imoveis);
  }, [contas, imoveis]);
  return { familias, imoveis, contas, clientes, isLoading, error };
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
