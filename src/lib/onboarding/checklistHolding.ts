export interface ChecklistHoldingItem {
  item_id: string;
  label: string;
  opcional: boolean;
}

export const CHECKLIST_HOLDING: ChecklistHoldingItem[] = [
  { item_id: "contrato_social", label: "Contrato ou Estatuto Social (instrumento constitutivo + todas as alterações)", opcional: false },
  { item_id: "atas",            label: "Atas de assembleias",                                                          opcional: true  },
  { item_id: "balanco",         label: "Balanço Patrimonial (último)",                                                 opcional: false },
  { item_id: "dre",             label: "DRE (última)",                                                                 opcional: false },
  { item_id: "offshore",        label: "Documentos societários offshore",                                              opcional: true  },
];
