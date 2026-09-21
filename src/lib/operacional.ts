import { addDias, fimMes, hojeSP, inicioMes, inicioSemana } from "@/lib/periodo";
import { INICIO_HISTORICO, media } from "@/lib/tarefas";

export const TIPOS_OPERACIONAIS = [
  "Operacional",
  "Analítico",
  "Acompanhamento",
  "Gestão Patrimonial",
  "Planejamento Patrimonial",
  "Gestão de Contas",
] as const;

export const SEM_FAMILIA = "Sem família";
export const SEM_TIPO = "Sem tipo";
export const SEM_RESPONSAVEL = "Sem responsável";
export const AVISO_HISTORICO =
  "Histórico a partir de 01/09/2026. As métricas de fluxo (criadas, encerradas, tempo médio, entrada e saída) contam só de setembro em diante e o histórico vai se acumulando mês a mês. Os números de fila (em andamento, atrasadas, idade das demandas) mostram a situação de hoje.";

export interface TarefaOperacional {
  bitrix_id: number;
  titulo: string | null;
  familia_titulo: string | null;
  status: string;
  prioridade: string | null;
  prazo: string | null;
  criado_em: string | null;
  concluido_em: string | null;
  alterado_em: string | null;
  responsavel_nome: string | null;
  marcadores: string[] | null;
  link_bitrix: string | null;
  synced_at: string;
}

export type FaixaPrazo = "atrasadas" | "hoje" | "esta_semana" | "proxima_semana" | "depois";
export type FaixaIdade = "0-30" | "31-90" | "91-180" | "181-365" | "mais_de_1_ano";
export type NivelDemanda = "Alta" | "Média" | "Baixa" | "Sem movimento";

export const FAIXAS_PRAZO: { key: FaixaPrazo; label: string }[] = [
  { key: "atrasadas", label: "Atrasadas" },
  { key: "hoje", label: "Hoje" },
  { key: "esta_semana", label: "Esta semana" },
  { key: "proxima_semana", label: "Próxima semana" },
  { key: "depois", label: "Depois" },
];

export const FAIXAS_IDADE: { key: FaixaIdade; label: string }[] = [
  { key: "0-30", label: "0–30" },
  { key: "31-90", label: "31–90" },
  { key: "91-180", label: "91–180" },
  { key: "181-365", label: "181–365" },
  { key: "mais_de_1_ano", label: "> 1 ano" },
];

export const ymdSP = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
};

export const familiaDaTarefa = (t: TarefaOperacional) => t.familia_titulo?.trim() || SEM_FAMILIA;
export const responsavelDaTarefa = (t: TarefaOperacional) => t.responsavel_nome?.trim() || SEM_RESPONSAVEL;
export const tipoDaTarefa = (t: TarefaOperacional) =>
  TIPOS_OPERACIONAIS.find((tipo) => (t.marcadores ?? []).includes(tipo)) ?? SEM_TIPO;
export const emAndamento = (t: TarefaOperacional) => t.status === "pending" || t.status === "in_progress";
export const encerrada = (t: TarefaOperacional) => t.status === "completed" && !!t.concluido_em;
export const prioridade = (t: TarefaOperacional) => t.prioridade === "high";

const diasCalendario = (inicio: string, fim: string) => {
  const a = new Date(`${inicio}T12:00:00Z`).getTime();
  const b = new Date(`${fim}T12:00:00Z`).getTime();
  return Math.max(0, Math.floor((b - a) / 86_400_000));
};

export const idadeDias = (t: TarefaOperacional, hoje = hojeSP()) => {
  const criada = ymdSP(t.criado_em);
  return criada ? diasCalendario(criada, hoje) : null;
};

export const tempoAtendimento = (t: TarefaOperacional) => {
  const criada = ymdSP(t.criado_em);
  const concluida = ymdSP(t.concluido_em);
  return criada && concluida && concluida >= criada ? diasCalendario(criada, concluida) : null;
};

export const concluidaNoPrazo = (t: TarefaOperacional) => {
  const concluida = ymdSP(t.concluido_em);
  const prazo = ymdSP(t.prazo);
  return !!concluida && !!prazo && concluida <= prazo;
};

export const faixaPrazo = (t: TarefaOperacional, hoje = hojeSP()): FaixaPrazo | null => {
  if (!emAndamento(t)) return null;
  const prazo = ymdSP(t.prazo);
  if (!prazo) return null;
  if (prazo < hoje) return "atrasadas";
  if (prazo === hoje) return "hoje";
  const domingo = addDias(inicioSemana(hoje), 6);
  if (prazo <= domingo) return "esta_semana";
  const proxDomingo = addDias(domingo, 7);
  if (prazo <= proxDomingo) return "proxima_semana";
  return "depois";
};

export const faixaIdade = (dias: number | null): FaixaIdade => {
  if (dias == null || dias <= 30) return "0-30";
  if (dias <= 90) return "31-90";
  if (dias <= 180) return "91-180";
  if (dias <= 365) return "181-365";
  return "mais_de_1_ano";
};

export const intervaloMes = (mes: string) => ({ inicio: `${mes}-01`, fim: fimMes(`${mes}-01`) });
export const noIntervalo = (iso: string | null, inicio: string, fim: string) => {
  const ymd = ymdSP(iso);
  return !!ymd && ymd >= inicio && ymd <= fim;
};

