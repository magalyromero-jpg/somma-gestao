/** Liga/desliga a leitura automática de documentos na tela (banco e funções ficam intactos). */
export const LEITURA_DOCUMENTOS_ATIVA = false;

export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const DICA_ENCARGOS_REALIZADOS = "O banco informa só o total pago a mais. Juros estimados em 1% ao mês, proporcional aos dias de atraso; multa é o restante.";

type PagamentoRealizado = { contrato_id: string | null; data_pagamento: string; valor_liquido: number | string | null; imovel_nome?: string | null };
type EncargoRealizado = { competencia: string | null; multa: number | string | null; juros: number | string | null; ja_no_realizado: boolean | null };

/** Base única do Realizado: janela importada do Lidderar e encargos já deduplicados pela view. */
export function baseRealizado(pagamentos: PagamentoRealizado[], encargos: EncargoRealizado[], ano: number) {
  const prefixo = String(ano);
  const ultimoMes = pagamentos.reduce((max, p) => p.data_pagamento.startsWith(prefixo) && p.data_pagamento.slice(0, 7) > max ? p.data_pagamento.slice(0, 7) : max, `${prefixo}-00`);
  const meses = MESES.map((_, i) => {
    const key = `${prefixo}-${String(i + 1).padStart(2, "0")}`;
    const fechado = key <= ultimoMes;
    let contratos = 0, avulsas = 0, multa = 0, juros = 0;
    if (fechado) {
      for (const p of pagamentos) if (p.data_pagamento.startsWith(key)) {
        if (p.contrato_id) contratos += Number(p.valor_liquido ?? 0);
        else avulsas += Number(p.valor_liquido ?? 0);
      }
      for (const e of encargos) if (e.ja_no_realizado === false && e.competencia?.startsWith(key)) {
        multa += Number(e.multa ?? 0); juros += Number(e.juros ?? 0);
      }
    }
    return { key, fechado, contratos, avulsas, multa, juros, total: contratos + avulsas + multa + juros };
  });
  const nomes = [...new Set(pagamentos.filter((p) => !p.contrato_id).map((p) => String(p.imovel_nome ?? "Outros").replace(/^Zen Tower - /, "")))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const outras = nomes.map((un) => ({
    un, loc: "Receita avulsa", dica: undefined as string | undefined,
    real: meses.map((m) => m.fechado ? pagamentos.filter((p) => !p.contrato_id && String(p.imovel_nome ?? "Outros").replace(/^Zen Tower - /, "") === un && p.data_pagamento.startsWith(m.key)).reduce((s, p) => s + Number(p.valor_liquido ?? 0), 0) : null),
  }));
  for (const campo of ["multa", "juros"] as const) outras.push({
    un: campo === "multa" ? "Multa" : "Juros", loc: "Receita de atraso", dica: DICA_ENCARGOS_REALIZADOS,
    real: meses.map((m) => m.fechado ? m[campo] : null),
  });
  return { meses, outras, ultimoMes };
}

export const formatoPagamentoPermitido = (nome: string) => /\.(xlsx|xls|csv)$/i.test(nome);

export const brl = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num2 = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const mil = (n: number) => (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
export const dt = (s: string | null | undefined) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "—");
export const m2 = (n: number | null | undefined) => (n == null ? "—" : `${num2(n)} m²`);
export const pct = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : `${num2(n)}%`);
export const indiceLabel = (i: string | null | undefined) =>
  i === "MEDIA" ? "Média IPCA/IGP-M" : i === "IGPM" ? "IGP-M" : i === "FIXO" ? "Fixo" : i === "NENHUM" ? "Nenhum" : i ?? "—";

