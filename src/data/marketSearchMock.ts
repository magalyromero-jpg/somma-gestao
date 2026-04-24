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
  url?: string;
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

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

// Principais cidades por UF (lista predefinida; pesquisa livre via combobox)
export const CIDADES_POR_UF: Record<string, string[]> = {
  AC: ["Rio Branco", "Cruzeiro do Sul"],
  AL: ["Maceió", "Arapiraca"],
  AP: ["Macapá", "Santana"],
  AM: ["Manaus", "Parintins"],
  BA: ["Salvador", "Feira de Santana", "Vitória da Conquista", "Camaçari", "Ilhéus", "Porto Seguro"],
  CE: ["Fortaleza", "Caucaia", "Juazeiro do Norte", "Sobral"],
  DF: ["Brasília", "Taguatinga", "Ceilândia", "Águas Claras"],
  ES: ["Vitória", "Vila Velha", "Serra", "Cariacica", "Guarapari"],
  GO: ["Goiânia", "Aparecida de Goiânia", "Anápolis", "Caldas Novas"],
  MA: ["São Luís", "Imperatriz"],
  MT: ["Cuiabá", "Várzea Grande", "Rondonópolis"],
  MS: ["Campo Grande", "Dourados", "Três Lagoas"],
  MG: ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim", "Nova Lima", "Uberaba", "Montes Claros"],
  PA: ["Belém", "Ananindeua", "Santarém"],
  PB: ["João Pessoa", "Campina Grande"],
  PR: ["Curitiba", "Londrina", "Maringá", "Ponta Grossa", "Cascavel", "Foz do Iguaçu"],
  PE: ["Recife", "Olinda", "Jaboatão dos Guararapes", "Caruaru", "Petrolina"],
  PI: ["Teresina", "Parnaíba"],
  RJ: ["Rio de Janeiro", "Niterói", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu", "Petrópolis", "Cabo Frio", "Búzios"],
  RN: ["Natal", "Mossoró", "Parnamirim"],
  RS: ["Porto Alegre", "Caxias do Sul", "Canoas", "Pelotas", "Gravataí", "Novo Hamburgo"],
  RO: ["Porto Velho", "Ji-Paraná"],
  RR: ["Boa Vista"],
  SC: ["Florianópolis", "Joinville", "Blumenau", "Balneário Camboriú", "Itajaí", "Chapecó", "Criciúma"],
  SP: ["São Paulo", "Campinas", "Santos", "São José dos Campos", "Ribeirão Preto", "Sorocaba", "Guarulhos", "Santo André", "São Bernardo do Campo", "Osasco", "São Caetano do Sul", "Jundiaí", "Bauru", "Piracicaba"],
  SE: ["Aracaju", "Nossa Senhora do Socorro"],
  TO: ["Palmas", "Araguaína"],
};

// Bairros principais por cidade (subset curado das maiores capitais; pesquisa livre)
export const BAIRROS_POR_CIDADE: Record<string, string[]> = {
  "São Paulo": ["Itaim Bibi", "Vila Olímpia", "Pinheiros", "Vila Madalena", "Jardins", "Jardim Paulista", "Moema", "Brooklin", "Campo Belo", "Vila Nova Conceição", "Higienópolis", "Perdizes", "Vila Mariana", "Morumbi", "Tatuapé", "Mooca", "Santana", "Lapa", "Bela Vista", "Consolação", "Liberdade", "Itaquera", "Santo Amaro"],
  "Rio de Janeiro": ["Ipanema", "Leblon", "Copacabana", "Botafogo", "Flamengo", "Barra da Tijuca", "Recreio dos Bandeirantes", "Tijuca", "Jardim Botânico", "Lagoa", "Gávea", "Laranjeiras", "Humaitá", "Urca", "Vila Isabel", "Méier"],
  "Belo Horizonte": ["Savassi", "Lourdes", "Funcionários", "Belvedere", "Buritis", "Sion", "Cidade Jardim", "Anchieta", "Santo Agostinho", "Pampulha", "Castelo", "Serra"],
  "Curitiba": ["Batel", "Água Verde", "Bigorrilho", "Centro", "Cabral", "Mercês", "Ahú", "Juvevê", "Ecoville", "Champagnat"],
  "Porto Alegre": ["Moinhos de Vento", "Bela Vista", "Petrópolis", "Mont Serrat", "Auxiliadora", "Higienópolis", "Menino Deus", "Cidade Baixa", "Centro Histórico", "Tristeza"],
  "Florianópolis": ["Centro", "Trindade", "Córrego Grande", "Lagoa da Conceição", "Jurerê Internacional", "Canasvieiras", "Ingleses", "Campeche", "Itacorubi", "Santa Mônica"],
  "Brasília": ["Asa Sul", "Asa Norte", "Lago Sul", "Lago Norte", "Sudoeste", "Noroeste", "Águas Claras", "Park Sul"],
  "Salvador": ["Barra", "Ondina", "Pituba", "Itaigara", "Caminho das Árvores", "Graça", "Vitória", "Horto Florestal", "Rio Vermelho", "Stiep"],
  "Fortaleza": ["Meireles", "Aldeota", "Mucuripe", "Cocó", "Varjota", "Praia de Iracema", "Edson Queiroz", "Guararapes"],
  "Recife": ["Boa Viagem", "Pina", "Casa Forte", "Espinheiro", "Graças", "Aflitos", "Madalena", "Parnamirim"],
  "Campinas": ["Cambuí", "Nova Campinas", "Castelo", "Taquaral", "Mansões Santo Antônio", "Jardim Guanabara", "Barão Geraldo"],
  "Santos": ["Gonzaga", "Boqueirão", "Pompeia", "Aparecida", "Embaré", "José Menino", "Ponta da Praia"],
  "Balneário Camboriú": ["Centro", "Barra Sul", "Barra Norte", "Pioneiros", "Nova Esperança"],
  "Goiânia": ["Setor Bueno", "Setor Marista", "Setor Oeste", "Jardim Goiás", "Setor Sul", "Alto da Glória"],
};
export const TIPOLOGIAS_RESIDENCIAL = [
  "Studio", "1 dorm", "2 dorm", "3 dorm", "4+ dorm",
  "Cobertura", "Garden", "Duplex", "Casa", "Sobrado",
];
export const TIPOLOGIAS_COMERCIAL = [
  "Sala comercial", "Loja", "Andar corporativo", "Galpão", "Pavilhão",
];
export const TIPOLOGIAS_TERRENO = [
  "Terreno", "Lote em condomínio", "Área industrial",
];
export const TIPOLOGIAS = [
  ...TIPOLOGIAS_RESIDENCIAL,
  ...TIPOLOGIAS_COMERCIAL,
  ...TIPOLOGIAS_TERRENO,
];
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
