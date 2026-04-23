// Dados mock para desenvolvimento — Somma MFO
export type StatusLocacao =
  | "Locado"
  | "Vago"
  | "Carencia"
  | "Vendido"
  | "Inativo"
  | "Doado"
  | "EmDesenvolvimento";

export type Classificacao = "Residencial" | "Comercial" | "Terreno" | "Participacao";

export interface Pagamento {
  mes: string; // "2026-01"
  bruto: number;
  liquido: number;
  status: "Pago" | "Pendente";
}

export interface Contrato {
  id: string;
  ativo: boolean;
  locatarios: string[];
  inicio: string;
  fim: string;
  valor_aluguel: number;
  pagamentos: Pagamento[];
}

export interface Imovel {
  cod_imovel: number;
  cod_interno: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  classificacao: Classificacao;
  tipo: string;
  uso: string;
  area_m2: number;
  status: StatusLocacao;
  valor_mercado: number;
  valor_compra: number;
  valor_aluguel_mensal: number;
  valorizacao_pct: number;
  lat: number;
  lng: number;
  fotos: string[];
  contrato_ativo?: Contrato;
  contratos_anteriores?: Contrato[];
  familia_id: string;
  familia_nome?: string;
}

export interface Familia {
  id: string;
  nome: string;
  cor_avatar: string;
  membros: { id: string; nome: string; tipo: "cliente" | "empresa" }[];
}

export const familias: Familia[] = [
  {
    id: "drebes",
    nome: "Família Drebes",
    cor_avatar: "#0F1F3D",
    membros: [
      { id: "d1", nome: "Carlos Drebes", tipo: "cliente" },
      { id: "d2", nome: "Marina Drebes", tipo: "cliente" },
      { id: "d3", nome: "Drebes Participações Ltda", tipo: "empresa" },
    ],
  },
  {
    id: "rebello",
    nome: "Família Rebello",
    cor_avatar: "#C9A84C",
    membros: [
      { id: "r1", nome: "Fernando Rebello", tipo: "cliente" },
      { id: "r2", nome: "Rebello Holding S.A.", tipo: "empresa" },
    ],
  },
  {
    id: "gutierrez",
    nome: "Família Gutierrez",
    cor_avatar: "#22C55E",
    membros: [
      { id: "g1", nome: "Ricardo Gutierrez", tipo: "cliente" },
      { id: "g2", nome: "Helena Gutierrez", tipo: "cliente" },
    ],
  },
];

