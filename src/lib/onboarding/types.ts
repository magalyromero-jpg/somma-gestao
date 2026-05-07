export type Papel =
  | "titular"
  | "conjuge"
  | "filho"
  | "dependente"
  | "socio_familiar"
  | "socio_externo";

export interface Membro {
  id: string;
  nome: string;
  cpf: string | null;
  papel: Papel;
  data_nascimento: string | null;
  email: string | null;
  ocupacao: string | null;
  is_assinante: boolean;
  fonte: string;
}

export interface HoldingSocio {
  membro_id: string;
  percentual: number | null;
  num_quotas: number | null;
  valor_quota: number | null;
}

export interface Holding {
  id: string;
  razao_social: string;
  cnpj: string | null;
  tipo: "patrimonial" | "operacional" | "rural" | "holding_pura" | "nova" | "outra";
  regime_tributario: string | null;
  socios: HoldingSocio[];
  dividendos_distribuidos: number | null;
  ano_constituicao: number | null;
  observacoes: string | null;
  fonte: string;
}

export interface Imovel {
  id: string;
  descricao: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  area_m2: number | null;
  valor_declarado: number | null;
  data_aquisicao: string | null;
  matricula: string | null;
  cartorio: string | null;
  inscricao_municipal: string | null;
  titularidade: "PF" | "PJ";
  titular_id: string;
  holding_id: string | null;
  forma_aquisicao: "compra" | "permuta" | "integralizacao" | "heranca" | "doacao" | "outra" | null;
  locacao: boolean;
  alienado?: boolean;
  situacao_ano_anterior: number | null;
  situacao_ano_atual: number | null;
  benfeitorias?: Array<{ descricao: string; valor: number | null; ano: number | null }>;
  alertas: string[];
  fonte: string;
}

export interface Veiculo {
  id?: string;
  descricao: string;
  placa: string | null;
  renavam?: string | null;
  ano: string | null;
  valor_declarado: number | null;
  titular_id: string;
  alienado?: boolean;
  fonte: string;
}

export interface PatrimonialData {
  familia: { nome: string; sede: string | null; perfil: string | null; email_familia?: string | null; fonte: string };
  membros: Membro[];
  holdings: Holding[];
  imoveis: Imovel[];
  veiculos?: Veiculo[];
  investimentos?: {
    renda_fixa: number | null;
    previdencia_privada: number | null;
    fundos: number | null;
    exterior: number | null;
    criptoativos: number | null;
    outros: number | null;
    total: number | null;
    alertas: string[];
    fonte: string;
  };
  dividas?: Array<{
    descricao: string;
    credor: string | null;
    valor_ano_anterior: number | null;
    valor_ano_atual: number | null;
    titular_id: string;
    fonte: string;
  }>;
  rendimentos?: {
    tributaveis_pj: number | null;
    isentos_dividendos: number | null;
    isentos_outros: number | null;
    exclusivos_definitivos: number | null;
    fonte: string;
  };
  checklist_documentos?: Record<string, string | string[]>;
  alertas_gerais?: Array<{ nivel: "critico" | "atencao" | "informativo"; mensagem: string; relacionado_a: string | null }>;
  patrimonio_liquido?: {
    bens_ano_anterior: number | null;
    bens_ano_atual: number | null;
    dividas_ano_anterior: number | null;
    dividas_ano_atual: number | null;
    liquido_ano_atual: number | null;
  };
  meta: {
    documentos_analisados: string[];
    ano_calendario?: number | null;
    data_extracao: string;
    confianca: "alta" | "media" | "baixa";
    observacoes_gerais: string | null;
  };
}

export const LOADING_STEPS = [
  "Identificando membros da família...",
  "Mapeando participações societárias...",
  "Extraindo imóveis e valores...",
  "Verificando ônus e alertas...",
  "Montando o mapa patrimonial...",
];

export function emailDaFamilia(nome: string): string {
  const sobrenome = nome.trim().split(/\s+/).pop() || nome;
  const slug = sobrenome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return `familia.${slug}@sommainvestimentos.com.br`;
}
