export const IMOVEL = {
  nome: "Agência Banco do Brasil — Lote 14",
  endereco: "Rua Felipe Schmidt, 132 — Centro, São Bento do Sul SC",
  leilao: "Leilão Público nº 2026/260004V(9055)",
  lanceMinimoMil: 6449.855,
  investimentoTotalMil: 6820,
  areaConst: 1644,
  areaLote: 1617,
  testada: 24,
  tipo: "Prédio Comercial — Sala/Loja",
  estrutura: "Alvenaria",
  estadoConservacao: "Ótimo",
  matricula: "32.457 — CRI São Bento do Sul SC",
  locatario: "Banco do Brasil S.A.",
  prazoLocacaoMeses: 60,
  aluguelMensalInicial: 41924,
  capRateNominal: 7.8,
  descontoMercadoPct: 27.5,
  valorMercadoMinMil: 7500,
  valorMercadoMaxMil: 9000,
};

export const CDI_CURVA = [14.65, 13.0, 11.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0];
export const IPCA_CURVA = [4.89, 4.89, 4.0, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6];
export const IR_RENDA_FIXA = 0.15;
export const NTNB_SPREAD = 6.0;

export const RISCOS = [
  {
    titulo: "Reajuste não solicitado pelo BB",
    severidade: "Alto" as const,
    descricao:
      "Cláusula do edital: reajuste depende de prévia manifestação formal do locador. Se o BB não pedir, caduca e não retroage. Historicamente frequente em contratos com entes estatais.",
  },
  {
    titulo: "Rescisão antecipada pelo BB",
    severidade: "Alto" as const,
    descricao:
      "BB pode encerrar com aviso de 30 dias em múltiplos cenários (imóvel próprio, inadequação, decisão negocial) sem multa para o locatário. Risco de vacância repentina.",
  },
  {
    titulo: "Restrição de 10 anos pós-locação",
    severidade: "Alto" as const,
    descricao:
      "Após o término, não é possível vender, alugar ou ceder o imóvel a qualquer instituição do Sistema Financeiro Nacional por 10 anos. Restringe fortemente o universo de compradores.",
  },
  {
    titulo: "Aluguel abaixo do mercado no longo prazo",
    severidade: "Médio" as const,
    descricao:
      "R$41.924/mês = ~R$25,50/m². Comercial em centros de SC chega a R$35–55/m². Sem revisão real, o aluguel se distancia do mercado.",
  },
  {
    titulo: "Tributação na fonte pelo BB",
    severidade: "Médio" as const,
    descricao:
      "BB retém PIS, COFINS, CSLL e IR na fonte. Para PF: retenção de IR 27,5% sobre valores acima de ~R$4.664/mês. Valor líquido é inferior ao nominal.",
  },
  {
    titulo: "Liquidez reduzida do ativo",
    severidade: "Médio" as const,
    descricao:
      "Imóvel de 1.644m² em cidade média. Universo de compradores limitado. Dificuldade de venda parcial ou fracionamento.",
  },
  {
    titulo: "Inadimplência do locatário",
    severidade: "Baixo" as const,
    descricao:
      "Banco do Brasil S.A. — empresa pública federal, investment grade. Risco de crédito praticamente nulo.",
  },
  {
    titulo: "Documentação / regularidade",
    severidade: "Baixo" as const,
    descricao:
      "Matrícula 32.457 limpa — penhoramentos cancelados judicialmente em 2010 e 2014. Sem pendências estruturais no edital.",
  },
];

export const PREMISSAS = [
  { p: "CDI atual", v: "14,65% a.a.", f: "BCB — mai/2026" },
  { p: "CDI projetado 2026", v: "13,00% a.a.", f: "Boletim Focus" },
  { p: "CDI projetado 2027", v: "11,00% a.a.", f: "Boletim Focus" },
  { p: "CDI projetado 2028+", v: "10,00% a.a.", f: "Boletim Focus" },
  { p: "IPCA projetado 2026", v: "4,89% a.a.", f: "Boletim Focus" },
  { p: "IPCA projetado 2027", v: "4,00% a.a.", f: "Boletim Focus" },
  { p: "IPCA projetado 2028+", v: "~3,60% a.a.", f: "Boletim Focus" },
  { p: "Valorização imóvel", v: "Estimada", f: "Sem benchmark" },
  { p: "Reajuste aluguel", v: "Estimado ⚠", f: "Risco BB" },
];
