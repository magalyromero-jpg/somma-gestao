export interface ChecklistOutrosBensItem {
  item_id: string;
  label: string;
  opcional: boolean;
}

export const CHECKLIST_VEICULO: ChecklistOutrosBensItem[] = [
  { item_id: "crlv",   label: "Cópia do documento do veículo (CRLV)", opcional: false },
  { item_id: "seguro", label: "Cópia da apólice de seguro",            opcional: false },
];
