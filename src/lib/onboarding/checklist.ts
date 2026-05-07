export interface ChecklistItem {
  key: string;
  label: string;
  optional?: boolean;
}

export interface ChecklistCategoria {
  key: string;
  titulo: string;
  itens: ChecklistItem[];
}

export const CHECKLIST_FAMILIA: ChecklistCategoria[] = [
  {
    key: "familia",
    titulo: "Documentos da família",
    itens: [
      { key: "ir_3", label: "Declaração IR (últimas 3)" },
      { key: "doc_id", label: "RG / CPF / CNH / Passaporte" },
      { key: "comp_residencia", label: "Comprovante de residência" },
      { key: "cert_casamento", label: "Certidão de casamento" },
      { key: "cert_nascimento", label: "Certidões de nascimento (filhos e casal)" },
    ],
  },
  {
    key: "societario",
    titulo: "Participações societárias",
    itens: [
      { key: "contrato_social", label: "Contrato ou estatuto social (constitutivo + alterações)" },
      { key: "atas", label: "Atas de assembleias", optional: true },
      { key: "balanco", label: "Balanço patrimonial (último)" },
      { key: "dre", label: "DRE (última)" },
      { key: "offshore", label: "Documentos societários offshore" },
    ],
  },
  {
    key: "outros_bens",
    titulo: "Outros bens — veículos",
    itens: [
      { key: "doc_veiculo", label: "Cópia do documento" },
      { key: "seguro_veiculo", label: "Apólice de seguro" },
    ],
  },
];

export const CHECKLIST_IMOVEL: ChecklistItem[] = [
  { key: "escritura", label: "Escritura" },
  { key: "instrumento_particular", label: "Instrumento particular", optional: true },
  { key: "matricula", label: "Matrícula" },
  { key: "inventario", label: "Inventário / partilha", optional: true },
  { key: "iptu_itr", label: "Carnê IPTU (urbano) ou ITR (rural)" },
  { key: "seguro", label: "Apólice de seguro", optional: true },
  { key: "balanco_pj", label: "Balanço da PJ ou valor contábil (se em PJ)", optional: true },
];

export const CHECKLIST_IMOVEL_LOCACAO: ChecklistItem[] = [
  { key: "contrato_locacao", label: "Contrato de locação" },
  { key: "demonstrativo_imobiliaria", label: "Último demonstrativo da imobiliária" },
  { key: "contato_imobiliaria", label: "Contato da imobiliária" },
];
