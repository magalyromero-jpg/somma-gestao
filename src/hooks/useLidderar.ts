import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook para chamar a API Lidderar via Edge Function lidderar-proxy.
 * Cache de 5 minutos via React Query.
 */
export function useLidderar<T = unknown>(
  endpoint: string | null,
  params?: Record<string, string | number>,
  options?: { enabled?: boolean },
) {
  return useQuery<T>({
    queryKey: ["lidderar", endpoint, params],
    enabled: !!endpoint && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const stringParams = params
        ? Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
        : undefined;

      const { data, error } = await supabase.functions.invoke("lidderar-proxy", {
        body: { endpoint, params: stringParams },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as T;
    },
  });
}

/** Parser de valores brasileiros vindos da API Lidderar. */
export const parseBRL = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  return parseFloat(String(val).replace(/\./g, "").replace(",", ".")) || 0;
};
