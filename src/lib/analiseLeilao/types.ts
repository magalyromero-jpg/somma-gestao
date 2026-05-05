export type Estrutura = "Alvenaria" | "Metálica" | "Mista" | "Madeira";
export type Conservacao = "Ótimo" | "Bom" | "Regular" | "Ruim";

export interface DadosImovel {
  // Identificação
  nome: string;
  endereco: string;
  leilao: string;
  areaConst: number;
  areaLote: number;
  testada: number;
  tipo: string;
  estrutura: Estrutura;
  estadoConservacao: Conservacao;
  matricula: string;
  locatario: string;

  // Financeiro (valores em mil quando indicado)
  lanceMinimoMil: number;
  investimentoTotalMil: number;
  aluguelMensalInicial: number;
  prazoLocacaoMeses: number;
  valorVenalMil: number;
  valorMercadoMinMil: number;
  valorMercadoMaxMil: number;

  // Premissas macro (% a.a.)
  cdiAtual: number;
  cdiProjeto2026: number;
  cdiProjeto2027: number;
  cdiProjeto2028plus: number;
  ipcaProjeto2026: number;
  ipcaProjeto2027: number;
  ipcaProjeto2028plus: number;
}

export const FOCUS_DEFAULTS = {
  cdiAtual: 14.65,
  cdiProjeto2026: 13.0,
  cdiProjeto2027: 11.0,
  cdiProjeto2028plus: 10.0,
  ipcaProjeto2026: 4.89,
  ipcaProjeto2027: 4.0,
  ipcaProjeto2028plus: 3.6,
};

export const DEFAULT_DADOS: DadosImovel = {
  nome: "",
  endereco: "",
  leilao: "",
  areaConst: 0,
  areaLote: 0,
  testada: 0,
  tipo: "",
  estrutura: "Alvenaria",
  estadoConservacao: "Ótimo",
  matricula: "",
  locatario: "",
  lanceMinimoMil: 0,
  investimentoTotalMil: 0,
  aluguelMensalInicial: 0,
  prazoLocacaoMeses: 60,
  valorVenalMil: 0,
  valorMercadoMinMil: 0,
  valorMercadoMaxMil: 0,
  ...FOCUS_DEFAULTS,
};

export interface AnaliseSalva {
  id: number;
  criadoEm: string;
  nome: string;
  lanceMinimoMil: number;
  capRate: number;
  dados: DadosImovel;
}

// ---------- Derived ----------
export const capRateNominal = (d: DadosImovel) =>
  d.lanceMinimoMil > 0 && d.aluguelMensalInicial > 0
    ? ((d.aluguelMensalInicial * 12) / (d.lanceMinimoMil * 1000)) * 100
    : 0;

export const descontoMercadoPct = (d: DadosImovel) =>
  d.valorMercadoMinMil > 0 && d.lanceMinimoMil > 0
    ? ((d.valorMercadoMinMil - d.lanceMinimoMil) / d.valorMercadoMinMil) * 100
    : null;

export const precoPorM2 = (d: DadosImovel) =>
  d.areaConst > 0 ? (d.lanceMinimoMil * 1000) / d.areaConst : 0;

export const cdiCurva = (d: DadosImovel) => [
  d.cdiAtual,
  d.cdiProjeto2026,
  d.cdiProjeto2027,
  ...Array(7).fill(d.cdiProjeto2028plus),
];

export const ipcaCurva = (d: DadosImovel) => [
  d.ipcaProjeto2026,
  d.ipcaProjeto2026,
  d.ipcaProjeto2027,
  ...Array(7).fill(d.ipcaProjeto2028plus),
];

export const PREMISSAS_LABELS = (d: DadosImovel) => [
  { p: "CDI atual", v: `${d.cdiAtual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.a.`, f: "BCB / Focus" },
  { p: "CDI projetado 2026", v: `${d.cdiProjeto2026.toLocaleString("pt-BR")}% a.a.`, f: "Boletim Focus" },
  { p: "CDI projetado 2027", v: `${d.cdiProjeto2027.toLocaleString("pt-BR")}% a.a.`, f: "Boletim Focus" },
  { p: "CDI projetado 2028+", v: `${d.cdiProjeto2028plus.toLocaleString("pt-BR")}% a.a.`, f: "Boletim Focus" },
  { p: "IPCA projetado 2026", v: `${d.ipcaProjeto2026.toLocaleString("pt-BR")}% a.a.`, f: "Boletim Focus" },
  { p: "IPCA projetado 2027", v: `${d.ipcaProjeto2027.toLocaleString("pt-BR")}% a.a.`, f: "Boletim Focus" },
  { p: "IPCA projetado 2028+", v: `${d.ipcaProjeto2028plus.toLocaleString("pt-BR")}% a.a.`, f: "Boletim Focus" },
];
