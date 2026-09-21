/**
 * Períodos de conclusão no fuso America/Sao_Paulo (UTC-3, sem horário de verão).
 * Datas são manipuladas como "YYYY-MM-DD" do calendário de São Paulo.
 * Semana começa na segunda-feira.
 */

export type PeriodoPreset =
  | "hoje"
  | "semana"
  | "semana_passada"
  | "mes"
  | "mes_passado"
  | "ultimos30"
  | "personalizado"
  | "todo";

export const PERIODO_LABEL: Record<PeriodoPreset, string> = {
  hoje: "Hoje",
  semana: "Esta semana",
  semana_passada: "Semana passada",
  mes: "Este mês",
  mes_passado: "Mês passado",
  ultimos30: "Últimos 30 dias",
  personalizado: "Personalizado",
  todo: "Todo o período",
};

export const PERIODO_OPCOES: PeriodoPreset[] = [
  "hoje",
  "semana",
  "semana_passada",
  "mes",
  "mes_passado",
  "ultimos30",
  "personalizado",
  "todo",
];

/** Intervalo em datas de calendário de São Paulo; null = todo o período. */
export interface PeriodoRange {
  inicio: string;
  fim: string;
}

const TZ = "America/Sao_Paulo";

/** Hoje (YYYY-MM-DD) em São Paulo. */
export function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function toUTC(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDias(ymd: string, dias: number): string {
  const d = toUTC(ymd);
  d.setUTCDate(d.getUTCDate() + dias);
  return fmt(d);
}

/** Segunda-feira da semana de `ymd`. */
export function inicioSemana(ymd: string): string {
  const d = toUTC(ymd);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  return addDias(ymd, -dow);
}

export function inicioMes(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

export function fimMes(ymd: string): string {
  const d = toUTC(inicioMes(ymd));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return fmt(d);
}

/** Converte preset em intervalo de datas; `todo` devolve null. */
export function rangeDoPreset(preset: PeriodoPreset, custom?: PeriodoRange | null): PeriodoRange | null {
  const hoje = hojeSP();
  switch (preset) {
    case "hoje":
      return { inicio: hoje, fim: hoje };
    case "semana": {
      const ini = inicioSemana(hoje);
      return { inicio: ini, fim: addDias(ini, 6) };
    }
    case "semana_passada": {
      const ini = addDias(inicioSemana(hoje), -7);
      return { inicio: ini, fim: addDias(ini, 6) };
    }
    case "mes":
      return { inicio: inicioMes(hoje), fim: fimMes(hoje) };
    case "mes_passado": {
      const ref = addDias(inicioMes(hoje), -1);
      return { inicio: inicioMes(ref), fim: fimMes(ref) };
    }
    case "ultimos30":
      return { inicio: addDias(hoje, -29), fim: hoje };
    case "personalizado":
      return custom ?? null;
    case "todo":
      return null;
  }
}

/** Formata "dd/MM/yyyy" a partir de YYYY-MM-DD. */
export function fmtYmd(ymd: string): string {
  const [a, m, d] = ymd.split("-");
  return `${d}/${m}/${a}`;
}

export function labelRange(range: PeriodoRange | null): string {
  if (!range) return "Todo o período";
  return range.inicio === range.fim
    ? fmtYmd(range.inicio)
    : `${fmtYmd(range.inicio)} – ${fmtYmd(range.fim)}`;
}

/** Instante ISO cai dentro do intervalo (dias inteiros no fuso de São Paulo)? */
export function dentroDoPeriodo(iso: string | null, range: PeriodoRange | null): boolean {
  if (!iso) return false;
  if (!range) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const ini = new Date(`${range.inicio}T00:00:00-03:00`).getTime();
  const fim = new Date(`${range.fim}T23:59:59.999-03:00`).getTime();
  return t >= ini && t <= fim;
}

/** Concluída no período: status completed + concluido_em dentro do intervalo. */
export function concluidaNoPeriodo(
  t: { status?: string; concluido_em: string | null },
  range: PeriodoRange | null,
): boolean {
  if (t.status !== undefined && t.status !== "completed") return false;
  return dentroDoPeriodo(t.concluido_em, range);
}

/** Date (meio-dia UTC) para uso em calendários a partir de YYYY-MM-DD. */
export function ymdParaDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00Z`);
}

export function dateParaYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
