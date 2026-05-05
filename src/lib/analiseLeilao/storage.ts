import { AnaliseSalva, DadosImovel, capRateNominal } from "./types";

const KEY_HIST = "analiseLeilao_historico_v1";
const KEY_CUR = "analiseLeilao_atual_v1";
const LIMITE = 20;

export function getHistorico(): AnaliseSalva[] {
  try {
    const raw = localStorage.getItem(KEY_HIST);
    return raw ? (JSON.parse(raw) as AnaliseSalva[]) : [];
  } catch {
    return [];
  }
}

export function salvarAnalise(dados: DadosImovel): AnaliseSalva {
  const item: AnaliseSalva = {
    id: Date.now(),
    criadoEm: new Date().toLocaleString("pt-BR"),
    nome: dados.nome || "Análise sem título",
    lanceMinimoMil: dados.lanceMinimoMil,
    capRate: capRateNominal(dados),
    dados,
  };
  const lista = [item, ...getHistorico()].slice(0, LIMITE);
  localStorage.setItem(KEY_HIST, JSON.stringify(lista));
  setAtual(dados);
  return item;
}

export function excluirAnalise(id: number) {
  const lista = getHistorico().filter((a) => a.id !== id);
  localStorage.setItem(KEY_HIST, JSON.stringify(lista));
}

export function setAtual(dados: DadosImovel) {
  localStorage.setItem(KEY_CUR, JSON.stringify(dados));
}

export function getAtual(): DadosImovel | null {
  try {
    const raw = localStorage.getItem(KEY_CUR);
    return raw ? (JSON.parse(raw) as DadosImovel) : null;
  } catch {
    return null;
  }
}

export function limparAtual() {
  localStorage.removeItem(KEY_CUR);
}
