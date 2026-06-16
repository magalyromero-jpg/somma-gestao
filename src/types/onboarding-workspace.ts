export type FaseKey =
  | 'levantamento'
  | 'analise'
  | 'diagnostico'
  | 'comercial'
  | 'performance'

export type FaseStatus = 'pendente' | 'em_andamento' | 'concluida'

export interface WsFase {
  id: string
  familia_id: string
  fase: FaseKey
  status: FaseStatus
  progresso: number
  updated_at: string
}

export interface WsChecklistItem {
  id: string
  familia_id: string
  fase: FaseKey
  item_key: string
  concluido: boolean
  concluido_em: string | null
  observacao: string | null
}

export type PerfilTag = 'pf' | 'pj' | 'alerta'

export interface ItemDef {
  key: string
  label: string
  tag?: PerfilTag
}

export interface SecaoDef {
  title: string
  items: ItemDef[]
}

export interface FaseDef {
  key: FaseKey
  label: string
  labelCurto: string
  sections: SecaoDef[]
}

export const FASES_DEF: FaseDef[] = [
  {
    key: 'levantamento',
    label: 'Levantamento',
    labelCurto: 'Levantamento',
    sections: [
      {
        title: 'Tipo de cliente',
        items: [
          { key: 'perfil_definido',     label: 'Definir perfil: PF, PJ ou ambos' },
          { key: 'ir_coletado',         label: 'Coletar informe de rendimentos (IR)',  tag: 'pf' },
          { key: 'imoveis_cnpj',        label: 'Levantar imóveis registrados no CNPJ', tag: 'pj' },
          { key: 'representante_legal', label: 'Confirmar representante legal',         tag: 'pj' },
        ],
      },
      {
        title: 'Portfólio inicial',
        items: [
          { key: 'imoveis_listados',     label: 'Listar todos os imóveis informados' },
          { key: 'imoveis_registrados',  label: 'Registrar endereço, tipo e nome' },
          { key: 'matricula_verificada', label: 'Verificar se há matrícula disponível' },
          { key: 'contrato_verificado',  label: 'Verificar contrato de compra e venda' },
          { key: 'docs_sinalizados',     label: 'Sinalizar documentação faltante', tag: 'alerta' },
        ],
      },
    ],
  },
  {
    key: 'analise',
    label: 'Análise documental',
    labelCurto: 'Análise doc.',
    sections: [
      {
        title: 'Situação jurídica',
        items: [
          { key: 'contratos_analisados',  label: 'Analisar contratos de compra e venda' },
          { key: 'terreno_regular',       label: 'Verificar regularidade do terreno' },
          { key: 'quitacao_verificada',   label: 'Confirmar quitação ou saldo devedor' },
          { key: 'onus_verificado',       label: 'Checar ônus, penhoras ou restrições', tag: 'alerta' },
        ],
      },
      {
        title: 'Regularização',
        items: [
          { key: 'status_classificado',   label: 'Classificar: regular / pendente / irregular' },
          { key: 'regularizacao_mapeada', label: 'Identificar o que precisa ser regularizado' },
          { key: 'prazo_estimado',        label: 'Estimar prazo para regularização' },
        ],
      },
    ],
  },
  {
    key: 'diagnostico',
    label: 'Diagnóstico',
    labelCurto: 'Diagnóstico',
    sections: [
      {
        title: 'Mapa do portfólio',
        items: [
          { key: 'imoveis_consolidados',   label: 'Consolidar todos os imóveis com status' },
          { key: 'separacao_status',       label: 'Separar: regulares × pendentes × irregulares' },
          { key: 'comercializados_id',     label: 'Identificar o que já está comercializado' },
          { key: 'comercializaveis_id',    label: 'Identificar o que pode ser comercializado' },
          { key: 'bloqueados_sinalizados', label: 'Sinalizar dependências de regularização', tag: 'alerta' },
        ],
      },
      {
        title: 'Potencial',
        items: [
          { key: 'potencial_construtivo', label: 'Avaliar potencial construtivo por ativo' },
          { key: 'vocacao_definida',      label: 'Definir vocação: short stay, long stay ou venda' },
          { key: 'renda_estimada',        label: 'Estimar potencial de renda por ativo' },
        ],
      },
    ],
  },
  {
    key: 'comercial',
    label: 'Comercial',
    labelCurto: 'Comercial',
    sections: [
      {
        title: 'Imóveis em locação',
        items: [
          { key: 'valor_mercado',    label: 'Checar valor praticado vs. mercado' },
          { key: 'repasses_3m',      label: 'Analisar repasses dos últimos 3 meses' },
          { key: 'indice_reajuste',  label: 'Verificar índice de reajuste (IGPM, IPCA)' },
          { key: 'contratos_vencer', label: 'Identificar contratos a vencer ou renovar', tag: 'alerta' },
        ],
      },
      {
        title: 'Imóveis à venda',
        items: [
          { key: 'preco_mercado',     label: 'Verificar preço pedido vs. avaliação de mercado' },
          { key: 'correcao_aplicada', label: 'Verificar índice de correção aplicado' },
        ],
      },
    ],
  },
  {
    key: 'performance',
    label: 'Performance',
    labelCurto: 'Performance',
    sections: [
      {
        title: 'Análise de resultado',
        items: [
          { key: 'performance_avaliada', label: 'Avaliar ocupação, adimplência e retorno' },
          { key: 'custo_mensal',         label: 'Apurar custo mensal (IPTU, cond., manutenção)' },
          { key: 'resultado_liquido',    label: 'Calcular resultado líquido mensal por ativo' },
          { key: 'short_vs_long',        label: 'Comparar short stay vs. long stay' },
        ],
      },
      {
        title: 'Recomendações',
        items: [
          { key: 'acao_por_imovel',    label: 'Indicar ação por imóvel (manter / ajustar / vender)' },
          { key: 'prioridade_impacto', label: 'Priorizar por impacto financeiro', tag: 'alerta' },
          { key: 'relatorio_final',    label: 'Consolidar relatório final para o cliente' },
        ],
      },
    ],
  },
]

export function itemKeysDeFase(fase: FaseKey): string[] {
  const def = FASES_DEF.find(f => f.key === fase)
  return def ? def.sections.flatMap(s => s.items.map(i => i.key)) : []
}
