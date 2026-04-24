export type Finalidade = "venda" | "locacao";

export interface MarketSearchParams {
  uf: string;
  cidade: string;
  bairro: string;
  enderecoAlvo: string;
  tipologias: string[];
  m2Min: number;
  m2Max: number;
  margem: number;
  portais: string[];
  finalidade: Finalidade;
  raio: number;
}

export interface MarketListing {
  id: string;
  titulo: string;
  endereco: string;
  m2: number;
  dorms: number;
  vagas: number;
  preco: number;
  precoM2: number;
  portal: string;
  tipologia: string;
  lat?: number;
  lng?: number;
}

export interface MarketSearchResult {
  id: string;
  params: MarketSearchParams;
  metricas: {
    media: number;
    mediana: number;
    minimo: { valor: number; m2: number; tipologia: string };
    maximo: { valor: number; m2: number; tipologia: string };
    total: number;
    desvioPadrao: number;
  };
  tipologias: { tipo: string; count: number; pct: number }[];
  portais: { portal: string; count: number }[];
  listings: MarketListing[];
  conclusoes: {
    posicionamento: string;
    ofertaDemanda: string;
    tipologiaDominante: string;
    competitividade: string;
    estimativaAtivo: number;
  };
}

export const UFS = ["SP", "RJ", "MG", "SC", "RS", "PR", "BA", "DF"];
export const TIPOLOGIAS = ["Studio", "1 dorm", "2 dorm", "3 dorm", "4+ dorm", "Cobertura", "Garden", "Duplex"];
export const PORTAIS = ["Viva Real", "ZAP Imóveis", "ImovelWeb", "Chaves na Mão", "OLX", "QuintoAndar", "MercadoLivre"];
export const MARGENS = [0, 10, 15, 20, 30];
export const RAIOS = [
  { value: 250, label: "250m" },
  { value: 500, label: "500m" },
  { value: 1000, label: "1km" },
  { value: 2000, label: "2km" },
];

export const mockSearchResult: MarketSearchResult = {
  id: "search-001",
  params: {
    uf: "SP",
    cidade: "São Paulo",
    bairro: "Itaim Bibi",
    enderecoAlvo: "R. Bandeira Paulista, 530",
    tipologias: ["2 dorm", "3 dorm"],
    m2Min: 60,
    m2Max: 120,
    margem: 10,
    portais: ["Viva Real", "ZAP Imóveis", "ImovelWeb", "OLX"],
    finalidade: "venda",
    raio: 500,
  },
  metricas: {
    media: 14200,
    mediana: 13850,
    minimo: { valor: 9400, m2: 72, tipologia: "2 dorm" },
    maximo: { valor: 21600, m2: 110, tipologia: "3 dorm" },
    total: 32,
    desvioPadrao: 2800,
  },
  tipologias: [
    { tipo: "2 dorm", count: 23, pct: 72 },
    { tipo: "3 dorm", count: 16, pct: 50 },
    { tipo: "1 dorm", count: 9, pct: 28 },
    { tipo: "Studio", count: 4, pct: 12 },
    { tipo: "4+ dorm", count: 3, pct: 9 },
  ],
  portais: [
    { portal: "Viva Real", count: 12 },
    { portal: "ZAP Imóveis", count: 10 },
    { portal: "ImovelWeb", count: 6 },
    { portal: "OLX", count: 4 },
  ],
  listings: [
    { id: "l1", titulo: "Apto 3 dorm · Ed. Parque Itaim", endereco: "R. Bandeira Paulista", m2: 110, dorms: 3, vagas: 2, preco: 2380000, precoM2: 21600, portal: "Viva Real", tipologia: "3 dorm" },
    { id: "l2", titulo: "Apto 2 dorm · R. Pedroso Alvarenga", endereco: "R. Pedroso Alvarenga, 480", m2: 78, dorms: 2, vagas: 1, preco: 1050000, precoM2: 13460, portal: "ZAP Imóveis", tipologia: "2 dorm" },
    { id: "l3", titulo: "Apto 2 dorm · Vila Olímpia", endereco: "Vila Olímpia, próx. Metrô", m2: 68, dorms: 2, vagas: 1, preco: 638000, precoM2: 9380, portal: "ImovelWeb", tipologia: "2 dorm" },
    { id: "l4", titulo: "Apto 3 dorm reformado", endereco: "Av. Hélio Pellegrino, 200", m2: 95, dorms: 3, vagas: 2, preco: 1520000, precoM2: 16000, portal: "OLX", tipologia: "3 dorm" },
  ],
  conclusoes: {
    posicionamento: "Unidade-alvo de 90m² estimada em R$ 1.246.500 pela mediana regional. Quartil inferior com potencial de valorização de 8–15% reformada.",
    ofertaDemanda: "32 anúncios ativos em raio de 500m. Desvio padrão de R$ 2.800/m² indica mercado maduro e precificação consistente.",
    tipologiaDominante: "2 dormitórios = 72% da oferta. Maior liquidez histórica. 3 dorms com ticket 38% superior e menor giro.",
    competitividade: "Densidade de 6,4 anúncios/100m de rua — acima da média SP (4,1). Mercado com oferta diversificada.",
    estimativaAtivo: 1246500,
  },
};
