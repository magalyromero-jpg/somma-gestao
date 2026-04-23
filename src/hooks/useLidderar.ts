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

      console.log("[useLidderar] raw response", endpoint, data);

      // Envelope: { ok, upstream_status, upstream_url, data }
      if (data && typeof data === "object" && "ok" in data) {
        if (!data.ok) {
          const upstream = (data as any).data;
          const msg =
            (upstream && typeof upstream === "object" &&
              (upstream.MSG || upstream.error || upstream.message)) ||
            `Lidderar respondeu ${(data as any).upstream_status}`;
          throw new Error(String(msg));
        }
        return (data as any).data as T;
      }

      if ((data as any)?.error) throw new Error((data as any).error);
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
