import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
const n = (v: any) => Number(v ?? 0) || 0;

/** Cálculo único do saldo em aberto, usado em todas as telas do portal. */
export function useSaldoEmAberto(edificioId: string | undefined, ano: number, ultimaData: string, admin: boolean) {
  const q = useQuery({
    enabled: !!edificioId,
    queryKey: ["loc-saldo-aberto", edificioId, ano, admin],
    queryFn: async () => {
      const [cx, ea, enc] = await Promise.all([
        db.rpc("loc_caixa_mensal", { p_edificio: edificioId, p_ano: ano }),
        db.rpc("loc_em_aberto", { p_edificio: edificioId, p_ano: ano }),
        admin ? db.from("loc_v_encerrados").select("contrato_id,unidades,locatario,data_saida,alugueis_em_aberto,debito_condominio").eq("edificio_id", edificioId) : Promise.resolve({ data: [], error: null }),
      ]);
      for (const r of [cx, ea, enc]) if (r.error) throw r.error;
      return { caixa: (cx.data ?? []) as any[], emAberto: (ea.data ?? []) as any[], encerrados: (enc.data ?? []) as any[] };
    },
  });
  const limite = ultimaData.slice(0, 7);
  const caixa = (q.data?.caixa ?? []).filter((m) => !limite || m.mes.slice(0, 7) <= limite).sort((a, b) => a.mes.localeCompare(b.mes));
  const emAbertoAtivos = (q.data?.emAberto ?? []).filter((e) => !e.encerrado);
  const encerrados = admin ? (q.data?.encerrados ?? []) : [];
  const encerradosComSaldo = encerrados.filter((e) => n(e.alugueis_em_aberto) > 0.004);
  const ativos = emAbertoAtivos.reduce((s, e) => s + n(e.saldo), 0);
  const naoAtivos = encerradosComSaldo.reduce((s, e) => s + n(e.alugueis_em_aberto), 0);
  const total = ativos + naoAtivos;
  const condominio = encerrados.reduce((s, e) => s + n(e.debito_condominio), 0);
  const previstoAtivos = caixa.reduce((s, m) => s + n(m.previsto_contratual), 0);
  return {
    isLoading: q.isLoading, error: q.error,
    caixa, emAberto: q.data?.emAberto ?? [], emAbertoAtivos, encerradosComSaldo,
    ativos, naoAtivos, total, condominio, previstoAtivos,
    inadimplenciaAtivos: previstoAtivos ? ativos / previstoAtivos : null,
    inadimplenciaTotal: previstoAtivos ? total / previstoAtivos : null,
  };
}
