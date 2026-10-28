import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { baseRealizado } from "./locacoes";

// Read-only integration checks run with the preview's authenticated session, never literal credentials.
const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const env = readFileSync(".env", "utf8");
const value = (key: string) => env.match(new RegExp(`^${key}=["']?([^"'\\r\\n]+)`, "m"))?.[1] ?? "";
const edificio = "294d5d1d-a463-5721-98c8-ec1de1652929";
const db = session ? createClient(value("VITE_SUPABASE_URL"), value("VITE_SUPABASE_PUBLISHABLE_KEY"), {
  global: { headers: { Authorization: `Bearer ${JSON.parse(session).access_token}` } },
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;
const client = () => { if (!db) throw new Error("Sessão de conferência ausente"); return db; };

describe.skipIf(!session)("natureza de boletos — dados reais, sem alteração", () => {
  it("Compra de cadeiras está classificada por boleto, fora dos encargos do Realizado", async () => {
    const b = await client().from("loc_boletos").select("id,natureza,descricao,classificado,valor_titulo").eq("edificio_id", edificio).eq("nosso_numero", "13670").single();
    expect(b.error).toBeNull();
    expect(b.data).toMatchObject({ natureza: "outros", descricao: "Compra de cadeiras", classificado: true, valor_titulo: 6650 });
    const e = await client().from("loc_v_encargos_realizados").select("id").eq("edificio_id", edificio).eq("nosso_numero", "13670");
    expect(e.error).toBeNull(); expect(e.data).toHaveLength(0);
  });
  it("a conferência mantém NAC e DHL com os valores informados", async () => {
    const r = await client().from("loc_v_boletos_a_conferir").select("nosso_numero,valor_titulo,previsto_mes").eq("edificio_id", edificio).order("data_vencimento");
    expect(r.error).toBeNull();
    expect(r.data).toEqual([{ nosso_numero: "15337", valor_titulo: 16516.13, previsto_mes: 25600 }, { nosso_numero: "13852", valor_titulo: 5500, previsto_mes: 3117 }]);
  });
  it("novembro preserva Previsto, Já Emitido e Sem Boleto", async () => {
    const r = await client().rpc("loc_planejamento_caixa", { p_edificio: edificio, p_ano: 2026 });
    expect(r.error).toBeNull();
    const rows = (r.data ?? []).filter((x) => x.mes === "2026-11-01");
    for (const [field, expected] of [["previsto", 665433.65], ["emitido", 484267.83], ["sem_boleto", 65201.48]] as const)
      expect(rows.reduce((s, x) => s + Number(x[field]), 0)).toBeCloseTo(expected, 2);
  });
  it("o detalhe mantém todos os encargos e o total de R$ 2.844,19", async () => {
    const r = await client().from("loc_v_boleto_encargos").select("nosso_numero,acrescimo,multa,juros").eq("edificio_id", edificio);
    expect(r.error).toBeNull();
    expect(r.data?.find((x) => x.nosso_numero === "13670")).toMatchObject({ multa: 132.75, juros: 82.02 });
    expect((r.data ?? []).reduce((s, x) => s + Number(x.acrescimo), 0)).toBeCloseTo(2844.19, 2);
  });
  it("julho mantém os pagamentos e remove somente os encargos de não aluguel", async () => {
    const [p, e] = await Promise.all([
      client().from("loc_pagamentos").select("contrato_id,data_pagamento,valor_liquido").eq("edificio_id", edificio).gte("data_pagamento", "2026-01-01").lt("data_pagamento", "2027-01-01"),
      client().from("loc_v_encargos_realizados").select("competencia,multa,juros,ja_no_realizado").eq("edificio_id", edificio),
    ]);
    expect(p.error).toBeNull(); expect(e.error).toBeNull();
    const julho = baseRealizado(p.data ?? [], e.data ?? [], 2026).meses[6];
    expect(julho.total).toBeCloseTo(674179.93, 2);
    expect(julho.multa).toBe(0); expect(julho.juros).toBe(0);
  });
});