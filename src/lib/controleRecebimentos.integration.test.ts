import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { baseRealizado } from "./locacoes";
const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const env = readFileSync(".env", "utf8");
const value = (key: string) => env.match(new RegExp(`^${key}=["']?([^"'\\r\\n]+)`, "m"))?.[1] ?? "";
const edificio = "294d5d1d-a463-5721-98c8-ec1de1652929";
const db = session ? createClient(value("VITE_SUPABASE_URL"), value("VITE_SUPABASE_PUBLISHABLE_KEY"), { global: { headers: { Authorization: `Bearer ${JSON.parse(session).access_token}` } }, auth: { persistSession: false, autoRefreshToken: false } }) : null;
const client = () => { if (!db) throw new Error("Sessão de conferência ausente"); return db; };
describe.skipIf(!session)("Controle de Recebimentos — dados reais somente leitura", () => {
  it("NAC cobra agosto proporcional 20/31 e zero de setembro em diante", async () => {
    const r = await client().rpc("loc_esperado_caixa", { p_edificio: edificio, p_ano: 2026 });
    expect(r.error).toBeNull();
    const nac = (r.data ?? []).filter((x) => x.contrato_id === "5fea33a8-5351-5e52-9d23-00faaea9760d");
    expect(nac.find((x) => x.mes === "2026-08-01")?.valor).toBe(16516.13);
    expect(nac.filter((x) => x.mes >= "2026-09-01").map((x) => x.valor)).toEqual([0,0,0,0]);
  });
  it("Orçado 2026 permanece R$ 6.855.976,20", async () => {
    const r = await client().rpc("loc_orcado_caixa", { p_edificio: edificio, p_ano: 2026 });
    expect(r.error).toBeNull();
    expect((r.data ?? []).reduce((s,x) => s + Number(x.valor), 0)).toBeCloseTo(6855976.20, 2);
  });
  it.each([[3,620128.68],[4,609178.91],[5,609102.59]])("recebido do mês %i confere ao centavo com Realizado", async (i, esperado) => {
    const [c,p,e] = await Promise.all([
      client().rpc("loc_controle_recebimentos", { p_edificio: edificio, p_ano: 2026 }),
      client().from("loc_pagamentos").select("contrato_id,data_pagamento,valor_liquido,imovel_nome").eq("edificio_id", edificio).limit(10000),
      client().from("loc_v_encargos_realizados").select("competencia,multa,juros,ja_no_realizado").eq("edificio_id", edificio).limit(10000),
    ]);
    expect(c.error).toBeNull(); expect(p.error).toBeNull(); expect(e.error).toBeNull();
    const real = baseRealizado(p.data ?? [], e.data ?? [], 2026);
    const mes = `2026-${String(i+1).padStart(2,"0")}-01`;
    const recebido = (c.data ?? []).filter((x) => x.mes === mes).reduce((s,x) => s + Number(x.recebido), 0) + real.outras.reduce((s,o) => s + Number(o.real[i] ?? 0),0);
    expect(recebido).toBeCloseTo(esperado,2);
    expect(recebido).toBeCloseTo(real.meses[i].total,2);
  });
});