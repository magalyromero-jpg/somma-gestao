export type GrupoAluguel = "Salas" | "Lojas";
export type PeriodoAluguel = "tudo" | "24" | "12" | "ano";
export type MetricaAluguel = "rs_m2" | "aluguel";
export type EvolucaoMensal = { grupo: GrupoAluguel; mes: string; contratos: number; area_m2: number; aluguel: number; rs_m2: number; projetado: boolean };
export const CATEGORIAS_ALUGUEL = ["Reajuste por Índice", "Aditivos e Renovações", "Acordos", "Saídas"] as const;
export type CategoriaAluguel = typeof CATEGORIAS_ALUGUEL[number];
export type MovimentoAluguel = { contrato_id: string; unidades: string; locatario: string; grupo: GrupoAluguel; data: string | null; categoria: CategoriaAluguel | "Base"; valor: number };
export const centavos = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
export function serieAluguel(rows: EvolucaoMensal[], hoje: string) {
  const meses = new Map<string, { mes: string; Salas: EvolucaoMensal | null; Lojas: EvolucaoMensal | null }>();
  for (const r of rows) {
    if (r.projetado || r.mes.slice(0, 7) > hoje.slice(0, 7)) continue;
    const item = meses.get(r.mes) ?? { mes: r.mes, Salas: null, Lojas: null };
    item[r.grupo] = r;
    meses.set(r.mes, item);
  }
  const keys = [...meses.keys()].sort();
  const first = keys[0], last = keys.at(-1);
  if (!first || !last) return [];
  // Preserve missing months as gaps rather than connecting observations across them.
  for (let m = first; m <= last;) {
    if (!meses.has(m)) meses.set(m, { mes: m, Salas: null, Lojas: null });
    const [y, n] = m.split("-").map(Number);
    m = `${n === 12 ? y + 1 : y}-${String(n === 12 ? 1 : n + 1).padStart(2, "0")}-01`;
  }
  return [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes)).map((m) => {
    const aluguel = centavos(Number(m.Salas?.aluguel ?? 0) + Number(m.Lojas?.aluguel ?? 0));
    const area = Number(m.Salas?.area_m2 ?? 0) + Number(m.Lojas?.area_m2 ?? 0);
    return { ...m, Total: m.Salas || m.Lojas ? { aluguel, area_m2: area, contratos: Number(m.Salas?.contratos ?? 0) + Number(m.Lojas?.contratos ?? 0), rs_m2: area ? aluguel / area : 0 } : null };
  });
}
export function filtrarPeriodo<T extends { mes: string }>(rows: T[], periodo: PeriodoAluguel, hoje: string) {
  const [y, m] = hoje.split("-").map(Number);
  const inicio = periodo === "ano" ? `${y}-01` : periodo === "tudo" ? "0000-01" : (() => {
    const d = new Date(Date.UTC(y, m - Number(periodo), 1));
    return d.toISOString().slice(0, 7);
  })();
  return rows.filter((r) => r.mes.slice(0, 7) >= inicio && r.mes.slice(0, 7) <= hoje.slice(0, 7));
}
export function resumoComposicao(rows: MovimentoAluguel[], grupo: "Total" | GrupoAluguel, hoje: string) {
  const itens = rows.filter((r) => (grupo === "Total" || r.grupo === grupo) && (!r.data || r.data <= hoje));
  const soma = (rs: MovimentoAluguel[]) => centavos(rs.reduce((s, r) => s + Number(r.valor), 0));
  const inicial = soma(itens.filter((r) => r.categoria === "Base"));
  const atual = soma(itens);
  const categorias = CATEGORIAS_ALUGUEL.map((categoria) => ({ categoria, valor: soma(itens.filter((r) => r.categoria === categoria)) }));
  let cursor = inicial;
  const cascata = [ { categoria: "Aluguel Inicial", base: 0, faixa: inicial, valor: inicial, total: true }, ...categorias.map((r) => {
    const fim = centavos(cursor + r.valor);
    const b = { ...r, base: Math.min(cursor, fim), faixa: Math.abs(r.valor), total: false };
    cursor = fim;
    return b;
  }), { categoria: "Aluguel Atual", base: 0, faixa: atual, valor: atual, total: true } ];
  const periodos = ["Até 2025 (Acumulado)", "1º Sem/2026", "2º Sem/2026"].map((nome, i) => {
    const rs = itens.filter((r) => r.categoria !== "Base" && r.data && (i === 0 ? r.data < "2026-01-01" : i === 1 ? r.data >= "2026-01-01" && r.data < "2026-07-01" : r.data >= "2026-07-01" && r.data < "2027-01-01"));
    return { nome, ...Object.fromEntries(CATEGORIAS_ALUGUEL.map((c) => [c, soma(rs.filter((r) => r.categoria === c))])) };
  });
  const ids = [...new Set(itens.map((r) => r.contrato_id))];
  const unidades = ids.map((id) => {
    const rs = itens.filter((r) => r.contrato_id === id), r = rs[0];
    return { contrato_id: id, nome: `${r?.unidades ?? "—"} · ${r?.locatario ?? "—"}`, variacao: soma(rs.filter((r) => r.categoria !== "Base")), ...Object.fromEntries(CATEGORIAS_ALUGUEL.map((c) => [c, soma(rs.filter((r) => r.categoria === c))])) };
  }).sort((a, b) => b.variacao - a.variacao);
  return { itens, inicial, atual, variacao: centavos(atual - inicial), percentual: inicial ? (atual / inicial - 1) * 100 : null, categorias, cascata, periodos, unidades, fechamento: centavos(cursor - atual) };
}
export function principaisUnidades(rows: MovimentoAluguel[], categoria: string) {
  const rs = rows.filter((r) => categoria === "Aluguel Inicial" ? r.categoria === "Base" : categoria === "Aluguel Atual" ? true : r.categoria === categoria);
  const grupos = new Map<string, { unidades: string; locatario: string; valor: number }>();
  for (const r of rs) {
    const g = grupos.get(r.contrato_id) ?? { unidades: r.unidades, locatario: r.locatario, valor: 0 };
    g.valor = centavos(g.valor + Number(r.valor));
    grupos.set(r.contrato_id, g);
  }
  return [...grupos.values()].sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)).slice(0, 5);
}