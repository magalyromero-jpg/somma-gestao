// Leitura por regra fixa da exportação "movimentações de cobrança" (PDF com texto selecionável).
export type StatusBoleto = "paga" | "a_vencer" | "vencida" | "cancelada";
export interface BoletoLido {
  nosso_numero: string; pagador: string; documento: string;
  data_emissao: string | null; data_vencimento: string; data_pagamento: string | null; data_baixa: string | null;
  valor_titulo: number; valor_pago: number; status: StatusBoleto;
}

const LINHA = /^(\d{3})\s+(.+?)\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})\s+BOLETO\s+(\d+)\s+(.*)$/;
const FIM = /(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(paga|a vencer|cancelada|vencida)\s*$/;
const iso = (d?: string) => (d ? `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}` : null);
const n = (s: string) => Number(s.replace(",", "."));

export function lerLinhaBoleto(linha: string): BoletoLido | null {
  const m = linha.trim().replace(/\s+/g, " ").match(LINHA);
  if (!m) return null;
  const resto = m[5];
  const f = resto.match(FIM);
  if (!f) return null;
  const status = (f[3] === "a vencer" ? "a_vencer" : f[3]) as StatusBoleto;
  const datas = resto.match(/\d{2}\/\d{2}\/\d{4}/g) ?? [];
  if (datas.length < 2) return null;
  return {
    nosso_numero: m[4], pagador: m[2].trim(), documento: m[3],
    data_emissao: iso(datas[0]), data_vencimento: iso(datas[1])!,
    data_pagamento: status === "paga" ? iso(datas[2]) : null,
    data_baixa: status === "cancelada" ? iso(datas[2]) : null,
    valor_titulo: n(f[1]), valor_pago: n(f[2]), status,
  };
}

/** Agrupa itens de texto por linha (mesma coordenada vertical), da esquerda para a direita. */
export function agruparLinhas(itens: { str: string; x: number; y: number }[]): string[] {
  const porY = new Map<number, { str: string; x: number }[]>();
  for (const it of itens) {
    if (!it.str.trim()) continue;
    const y = Math.round(it.y);
    const k = [...porY.keys()].find((v) => Math.abs(v - y) <= 1) ?? y;
    porY.set(k, [...(porY.get(k) ?? []), it]);
  }
  return [...porY.entries()].sort((a, b) => b[0] - a[0])
    .map(([, l]) => l.sort((a, b) => a.x - b.x).map((i) => i.str.trim()).join(" "));
}

export function lerBoletos(linhas: string[]): BoletoLido[] {
  return linhas.map(lerLinhaBoleto).filter((b): b is BoletoLido => !!b);
}

/** Meses do planejamento: do mês seguinte ao atual até dezembro do mesmo ano (aaaa-mm). */
export function mesesPlanejamento(hoje: string): string[] {
  const ano = hoje.slice(0, 4); const m = Number(hoje.slice(5, 7));
  const r: string[] = [];
  for (let i = m + 1; i <= 12; i++) r.push(`${ano}-${String(i).padStart(2, "0")}`);
  return r;
}
