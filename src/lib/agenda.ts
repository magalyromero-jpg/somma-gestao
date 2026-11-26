// Agenda de reajustes, degraus e renovações: helpers puros (sem efeito no Orçado).
export type AgendaStatus = "pendente" | "a_vencer" | "em_andamento" | "realizado" | "dispensado";
export type AgendaTipo = "reajuste" | "degrau" | "renovacao";
export interface EventoAgenda {
  edificio_id: string; contrato_id: string; tipo: AgendaTipo; data_evento: string; status: AgendaStatus;
  registrado: boolean; unidades: string | null; locatario: string | null; indice: string | null;
  valor_atual: number | null; mes_referencia: string | null; percentual_sugerido: number | null; valor_sugerido: number | null;
  vigencia_sugerida: string | null; indice_estimado: boolean; valor_novo: number | null; observacao: string | null;
  documento_id: string | null; registrado_em: string | null;
}
export const STATUS_LABEL: Record<AgendaStatus, string> = {
  pendente: "Pendente", a_vencer: "A Vencer", em_andamento: "Em Andamento", realizado: "Realizado", dispensado: "Dispensado",
};
export const TIPO_LABEL: Record<AgendaTipo, string> = { reajuste: "Reajuste", degrau: "Degrau do Contrato", renovacao: "Renovação" };
export const TIPO_LETRA: Record<AgendaTipo, string> = { reajuste: "R", degrau: "D", renovacao: "N" };
export const RENOVACAO_LABEL: Record<AgendaStatus, string> = { ...STATUS_LABEL, realizado: "Realizada", dispensado: "Dispensada" };

export type FiltroAgenda = "todos" | "pendente" | "em_andamento" | "realizado" | "a_vencer_60" | "realizado_ano" | "anteriores";

export const mesDe = (d: string) => d.slice(0, 7);

/** Pendentes de meses anteriores ao mês exibido. */
export function pendentesAnteriores(evs: EventoAgenda[], mes: string) {
  return evs.filter((e) => e.status === "pendente" && mesDe(e.data_evento) < mes);
}

/** Itens de aviso: pendentes + a vencer em 60 dias (sem degraus), como o contador do banco. */
export function itensAviso(evs: EventoAgenda[], hoje: string) {
  const lim = somaDias(hoje, 60);
  return evs.filter((e) => e.status === "pendente" || (e.status === "a_vencer" && e.tipo !== "degrau" && e.data_evento <= lim))
    .sort((a, b) => a.data_evento.localeCompare(b.data_evento));
}

export function somaDias(d: string, n: number) {
  const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10);
}

export function filtrar(evs: EventoAgenda[], mes: string, filtro: FiltroAgenda, hoje: string) {
  const ano = hoje.slice(0, 4);
  if (filtro === "anteriores") return pendentesAnteriores(evs, mes);
  if (filtro === "a_vencer_60") return itensAviso(evs, hoje).filter((e) => e.status === "a_vencer");
  if (filtro === "realizado_ano") return evs.filter((e) => e.status === "realizado" && e.data_evento.startsWith(ano) && e.tipo !== "degrau");
  const doMes = evs.filter((e) => mesDe(e.data_evento) === mes);
  return filtro === "todos" ? doMes : doMes.filter((e) => e.status === filtro);
}

export const ordenar = (evs: EventoAgenda[]) =>
  [...evs].sort((a, b) => a.data_evento.localeCompare(b.data_evento) || (a.unidades ?? "").localeCompare(b.unidades ?? "", "pt-BR", { numeric: true }));
