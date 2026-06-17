import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import {
  WsFase, WsChecklistItem, FaseKey,
  FASES_DEF, itemKeysDeFase,
} from '@/types/onboarding-workspace'

export interface BitrixTarefa {
  id: string
  titulo: string
  status: string
  prioridade: string | null
  responsavel_nome: string | null
  prazo: string | null
  link_bitrix: string | null
}

interface Return {
  fases: WsFase[]
  checklist: WsChecklistItem[]
  bitrixTarefas: BitrixTarefa[]
  loading: boolean
  error: string | null
  toggleItem: (itemKey: string, fase: FaseKey) => Promise<void>
  progresso: (fase: FaseKey) => number
  progressoTotal: number
  concluirProcesso: (perpetuoId: string) => Promise<boolean>
}

export function useOnboardingWorkspace(familiaId: string): Return {
  const [fases, setFases]         = useState<WsFase[]>([])
  const [checklist, setChecklist] = useState<WsChecklistItem[]>([])
  const [bitrix, setBitrix]       = useState<BitrixTarefa[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!familiaId) return
    setLoading(true)
    setError(null)
    try {
      await ensureFases(familiaId)
      const [fasesRes, checkRes, bitrixRes] = await Promise.all([
        supabase
          .from('onboarding_fases')
          .select('*')
          .eq('familia_id', familiaId),
        supabase
          .from('onboarding_checklist')
          .select('*')
          .eq('familia_id', familiaId),
        supabase
          .from('bitrix_tarefas')
          .select('id, titulo, status, prioridade, responsavel_nome, prazo, link_bitrix')
          .eq('familia_id' as never, familiaId)
          .neq('status', 'completed')
          .order('prazo', { ascending: true })
          .limit(20),
      ])
      if (fasesRes.error)  throw fasesRes.error
      if (checkRes.error)  throw checkRes.error
      setFases((fasesRes.data ?? []) as unknown as WsFase[])
      setChecklist((checkRes.data ?? []) as unknown as WsChecklistItem[])
      setBitrix(bitrixRes.data ?? [])
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [familiaId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const toggleItem = useCallback(async (itemKey: string, fase: FaseKey) => {
    const atual = checklist.find(c => c.item_key === itemKey)
    const novo  = !(atual?.concluido ?? false)

    setChecklist(prev => prev.map(c =>
      c.item_key === itemKey
        ? { ...c, concluido: novo, concluido_em: novo ? new Date().toISOString() : null }
        : c
    ))

    const { error: err } = await supabase
      .from('onboarding_checklist')
      .upsert({
        familia_id:   familiaId,
        fase,
        item_key:     itemKey,
        concluido:    novo,
        concluido_em: novo ? new Date().toISOString() : null,
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'familia_id,item_key' })

    if (err) {
      setChecklist(prev => prev.map(c =>
        c.item_key === itemKey ? { ...c, concluido: !novo } : c
      ))
      return
    }

    await recalcProgresso(familiaId, fase, checklist, itemKey, novo)
  }, [familiaId, checklist])

  const progresso = useCallback((fase: FaseKey): number => {
    const keys  = itemKeysDeFase(fase)
    if (!keys.length) return 0
    const feitos = keys.filter(k => checklist.find(c => c.item_key === k)?.concluido).length
    return Math.round((feitos / keys.length) * 100)
  }, [checklist])

  const allKeys = FASES_DEF.flatMap(f => f.sections.flatMap(s => s.items.map(i => i.key)))
  const progressoTotal = allKeys.length
    ? Math.round(
        allKeys.filter(k => checklist.find(c => c.item_key === k)?.concluido).length
        / allKeys.length * 100
      )
    : 0

  // Marca o processo como concluído e registra o ID do Perpétuo
  const concluirProcesso = useCallback(async (perpetuoId: string): Promise<boolean> => {
    const { error: err } = await supabase
      .from('familias_onboarding')
      .update({
        status:      'concluido',
        perpetuo_id: perpetuoId,
        updated_at:  new Date().toISOString(),
      } as never)
      .eq('id', familiaId)
    return !err
  }, [familiaId])

  return {
    fases, checklist, bitrixTarefas: bitrix,
    loading, error,
    toggleItem, progresso, progressoTotal,
    concluirProcesso,
  }
}

async function ensureFases(familiaId: string) {
  const keys: FaseKey[] = ['levantamento', 'analise', 'diagnostico', 'comercial', 'performance']
  await supabase
    .from('onboarding_fases')
    .upsert(
      keys.map(fase => ({ familia_id: familiaId, fase, status: 'pendente', progresso: 0 })),
      { onConflict: 'familia_id,fase', ignoreDuplicates: true }
    )
}

async function recalcProgresso(
  familiaId: string,
  fase: FaseKey,
  checklistAtual: WsChecklistItem[],
  itemKeyAlterado: string,
  novoValor: boolean
) {
  const keys = itemKeysDeFase(fase)
  const com  = checklistAtual.map(c =>
    c.item_key === itemKeyAlterado ? { ...c, concluido: novoValor } : c
  )
  const feitos = keys.filter(k => com.find(c => c.item_key === k)?.concluido).length
  const pct    = Math.round((feitos / keys.length) * 100)
  const status = pct === 0 ? 'pendente' : pct === 100 ? 'concluida' : 'em_andamento'

  await supabase
    .from('onboarding_fases')
    .update({ progresso: pct, status, updated_at: new Date().toISOString() })
    .eq('familia_id', familiaId)
    .eq('fase', fase)
}
