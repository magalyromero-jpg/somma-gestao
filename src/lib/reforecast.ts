import { dt } from "./locacoes";

export type ValorCaixa = { contrato_id: string; mes: string; valor: number | string | null };
export type VigenciaReforecast = { contrato_id: string; seq: number; no_orcamento?: boolean; observacao?: string | null; data_documento?: string | null };
export type ContratoReforecast = { id: string; no_orcamento: boolean; data_inicio?: string | null };

export function previstoPorMes(previsto: ValorCaixa[], ids: Set<string>, ano: string) {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = `${ano}-${String(i + 1).padStart(2, "0")}`;
    return previsto.filter((p) => ids.has(p.contrato_id) && p.mes.startsWith(mes)).reduce((s, p) => s + Number(p.valor ?? 0), 0);
  });
}

export function compararReforecast(orcado: number, previsto: number) {
  const diferenca = Math.round((previsto - orcado) * 100) / 100;
  const estado = Math.abs(diferenca) < 1 ? "igual" : orcado === 0 && previsto > 0 ? "novo" : diferenca > 0 ? "acima" : "abaixo";
  return { diferenca, estado } as const;
}

export function motivoReforecast(contratos: ContratoReforecast[], vigencias: VigenciaReforecast[]) {
  const ids = new Set(contratos.map((c) => c.id));
  const candidatas = vigencias.filter((v) => ids.has(v.contrato_id) && v.no_orcamento === false)
    .sort((a, b) => String(b.data_documento ?? "").localeCompare(String(a.data_documento ?? "")) || b.seq - a.seq);
  const observacao = candidatas[0]?.observacao?.trim();
  if (observacao) return observacao;
  const novo = [...contratos].filter((c) => c.no_orcamento === false)
    .sort((a, b) => String(b.data_inicio ?? "").localeCompare(String(a.data_inicio ?? "")))[0];
  if (novo) {
    const inicial = vigencias.filter((v) => v.contrato_id === novo.id).sort((a, b) => a.seq - b.seq)[0];
    return `Contrato novo, assinado em ${dt(inicial?.data_documento)}`;
  }
  return "Diferença entre o previsto pelos contratos e o orçado";
}