export const pct1 = (n: number | null | undefined) =>
  n == null || !isFinite(n) ? "—" : `${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/** Tooltip padrão do Valor Mensal Vigente (bruto, antes da retenção do Município) */
export const DICA_VALOR_VIGENTE =
  "Valor contratual vigente, antes da retenção de 4,8% do Município de Itajaí. O Fluxo de Caixa mostra o valor líquido.";

export type CicloRenovacao = "a_vencer_120d" | "a_vencer_12m" | "vigente" | "sem_data";
export const CICLOS_RENOVACAO: { chave: CicloRenovacao; label: string }[] = [
  { chave: "a_vencer_120d", label: "Até 120 Dias" },
  { chave: "a_vencer_12m", label: "De 121 Dias a 12 Meses" },
  { chave: "vigente", label: "Acima de 12 Meses" },
  { chave: "sem_data", label: "Vencido ou Sem Data" },
];

export type ContratoRenovacao = {
  contrato_id: string;
  unidades: string;
  locatario: string;
  valor: number;
  indice: string;
  ciclo: CicloRenovacao;
  fim: string | null;
  dias: number | null;
  pct: number;
  pctAcum: number;
  classe: "A" | "B" | "C";
};

/**
 * Base única de renovações (Visão Geral e aba Renovações): contratos de d.linhas,
 * Valor Mensal Vigente bruto, ciclo da loc_v_ciclo e índice (sem índice = Fixo).
 * Ordenada por valor; % e % acumulado sempre sobre o total da lista completa.
 */
export function baseRenovacoes(linhas: any[]) {
  const lista: ContratoRenovacao[] = linhas
    .map((l: any) => {
      const bruto = l.ciclo?.ciclo;
      const ciclo: CicloRenovacao = bruto === "a_vencer_120d" || bruto === "a_vencer_12m" || bruto === "vigente" ? bruto : "sem_data";
      const ind = l.indice;
      return {
        contrato_id: l.contrato_id,
        unidades: l.unidades ?? "—",
        locatario: l.locatario ?? "—",
        valor: Number(l.valor_vigente ?? 0),
        indice: !ind || ind === "NENHUM" ? "FIXO" : String(ind),
        ciclo,
        fim: l.ciclo?.fim_contrato ?? l.fim ?? null,
        dias: l.ciclo?.dias_para_o_fim ?? null,
        pct: 0, pctAcum: 0, classe: "C" as const,
      };
    })
    .sort((a, b) => b.valor - a.valor || a.unidades.localeCompare(b.unidades, "pt-BR", { numeric: true }));
  const total = lista.reduce((s, c) => s + c.valor, 0);
  let acum = 0;
  for (const c of lista) {
    c.pct = total ? (c.valor / total) * 100 : 0;
    c.classe = acum < 80 ? "A" : acum < 95 ? "B" : "C";
    acum += c.pct;
    c.pctAcum = acum;
  }
  const porCiclo = CICLOS_RENOVACAO.map((c) => {
    const itens = lista.filter((x) => x.ciclo === c.chave);
    const valor = itens.reduce((s, x) => s + x.valor, 0);
    return { ...c, n: itens.length, valor, pct: total ? (valor / total) * 100 : 0 };
  }).filter((c) => c.chave !== "sem_data" || c.n > 0);
  const porIndiceMap = new Map<string, { n: number; valor: number }>();
  for (const c of lista) {
    const g = porIndiceMap.get(c.indice) ?? { n: 0, valor: 0 };
    g.n += 1; g.valor += c.valor;
    porIndiceMap.set(c.indice, g);
  }
  const porIndice = [...porIndiceMap.entries()]
    .map(([indice, g]) => ({ indice, label: indiceLabel(indice), ...g, pct: total ? (g.valor / total) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor);
  const top10 = lista.slice(0, 10);
  return {
    lista, total, porCiclo, porIndice, top10,
    nContratos: lista.length,
    vencem120: porCiclo.find((c) => c.chave === "a_vencer_120d") ?? { n: 0, valor: 0 },
    vencem12m: porCiclo.find((c) => c.chave === "a_vencer_12m") ?? { n: 0, valor: 0 },
    top10Valor: top10.reduce((s, c) => s + c.valor, 0),
  };
}

/** "YYYY-MM" somado de n meses */
export function addMes(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Taxa de reajuste projetada para o mês m do ano: ((13−m)/12)·F[ano−1] + ((m−1)/12)·F[ano] + ajuste */
export function taxaProjetada(focus: Record<number, number>, ano: number, m: number, ajuste = 0) {
  const ant = focus[ano - 1] ?? focus[ano] ?? 0;
  const atual = focus[ano] ?? ant;
  return ((13 - m) / 12) * ant + ((m - 1) / 12) * atual + ajuste;
}

export type ContratoProj = {
  contrato_id: string;
  valor_vigente: number;
  indice: string | null;
  mes_reajuste: number | null;
  retencao_pct: number | null;
  degraus: { a_partir: string; valor_mensal: number }[];
  renovacao?: { em: string; valor: number } | null;
};

/**
 * Projeta o valor de referência mês a mês (chave YYYY-MM) a partir do mês seguinte a `desde` até `ate`.
 * Retorna o valor de caixa por mês (boleto do mês M paga a referência M−1; retenção aplicada).
 */
export function projetarContrato(
  c: ContratoProj,
  desde: string,
  ate: string,
  focus: { IPCA: Record<number, number>; IGPM: Record<number, number> },
  ajuste = 0,
) {
  const ref = new Map<string, number>();
  let valor = Number(c.valor_vigente ?? 0);
  const degraus = new Map(c.degraus.map((d) => [d.a_partir.slice(0, 7), Number(d.valor_mensal)]));
  for (let k = addMes(desde, 1); k <= ate; k = addMes(k, 1)) {
    const [y, m] = k.split("-").map(Number);
    if (c.renovacao && c.renovacao.em.slice(0, 7) === k) valor = c.renovacao.valor;
    else if (degraus.has(k)) valor = degraus.get(k)!;
    else if (c.mes_reajuste === m && valor > 0 && ["IPCA", "IGPM", "MEDIA"].includes(c.indice ?? "")) {
      const t =
        c.indice === "MEDIA"
          ? (taxaProjetada(focus.IPCA, y, m, ajuste) + taxaProjetada(focus.IGPM, y, m, ajuste)) / 2
          : taxaProjetada(focus[c.indice as "IPCA" | "IGPM"], y, m, ajuste);
      valor = valor * (1 + t / 100);
    }
    ref.set(k, valor);
  }
  const ret = 1 - Number(c.retencao_pct ?? 0) / 100;
  const caixa = new Map<string, number>();
  for (const [k, v] of ref) caixa.set(addMes(k, 1), v * ret);
  return { ref, caixa };
}
