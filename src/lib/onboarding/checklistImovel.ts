import { supabase } from "@/integrations/supabase/client";
import type { Imovel } from "./types";

export interface ChecklistImovelItem {
  item_id: string;
  label: string;
  opcional: boolean;
  condicional?: "titularidade === 'PJ'";
}

export const CHECKLIST_ITEMS_BASE: ChecklistImovelItem[] = [
  { item_id: "escritura",   label: "Escritura",                                  opcional: false },
  { item_id: "instrumento", label: "Instrumento particular",                     opcional: true  },
  { item_id: "matricula",   label: "Matrícula",                                  opcional: false },
  { item_id: "inventario",  label: "Inventário / partilha",                      opcional: true  },
  { item_id: "iptu_itr",    label: "Carnê de IPTU (urbano) ou ITR (rural)",      opcional: false },
  { item_id: "seguro",      label: "Apólice de seguro",                          opcional: true  },
  { item_id: "balanco_pj",  label: "Balanço da empresa ou valor contábil (PJ)",  opcional: true,
    condicional: "titularidade === 'PJ'" },
  // CNDs / certidões — universais
  { item_id: "cnd_condominio", label: "CND Condomínio",            opcional: true },
  { item_id: "cnd_iptu",       label: "CND IPTU",                  opcional: true },
  { item_id: "cnd_energia",    label: "CND Energia Elétrica",      opcional: true },
  { item_id: "certidao_onus",  label: "Certidão de Ônus",          opcional: true },
  { item_id: "matricula_atual", label: "Matrícula atualizada",     opcional: true },
];

export const CHECKLIST_ITEMS_LOCACAO: ChecklistImovelItem[] = [
  { item_id: "contrato_admin_imob", label: "Contrato de administração da imobiliária", opcional: false },
  { item_id: "contrato_locacao",    label: "Contrato de locação vigente",              opcional: false },
  { item_id: "demonstrativo_imob",  label: "Último demonstrativo mensal da imobiliária", opcional: false },
  { item_id: "contato_imob",        label: "Contato da imobiliária",                   opcional: false },
];

export function itensParaImovel(imovel: Pick<Imovel, "titularidade" | "locacao">): ChecklistImovelItem[] {
  return [
    ...CHECKLIST_ITEMS_BASE.filter(
      (it) => !it.condicional || (it.condicional === "titularidade === 'PJ'" && imovel.titularidade === "PJ"),
    ),
    ...(imovel.locacao ? CHECKLIST_ITEMS_LOCACAO : []),
  ];
}

function enderecoCompleto(im: Imovel): string {
  return [im.logradouro, im.numero, im.complemento, im.bairro, im.municipio, im.uf]
    .filter(Boolean)
    .join(", ");
}

export async function criarChecklistsImoveis(familiaId: string, imoveis: Imovel[]) {
  for (const imovel of imoveis) {
    const { data: im, error } = await supabase
      .from("imoveis_cliente")
      .upsert(
        {
          familia_id: familiaId,
          ref_id: imovel.id,
          nome: imovel.descricao,
          endereco: enderecoCompleto(imovel),
          valor_declarado: imovel.valor_declarado,
          matricula: imovel.matricula,
          titularidade: imovel.holding_id ? "PJ" : (imovel.titularidade ?? "PF"),
          holding_cnpj: imovel.holding_id,
          locacao: imovel.locacao ?? false,
          alertas: (imovel.alertas ?? []) as any,
          origem: "ir",
        },
        { onConflict: "familia_id,ref_id" },
      )
      .select()
      .single();

    if (error || !im) continue;

    const itens = itensParaImovel(imovel);
    for (const item of itens) {
      await supabase
        .from("checklist_imovel")
        .upsert(
          {
            imovel_id: im.id,
            familia_id: familiaId,
            item_id: item.item_id,
            label: item.label,
            opcional: item.opcional,
            status: "pendente",
          },
          { onConflict: "imovel_id,item_id", ignoreDuplicates: true },
        );
    }
  }
}

export interface ChecklistRow {
  status: "pendente" | "recebido" | "nao_aplicavel";
  opcional: boolean;
}

export function calcularProgresso(itens: ChecklistRow[]) {
  const obrigatorios = itens.filter((it) => !it.opcional && it.status !== "nao_aplicavel");
  const recebidos = obrigatorios.filter((it) => it.status === "recebido");
  return {
    total: obrigatorios.length,
    recebidos: recebidos.length,
    pct: obrigatorios.length > 0 ? Math.round((recebidos.length / obrigatorios.length) * 100) : 0,
  };
}

export function corProgresso(pct: number): "verde" | "laranja" | "vermelho" {
  if (pct === 100) return "verde";
  if (pct > 0) return "laranja";
  return "vermelho";
}
