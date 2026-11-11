import { describe, expect, it } from "vitest";
import { filtrarPeriodo, principaisUnidades, resumoComposicao, serieAluguel, type MovimentoAluguel, type EvolucaoMensal } from "./evolucaoAluguel";
const row = (grupo: "Salas" | "Lojas", aluguel: number, area_m2: number, contratos: number, mes = "2026-11-01"): EvolucaoMensal => ({ grupo, aluguel, area_m2, contratos, mes, rs_m2: aluguel / area_m2, projetado: false });
const mov = (categoria: MovimentoAluguel["categoria"], valor: number, grupo: "Salas" | "Lojas" = "Salas", data: string | null = "2026-05-01"): MovimentoAluguel => ({ contrato_id: grupo, unidades: grupo, locatario: "Locatário", categoria, valor, grupo, data });
describe("Evolução do aluguel", () => {
  it("soma a receita mensal e pondera R$/m² pela área, não pela média dos grupos", () => {
    const s = serieAluguel([row("Salas",603337.21,8939.10,24),row("Lojas",42115,523.24,6)],"2026-11-11")[0];
    expect(s.Total?.aluguel).toBe(645452.21);
    expect(s.Total?.rs_m2).toBeCloseTo(645452.21 / 9462.34, 5);
    expect(s.Total?.contratos).toBe(30);
  });
  it("interrompe linhas sem contratos e exclui projeções", () => {
    const s = serieAluguel([row("Salas",40000,947,2,"2020-09-01"),row("Salas",41000,947,2,"2020-11-01"),{...row("Lojas",42115,523.24,6,"2026-12-01"),projetado:true}],"2026-11-11");
    expect(s).toHaveLength(3); expect(s[1].Salas).toBeNull(); expect(s[0].Lojas).toBeNull();
  });
  it("últimos 12 e 24 meses incluem o atual e ano atual começa em janeiro", () => {
    const rows = Array.from({length:36},(_,i)=>({mes:new Date(Date.UTC(2024,i,1)).toISOString().slice(0,10)}));
    expect(filtrarPeriodo(rows,"12","2026-11-11")[0].mes).toBe("2025-12-01");
    expect(filtrarPeriodo(rows,"24","2026-11-11")[0].mes).toBe("2024-12-01");
    expect(filtrarPeriodo(rows,"ano","2026-11-11")).toHaveLength(11);
  });
  it("cascata fecha exatamente com a soma de todas as origens", () => {
    const rs = [mov("Base",504866.91),mov("Reajuste por Índice",61740.04),mov("Aditivos e Renovações",90872.96),mov("Acordos",-12027.09),mov("Saídas",-16613.92),mov("Base",36500,"Lojas"),mov("Reajuste por Índice",514.21,"Lojas"),mov("Aditivos e Renovações",5100,"Lojas")];
    const r = resumoComposicao(rs,"Total","2026-11-11");
    expect(r.inicial).toBe(541366.91); expect(r.atual).toBe(670953.11); expect(r.variacao).toBe(129586.2); expect(r.percentual).toBeCloseTo(23.94,2); expect(r.fechamento).toBe(0);
    expect(resumoComposicao(rs,"Salas","2026-11-11").atual).toBe(628838.9);
    expect(resumoComposicao(rs,"Lojas","2026-11-11").atual).toBe(42114.21);
  });
  it("agrupa movimentos anteriores a 2026 sem Base e não inclui futuro", () => {
    const r=resumoComposicao([mov("Base",100),mov("Reajuste por Índice",10,"Salas","2025-12-01"),mov("Acordos",-2),mov("Saídas",-4,"Salas","2026-07-01"),mov("Acordos",20,"Salas","2026-12-01")],"Total","2026-11-11");
    expect(r.periodos[0]["Reajuste por Índice"]).toBe(10); expect(r.periodos[1].Acordos).toBe(-2); expect(r.periodos[2].Saídas).toBe(-4); expect(r.atual).toBe(104);
  });
  it("ordena variação por unidade e limita tooltip às cinco maiores contribuições", () => {
    const rs=Array.from({length:7},(_,i)=>({...mov("Acordos",-i),contrato_id:String(i),unidades:`Sala ${i}`}));
    const r=resumoComposicao(rs,"Total","2026-11-11");
    expect(r.unidades[0].variacao).toBe(0); expect(r.unidades.at(-1)?.variacao).toBe(-6);
    expect(principaisUnidades(rs,"Acordos").map(x=>x.valor)).toEqual([-6,-5,-4,-3,-2]);
  });
});