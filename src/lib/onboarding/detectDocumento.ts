import type { PatrimonialData } from "./types";

export type DocCategoria =
  | "societario"
  | "imovel"
  | "ir"
  | "seguro"
  | "pessoal"
  | "outros";

export interface DocDetectado {
  categoria: DocCategoria;
  itemKey?: string; // chave no checklist
  imovelRef?: string; // imovel_ref para match
  holdingNome?: string; // razão social identificada
  imovelNome?: string; // descrição do imóvel identificada
  rotulo: string; // rótulo amigável (ex: "Contrato social da B&E Bridge")
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function detectarDocumento(
  fileName: string,
  patrimonio: PatrimonialData | null,
): DocDetectado {
  const n = norm(fileName);
  const holdings = patrimonio?.holdings ?? [];
  const imoveis = patrimonio?.imoveis ?? [];

  // SOCIETARIO
  const isContratoSocial =
    n.includes("CONTRATO SOCIAL") ||
    n.includes("ALTERACAO") ||
    n.includes("ESTATUTO") ||
    n.includes("ATA");
  const holdingMatch = holdings.find((h) => {
    const rs = norm(h.razao_social ?? "");
    if (!rs) return false;
    // tenta nome completo e primeiras palavras significativas
    const tokens = rs.split(/\s+/).filter((t) => t.length >= 2 && !["LTDA", "SA", "S/A", "EIRELI", "ME", "EPP"].includes(t));
    return n.includes(rs) || tokens.slice(0, 2).every((t) => n.includes(t));
  });

  if (isContratoSocial || holdingMatch) {
    return {
      categoria: "societario",
      itemKey: n.includes("ATA") ? "atas" : "contrato_social",
      holdingNome: holdingMatch?.razao_social,
      rotulo: holdingMatch
        ? `Contrato social da ${holdingMatch.razao_social} identificado`
        : "Documento societário identificado",
    };
  }

  // IR
  if (n.includes("IRPF") || n.includes("IMPOSTO DE RENDA") || /\bIR\b/.test(n)) {
    return { categoria: "ir", itemKey: "ir_3", rotulo: "Declaração de IR identificada" };
  }

  // PESSOAL
  if (/\b(CNH|RG|CPF|PASSAPORTE)\b/.test(n)) {
    return { categoria: "pessoal", itemKey: "doc_id", rotulo: "Documento pessoal identificado" };
  }

  // IMOVEL — match por descrição/endereço
  function findImovelMatch() {
    return imoveis.find((i) => {
      const desc = norm(i.descricao ?? "");
      const bairro = norm(i.bairro ?? "");
      const mun = norm(i.municipio ?? "");
      const mat = norm(i.matricula ?? "");
      if (mat && n.includes(mat)) return true;
      if (desc) {
        const tokens = desc.split(/\s+/).filter((t) => t.length >= 4);
        if (tokens.length && tokens.slice(0, 2).every((t) => n.includes(t))) return true;
      }
      if (bairro && bairro.length >= 4 && n.includes(bairro)) return true;
      if (mun && mun.length >= 4 && n.includes(mun)) return true;
      return false;
    });
  }

  if (n.includes("MATRICULA")) {
    const im = findImovelMatch();
    return {
      categoria: "imovel",
      itemKey: "matricula",
      imovelRef: im?.id,
      imovelNome: im?.descricao,
      rotulo: im ? `Matrícula de ${im.descricao} identificada` : "Matrícula identificada",
    };
  }
  if (n.includes("IPTU") || n.includes("ITR")) {
    const im = findImovelMatch();
    return {
      categoria: "imovel",
      itemKey: "iptu_itr",
      imovelRef: im?.id,
      imovelNome: im?.descricao,
      rotulo: im ? `IPTU/ITR de ${im.descricao} identificado` : "IPTU/ITR identificado",
    };
  }
  if (n.includes("ESCRITURA")) {
    const im = findImovelMatch();
    return {
      categoria: "imovel",
      itemKey: "escritura",
      imovelRef: im?.id,
      imovelNome: im?.descricao,
      rotulo: im ? `Escritura de ${im.descricao} identificada` : "Escritura identificada",
    };
  }

  // SEGURO
  if (n.includes("SEGURO") || n.includes("APOLICE")) {
    const im = findImovelMatch();
    return {
      categoria: "seguro",
      itemKey: im ? "seguro" : "seguro_veiculo",
      imovelRef: im?.id,
      imovelNome: im?.descricao,
      rotulo: im ? `Apólice do imóvel ${im.descricao} identificada` : "Apólice de seguro identificada",
    };
  }

  return { categoria: "outros", rotulo: "Documento" };
}

export const PROCESSING_STEPS = [
  "Lendo o documento...",
  "Identificando tipo e conteúdo...",
  "Atualizando mapa patrimonial...",
  "Marcando checklist...",
  "Concluído ✓",
];
