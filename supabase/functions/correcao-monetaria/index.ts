import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const INDICES: Record<string, number> = {
  IPCA: 433,
  "IPC-A": 433,
  IGPM: 189,
  "IGP-M": 189,
  INCC: 192,
  IPCA15: 7478,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { indice, dataInicial, dataFinal, valorInicial } = body ?? {};

    if (!indice || !dataInicial || !dataFinal || valorInicial == null) {
      return new Response(
        JSON.stringify({ error: "Parâmetros: indice, dataInicial (dd/MM/yyyy), dataFinal, valorInicial" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const codigo = INDICES[String(indice).toUpperCase()];
    if (!codigo) {
      return new Response(JSON.stringify({ error: "Índice inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url =
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados` +
      `?formato=json&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;

    const resp = await fetch(url);
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `BCB respondeu ${resp.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const dados = await resp.json();
    if (!Array.isArray(dados) || dados.length === 0) {
      return new Response(JSON.stringify({ error: "Sem dados para o período" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fator = 1;
    for (const it of dados) {
      const v = parseFloat(String(it.valor).replace(",", "."));
      if (!isNaN(v)) fator *= 1 + v / 100;
    }

    const pct = (fator - 1) * 100;
    const valor = Number(valorInicial);
    const corrigido = valor * fator;

    return new Response(
      JSON.stringify({
        indice,
        dataInicial,
        dataFinal,
        valorInicial: valor,
        percentualAcumulado: Number(pct.toFixed(2)),
        fatorAcumulado: Number(fator.toFixed(6)),
        valorCorrigido: Number(corrigido.toFixed(2)),
        ganhoNominal: Number((corrigido - valor).toFixed(2)),
        totalMeses: dados.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