const monthsBack = (n: number) => {
  const out: string[] = [];
  const d = new Date(2026, 3, 1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
};

const buildPagamentos = (valor: number, n = 12): Pagamento[] =>
  monthsBack(n).map((mes, i) => ({
    mes,
    bruto: valor,
    liquido: Math.round(valor * 0.88),
    status: i === n - 1 ? "Pendente" : "Pago",
  }));

const contrato = (locatarios: string[], aluguel: number, inicio: string): Contrato => ({
  id: Math.random().toString(36).slice(2, 9),
  ativo: true,
  locatarios,
  inicio,
  fim: "2027-12-31",
  valor_aluguel: aluguel,
  pagamentos: buildPagamentos(aluguel, 12),
});

let codSeq = 10000;
const mk = (i: Partial<Imovel>): Imovel => {
  codSeq += 1;
  const valor_compra = i.valor_compra ?? 500000;
  const valor_mercado = i.valor_mercado ?? valor_compra * 1.4;
  return {
    cod_imovel: codSeq,
    cod_interno: i.cod_interno ?? `IM-${codSeq}`,
    endereco: i.endereco ?? "—",
    bairro: i.bairro ?? "—",
    cidade: i.cidade ?? "Porto Alegre",
    estado: i.estado ?? "RS",
    classificacao: i.classificacao ?? "Residencial",
    tipo: i.tipo ?? "Apartamento",
    uso: i.uso ?? "Locação",
    area_m2: i.area_m2 ?? 80,
    status: i.status ?? "Locado",
    valor_mercado,
    valor_compra,
    valor_aluguel_mensal: i.valor_aluguel_mensal ?? 0,
    valorizacao_pct: Math.round(((valor_mercado - valor_compra) / valor_compra) * 1000) / 10,
    lat: i.lat ?? -30.0346,
    lng: i.lng ?? -51.2177,
    fotos: i.fotos ?? [],
    familia_id: i.familia_id!,
    contrato_ativo: i.contrato_ativo,
    contratos_anteriores: i.contratos_anteriores,
  };
};

export const imoveis: Imovel[] = [
  // Drebes — 12 imóveis
  mk({ familia_id: "drebes", endereco: "Rua Padre Chagas, 240 — apto 802", bairro: "Moinhos de Vento", cidade: "Porto Alegre", estado: "RS", tipo: "Apartamento", area_m2: 142, status: "Locado", valor_compra: 980000, valor_mercado: 1850000, valor_aluguel_mensal: 7200, lat: -30.0277, lng: -51.2031, contrato_ativo: contrato(["Souza Cruz Ltda."], 7200, "2024-03-01") }),
  mk({ familia_id: "drebes", endereco: "Av. Independência, 1500 — apto 1102", bairro: "Independência", cidade: "Porto Alegre", estado: "RS", tipo: "Apartamento", area_m2: 96, status: "Locado", valor_compra: 620000, valor_mercado: 1080000, valor_aluguel_mensal: 4500, lat: -30.0244, lng: -51.2056, contrato_ativo: contrato(["Mariana Schneider"], 4500, "2023-08-15") }),
  mk({ familia_id: "drebes", endereco: "Rua Comendador Caminha, 320 — apto 401", bairro: "Moinhos de Vento", cidade: "Porto Alegre", estado: "RS", tipo: "Apartamento", area_m2: 78, status: "Vago", valor_compra: 480000, valor_mercado: 890000, valor_aluguel_mensal: 0, lat: -30.0259, lng: -51.2014 }),
  mk({ familia_id: "drebes", endereco: "Rua Quintino Bocaiúva, 890 — apto 502", bairro: "Mont'Serrat", cidade: "Porto Alegre", estado: "RS", tipo: "Apartamento", area_m2: 110, status: "Carencia", valor_compra: 720000, valor_mercado: 1320000, valor_aluguel_mensal: 5800, lat: -30.0205, lng: -51.1956, contrato_ativo: contrato(["Tech Lab S.A."], 5800, "2026-02-01") }),
  mk({ familia_id: "drebes", endereco: "Av. Carlos Gomes, 466 — sala 1208", bairro: "Auxiliadora", cidade: "Porto Alegre", estado: "RS", classificacao: "Comercial", tipo: "Sala Comercial", uso: "Locação", area_m2: 45, status: "Locado", valor_compra: 380000, valor_mercado: 690000, valor_aluguel_mensal: 3200, lat: -30.0216, lng: -51.1872, contrato_ativo: contrato(["Advocacia Mendes & Cia"], 3200, "2022-11-01") }),
  mk({ familia_id: "drebes", endereco: "Av. Carlos Gomes, 466 — sala 1210", bairro: "Auxiliadora", cidade: "Porto Alegre", estado: "RS", classificacao: "Comercial", tipo: "Sala Comercial", area_m2: 45, status: "Locado", valor_compra: 380000, valor_mercado: 690000, valor_aluguel_mensal: 3200, lat: -30.0216, lng: -51.1872, contrato_ativo: contrato(["Contabilidade Reis"], 3200, "2023-05-01") }),
  mk({ familia_id: "drebes", endereco: "Av. Carlos Gomes, 466 — sala 1305", bairro: "Auxiliadora", cidade: "Porto Alegre", estado: "RS", classificacao: "Comercial", tipo: "Sala Comercial", area_m2: 60, status: "Vago", valor_compra: 510000, valor_mercado: 880000, valor_aluguel_mensal: 0, lat: -30.0216, lng: -51.1872 }),
  mk({ familia_id: "drebes", endereco: "Loteamento Recanto do Sol — quadra 4 lote 12", bairro: "Centro", cidade: "Eldorado do Sul", estado: "RS", classificacao: "Terreno", tipo: "Terreno", uso: "Estoque", area_m2: 1200, status: "Inativo", valor_compra: 280000, valor_mercado: 720000, valor_aluguel_mensal: 0, lat: -30.0855, lng: -51.6171 }),
  mk({ familia_id: "drebes", endereco: "Loteamento Recanto do Sol — quadra 4 lote 13", bairro: "Centro", cidade: "Eldorado do Sul", estado: "RS", classificacao: "Terreno", tipo: "Terreno", area_m2: 1200, status: "Inativo", valor_compra: 280000, valor_mercado: 720000, valor_aluguel_mensal: 0, lat: -30.0855, lng: -51.6171 }),
  mk({ familia_id: "drebes", endereco: "Estrada Pereira, km 8 — gleba A", bairro: "Zona Rural", cidade: "Eldorado do Sul", estado: "RS", classificacao: "Terreno", tipo: "Gleba", uso: "Desenvolvimento", area_m2: 25000, status: "EmDesenvolvimento", valor_compra: 2100000, valor_mercado: 6800000, valor_aluguel_mensal: 0, lat: -30.0921, lng: -51.6244 }),
  mk({ familia_id: "drebes", endereco: "Rua General Lima e Silva, 1102 — loja", bairro: "Cidade Baixa", cidade: "Porto Alegre", estado: "RS", classificacao: "Comercial", tipo: "Loja", area_m2: 180, status: "Locado", valor_compra: 920000, valor_mercado: 1520000, valor_aluguel_mensal: 9800, lat: -30.0411, lng: -51.2225, contrato_ativo: contrato(["Restaurante Sabor & Arte"], 9800, "2021-06-01") }),
  mk({ familia_id: "drebes", endereco: "Rua Anita Garibaldi, 1601 — apto 304", bairro: "Boa Vista", cidade: "Porto Alegre", estado: "RS", tipo: "Apartamento", area_m2: 88, status: "Carencia", valor_compra: 540000, valor_mercado: 920000, valor_aluguel_mensal: 4200, lat: -30.0181, lng: -51.1788, contrato_ativo: contrato(["Paulo Henrique Borges"], 4200, "2026-03-10") }),

  // Rebello — 10 imóveis
  mk({ familia_id: "rebello", endereco: "Rua XV de Novembro, 880 — apto 901", bairro: "Centro", cidade: "Blumenau", estado: "SC", tipo: "Apartamento", area_m2: 124, status: "Locado", valor_compra: 680000, valor_mercado: 1180000, valor_aluguel_mensal: 5400, lat: -26.9189, lng: -49.0658, contrato_ativo: contrato(["Família Müller"], 5400, "2023-01-15") }),
  mk({ familia_id: "rebello", endereco: "Rua XV de Novembro, 880 — apto 1002", bairro: "Centro", cidade: "Blumenau", estado: "SC", tipo: "Apartamento", area_m2: 124, status: "Locado", valor_compra: 680000, valor_mercado: 1180000, valor_aluguel_mensal: 5500, lat: -26.9189, lng: -49.0658, contrato_ativo: contrato(["Cristina Hoffmann"], 5500, "2022-09-01") }),
  mk({ familia_id: "rebello", endereco: "Rua Sete de Setembro, 1240 — sala 502", bairro: "Centro", cidade: "Blumenau", estado: "SC", classificacao: "Comercial", tipo: "Sala Comercial", area_m2: 52, status: "Locado", valor_compra: 410000, valor_mercado: 720000, valor_aluguel_mensal: 3800, lat: -26.9201, lng: -49.0641, contrato_ativo: contrato(["Engenharia Bauer Ltda."], 3800, "2024-04-01") }),
  mk({ familia_id: "rebello", endereco: "Rua Sete de Setembro, 1240 — sala 503", bairro: "Centro", cidade: "Blumenau", estado: "SC", classificacao: "Comercial", tipo: "Sala Comercial", area_m2: 52, status: "Locado", valor_compra: 410000, valor_mercado: 720000, valor_aluguel_mensal: 3800, lat: -26.9201, lng: -49.0641, contrato_ativo: contrato(["Clínica Vida Plena"], 3800, "2023-07-10") }),
  mk({ familia_id: "rebello", endereco: "Rua Sete de Setembro, 1240 — sala 601", bairro: "Centro", cidade: "Blumenau", estado: "SC", classificacao: "Comercial", tipo: "Sala Comercial", area_m2: 78, status: "Locado", valor_compra: 580000, valor_mercado: 980000, valor_aluguel_mensal: 5200, lat: -26.9201, lng: -49.0641, contrato_ativo: contrato(["Tech Sul Sistemas"], 5200, "2022-02-01") }),
  mk({ familia_id: "rebello", endereco: "Rua Hermann Hering, 480 — apto 305", bairro: "Bom Retiro", cidade: "Blumenau", estado: "SC", tipo: "Apartamento", area_m2: 96, status: "Locado", valor_compra: 520000, valor_mercado: 880000, valor_aluguel_mensal: 4100, lat: -26.9007, lng: -49.0721, contrato_ativo: contrato(["Augusto Lemke"], 4100, "2024-08-01") }),
  mk({ familia_id: "rebello", endereco: "Rua Hermann Hering, 480 — apto 402", bairro: "Bom Retiro", cidade: "Blumenau", estado: "SC", tipo: "Apartamento", area_m2: 96, status: "Vago", valor_compra: 520000, valor_mercado: 880000, valor_aluguel_mensal: 0, lat: -26.9007, lng: -49.0721 }),
  mk({ familia_id: "rebello", endereco: "Av. Atlântica, 3402 — cobertura 2401", bairro: "Centro", cidade: "Balneário Camboriú", estado: "SC", tipo: "Cobertura", area_m2: 320, status: "Locado", valor_compra: 2400000, valor_mercado: 4800000, valor_aluguel_mensal: 18500, lat: -26.9907, lng: -48.6354, contrato_ativo: contrato(["Família Steiner (temporada)"], 18500, "2024-11-01") }),
  mk({ familia_id: "rebello", endereco: "Av. Atlântica, 3402 — apto 1501", bairro: "Centro", cidade: "Balneário Camboriú", estado: "SC", tipo: "Apartamento", area_m2: 168, status: "Locado", valor_compra: 1280000, valor_mercado: 2380000, valor_aluguel_mensal: 9800, lat: -26.9907, lng: -48.6354, contrato_ativo: contrato(["Investimentos BC Ltda."], 9800, "2023-12-01") }),
  mk({ familia_id: "rebello", endereco: "Rua 1500, 880 — casa", bairro: "Centro", cidade: "Balneário Camboriú", estado: "SC", classificacao: "Residencial", tipo: "Casa", area_m2: 280, status: "Carencia", valor_compra: 1650000, valor_mercado: 2950000, valor_aluguel_mensal: 11500, lat: -26.9921, lng: -48.6398, contrato_ativo: contrato(["Roberto Albuquerque"], 11500, "2026-04-01") }),

  // Gutierrez — 8 imóveis
  mk({ familia_id: "gutierrez", endereco: "Av. Beira-Mar Norte, 4202 — apto 1801", bairro: "Agronômica", cidade: "Florianópolis", estado: "SC", tipo: "Apartamento", area_m2: 156, status: "Locado", valor_compra: 1180000, valor_mercado: 2280000, valor_aluguel_mensal: 8800, lat: -27.5805, lng: -48.5446, contrato_ativo: contrato(["Cláudia Marçal"], 8800, "2023-10-01") }),
  mk({ familia_id: "gutierrez", endereco: "Rua Bocaiúva, 2240 — apto 702", bairro: "Centro", cidade: "Florianópolis", estado: "SC", tipo: "Apartamento", area_m2: 102, status: "Locado", valor_compra: 720000, valor_mercado: 1280000, valor_aluguel_mensal: 5400, lat: -27.5912, lng: -48.5505, contrato_ativo: contrato(["Eduardo Pizarro"], 5400, "2024-06-15") }),
  mk({ familia_id: "gutierrez", endereco: "Rua Bocaiúva, 2240 — apto 703", bairro: "Centro", cidade: "Florianópolis", estado: "SC", tipo: "Apartamento", area_m2: 102, status: "Vago", valor_compra: 720000, valor_mercado: 1280000, valor_aluguel_mensal: 0, lat: -27.5912, lng: -48.5505 }),
  mk({ familia_id: "gutierrez", endereco: "Rod. Jornalista Manoel de Menezes, s/n — apto 1102", bairro: "Praia Brava", cidade: "Florianópolis", estado: "SC", tipo: "Apartamento", area_m2: 138, status: "Locado", valor_compra: 1480000, valor_mercado: 2680000, valor_aluguel_mensal: 9200, lat: -27.4054, lng: -48.4109, contrato_ativo: contrato(["Família Negrão"], 9200, "2024-01-20") }),
  mk({ familia_id: "gutierrez", endereco: "Rua Goethe, 320 — apto 901", bairro: "Rio Branco", cidade: "Porto Alegre", estado: "RS", tipo: "Apartamento", area_m2: 110, status: "Locado", valor_compra: 640000, valor_mercado: 1180000, valor_aluguel_mensal: 4900, lat: -30.0289, lng: -51.2089, contrato_ativo: contrato(["Camila Forster"], 4900, "2023-03-10") }),
  mk({ familia_id: "gutierrez", endereco: "Rua Goethe, 320 — apto 902", bairro: "Rio Branco", cidade: "Porto Alegre", estado: "RS", tipo: "Apartamento", area_m2: 110, status: "Carencia", valor_compra: 640000, valor_mercado: 1180000, valor_aluguel_mensal: 4900, lat: -30.0289, lng: -51.2089, contrato_ativo: contrato(["Família Veloso"], 4900, "2026-04-05") }),
  mk({ familia_id: "gutierrez", endereco: "Rua Tobias da Silva, 99 — apto 401", bairro: "Moinhos de Vento", cidade: "Porto Alegre", estado: "RS", tipo: "Apartamento", area_m2: 76, status: "Vago", valor_compra: 460000, valor_mercado: 820000, valor_aluguel_mensal: 0, lat: -30.0254, lng: -51.2009 }),
  mk({ familia_id: "gutierrez", endereco: "Rua Tobias da Silva, 99 — sala comercial 1", bairro: "Moinhos de Vento", cidade: "Porto Alegre", estado: "RS", classificacao: "Comercial", tipo: "Sala Comercial", area_m2: 58, status: "Locado", valor_compra: 380000, valor_mercado: 680000, valor_aluguel_mensal: 3400, lat: -30.0254, lng: -51.2009, contrato_ativo: contrato(["Studio Arquitetura M3"], 3400, "2022-12-01") }),
];

// Helpers
export const imoveisPorFamilia = (familiaId: string) =>
  imoveis.filter((i) => i.familia_id === familiaId);

export const kpisFamilia = (familiaId: string) => {
  const list = imoveisPorFamilia(familiaId);
  const valor_mercado = list.reduce((s, i) => s + i.valor_mercado, 0);
  const valor_compra = list.reduce((s, i) => s + i.valor_compra, 0);
  const receita_mensal = list.reduce((s, i) => s + (i.status === "Locado" ? i.valor_aluguel_mensal : 0), 0);
  const valorizacao = valor_compra > 0 ? ((valor_mercado - valor_compra) / valor_compra) * 100 : 0;
  return {
    total: list.length,
    valor_mercado,
    valor_compra,
    receita_mensal,
    valorizacao,
    locados: list.filter((i) => i.status === "Locado").length,
    vagos: list.filter((i) => i.status === "Vago").length,
    carencia: list.filter((i) => i.status === "Carencia").length,
    inativos: list.filter((i) => ["Inativo", "Vendido", "Doado"].includes(i.status)).length,
  };
};

export const kpisGlobais = () => {
  const total_familias = familias.length;
  const total_imoveis = imoveis.length;
  const valor_mercado = imoveis.reduce((s, i) => s + i.valor_mercado, 0);
  const receita_mensal = imoveis.reduce((s, i) => s + (i.status === "Locado" ? i.valor_aluguel_mensal : 0), 0);
  return { total_familias, total_imoveis, valor_mercado, receita_mensal };
};