export const tarefasDoMes = (tarefas: TarefaOperacional[], mes: string) => {
  const { inicio, fim } = intervaloMes(mes);
  const criadas = tarefas.filter((t) => noIntervalo(t.criado_em, inicio, fim) && (ymdSP(t.criado_em) ?? "") >= INICIO_HISTORICO);
  const encerradas = tarefas.filter((t) => encerrada(t) && noIntervalo(t.concluido_em, inicio, fim) && (ymdSP(t.concluido_em) ?? "") >= INICIO_HISTORICO);
  return { criadas, encerradas };
};

export const emAndamentoNoDia = (t: TarefaOperacional, dia: string) => {
  const criada = ymdSP(t.criado_em);
  const concluida = ymdSP(t.concluido_em);
  return !!criada && criada <= dia && (!concluida || concluida > dia);
};

export const serieFilaDiaria = (tarefas: TarefaOperacional[], mes: string) => {
  const { inicio, fim } = intervaloMes(mes);
  const limite = fim < hojeSP() ? fim : hojeSP();
  const serie: { dia: string; valor: number }[] = [];
  for (let dia = inicio; dia <= limite; dia = addDias(dia, 1)) {
    serie.push({ dia, valor: tarefas.filter((t) => !!t.prazo && emAndamentoNoDia(t, dia)).length });
  }
  return serie;
};

export const semanasCompletas = () => {
  const ultimaCompleta = addDias(inicioSemana(hojeSP()), -7);
  const primeiroFim = addDias(inicioSemana(INICIO_HISTORICO), 6);
  const out: { inicio: string; fim: string; label: string }[] = [
    { inicio: INICIO_HISTORICO, fim: primeiroFim, label: `01/09 – ${primeiroFim.slice(8, 10)}/${primeiroFim.slice(5, 7)}` },
  ];
  const primeiraSegunda = addDias(primeiroFim, 1);
  for (let d = primeiraSegunda; d <= ultimaCompleta; d = addDias(d, 7)) {
    const fim = addDias(d, 6);
    out.push({ inicio: d, fim, label: `${d.slice(8, 10)}/${d.slice(5, 7)} – ${fim.slice(8, 10)}/${fim.slice(5, 7)}` });
  }
  return out.reverse();
};

export const mesesHistorico = () => {
  const atual = inicioMes(hojeSP());
  const out: string[] = [];
  for (let mes = inicioMes(INICIO_HISTORICO); mes <= atual;) {
    out.push(mes.slice(0, 7));
    const [ano, numero] = mes.split("-").map(Number);
    const proximo = numero === 12 ? `${ano + 1}-01-01` : `${ano}-${String(numero + 1).padStart(2, "0")}-01`;
    mes = proximo;
  }
  return out.reverse();
};

export interface ResumoFamilia {
  familia: string;
  criadas: number;
  encerradas: number;
  saldo: number;
  emAndamento: number;
  atrasadas: number;
  pctDemanda: number;
  tempoMedio: number | null;
  maisAntiga: number | null;
  nivel: NivelDemanda;
}

export const resumirFamilias = (tarefas: TarefaOperacional[], mes: string): ResumoFamilia[] => {
  const familias = new Set(tarefas.map(familiaDaTarefa));
  const { criadas, encerradas } = tarefasDoMes(tarefas, mes);
  const totalCriadas = criadas.length;
  const base = [...familias].map((familia) => {
    const criadasF = criadas.filter((t) => familiaDaTarefa(t) === familia);
    const encerradasF = encerradas.filter((t) => familiaDaTarefa(t) === familia);
    const fila = tarefas.filter((t) => familiaDaTarefa(t) === familia && emAndamento(t));
    const tempos = encerradasF.map(tempoAtendimento).filter((n): n is number => n != null);
    const idades = fila.map((t) => idadeDias(t)).filter((n): n is number => n != null);
    return {
      familia,
      criadas: criadasF.length,
      encerradas: encerradasF.length,
      saldo: criadasF.length - encerradasF.length,
      emAndamento: fila.length,
      atrasadas: fila.filter((t) => faixaPrazo(t) === "atrasadas").length,
      pctDemanda: totalCriadas ? (criadasF.length / totalCriadas) * 100 : 0,
      tempoMedio: media(tempos),
      maisAntiga: idades.length ? Math.max(...idades) : null,
      nivel: "Sem movimento" as NivelDemanda,
    };
  });
  const ativos = base.filter((f) => f.criadas > 0).sort((a, b) => b.criadas - a.criadas);
  const terco = Math.max(1, Math.ceil(ativos.length / 3));
  ativos.forEach((f, i) => { f.nivel = i < terco ? "Alta" : i < terco * 2 ? "Média" : "Baixa"; });
  return base.sort((a, b) => b.criadas - a.criadas || b.emAndamento - a.emAndamento);
};

export const mediana = (valores: number[]) => {
  if (!valores.length) return null;
  const a = [...valores].sort((x, y) => x - y);
  const meio = Math.floor(a.length / 2);
  return a.length % 2 ? a[meio] : Math.round((a[meio - 1] + a[meio]) / 2);
};

export const fmtMes = (mes: string) => {
  const [ano, numero] = mes.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ano}-${numero}-01T12:00:00Z`));
};