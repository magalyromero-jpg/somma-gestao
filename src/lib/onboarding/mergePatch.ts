import type { PatrimonialData } from "./types";

export interface ArrayOp {
  action: "add" | "update" | "remove";
  id: string;
  data?: Record<string, any>;
}

export interface PatrimonialPatch {
  familia?: Partial<PatrimonialData["familia"]>;
  membros?: ArrayOp[];
  holdings?: ArrayOp[];
  imoveis?: ArrayOp[];
  veiculos?: ArrayOp[];
  dividas?: ArrayOp[];
  alertas_gerais?: ArrayOp[];
  investimentos?: Partial<NonNullable<PatrimonialData["investimentos"]>>;
  rendimentos?: Partial<NonNullable<PatrimonialData["rendimentos"]>>;
  checklist_documentos?: Record<string, any>;
  patrimonio_liquido?: Partial<NonNullable<PatrimonialData["patrimonio_liquido"]>>;
  meta?: Partial<PatrimonialData["meta"]> & { documentos_analisados?: string[] };
}

const ARRAY_FIELDS = ["membros", "imoveis", "holdings", "veiculos", "dividas", "alertas_gerais"] as const;
const OBJECT_FIELDS = ["familia", "investimentos", "rendimentos", "checklist_documentos", "patrimonio_liquido"] as const;

export function mergePatrimonialPatch(current: PatrimonialData, patch: PatrimonialPatch): PatrimonialData {
  const updated: any = { ...current };

  for (const field of ARRAY_FIELDS) {
    const ops = (patch as any)[field] as ArrayOp[] | undefined;
    if (!ops?.length) continue;
    let arr: any[] = Array.isArray(updated[field]) ? [...updated[field]] : [];
    for (const op of ops) {
      if (op.action === "add") {
        arr = [...arr, { id: op.id, ...(op.data ?? {}) }];
      } else if (op.action === "update") {
        arr = arr.map((item) => (item.id === op.id ? { ...item, ...(op.data ?? {}) } : item));
      } else if (op.action === "remove") {
        arr = arr.filter((item) => item.id !== op.id);
      }
    }
    updated[field] = arr;
  }

  for (const field of OBJECT_FIELDS) {
    const value = (patch as any)[field];
    if (value && typeof value === "object") {
      updated[field] = { ...(updated[field] ?? {}), ...value };
    }
  }

  if (patch.meta) {
    const docsExisting = new Set<string>(updated.meta?.documentos_analisados ?? []);
    if (Array.isArray(patch.meta.documentos_analisados)) {
      for (const d of patch.meta.documentos_analisados) docsExisting.add(d);
    }
    updated.meta = {
      ...(updated.meta ?? {}),
      ...patch.meta,
      documentos_analisados: Array.from(docsExisting),
    };
  }

  return updated as PatrimonialData;
}
