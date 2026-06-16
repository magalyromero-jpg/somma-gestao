import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Database, FileSearch, Map, Coins, BarChart2,
  ArrowLeft, CircleCheck, Clock, AlertTriangle, ArrowRight, X,
} from 'lucide-react'
import { useOnboardingWorkspace } from '@/hooks/useOnboardingWorkspace'
import { FASES_DEF, FaseKey } from '@/types/onboarding-workspace'
import { ChecklistFase } from '@/components/onboarding/ChecklistFase'
import { PainelBitrix } from '@/components/onboarding/PainelBitrix'
import { cn } from '@/lib/utils'

const FASE_ICONS = {
  levantamento: Database,
  analise:      FileSearch,
  diagnostico:  Map,
  comercial:    Coins,
  performance:  BarChart2,
}

const FASE_ACCENT: Record<FaseKey, string> = {
  levantamento: 'text-[#4D6571] bg-[#4D6571]/10 border-[#4D6571]/30',
  analise:      'text-[#CC8B15] bg-[#CC8B15]/10 border-[#CC8B15]/30',
  diagnostico:  'text-[#007374] bg-[#007374]/10 border-[#007374]/30',
  comercial:    'text-[#6F8E9A] bg-[#6F8E9A]/10 border-[#6F8E9A]/30',
  performance:  'text-[#2E3E44] bg-[#2E3E44]/10 border-[#2E3E44]/20',
}

export default function OnboardingWorkspace() {
  const { id: familiaId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [faseAtiva, setFaseAtiva] = useState<FaseKey>('levantamento')
  const [showConcluir, setShowConcluir] = useState(false)
  const [perpetuoId, setPerpetuoId] = useState('')
  const [salvando, setSalvando] = useState(false)

  const {
    fases, checklist, bitrixTarefas,
    loading, error,
    toggleItem, progresso, progressoTotal,
    concluirProcesso,
  } = useOnboardingWorkspace(familiaId ?? '')

  const faseDef = FASES_DEF.find(f => f.key === faseAtiva)!
  const todasConcluidas = progressoTotal === 100

  async function handleConcluir() {
    if (!perpetuoId.trim()) return
    setSalvando(true)
    const ok = await concluirProcesso(perpetuoId.trim())
    setSalvando(false)
    if (ok) navigate(`/familias-onboarding/${familiaId}`)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 text-[#6F8E9A]">
        <Clock size={20} className="animate-spin" />
        <span className="text-sm">Carregando…</span>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl max-w-md">
        <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">Erro ao carregar</p>
          <p className="text-xs text-amber-700 mt-1">{error}</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F8F8]">

      {/* Topbar */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#D8E0E3]">
        <div className="flex items-center gap-3">
          <Link
            to="/onboarding"
            className="flex items-center gap-1.5 text-sm text-[#6F8E9A] hover:text-[#2E3E44] transition-colors"
          >
            <ArrowLeft size={15} /> Onboarding
          </Link>
          <span className="text-[#D8E0E3]">/</span>
          <span className="text-sm font-medium text-[#2E3E44]">Mapeamento</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F7F8F8] rounded-lg border border-[#D8E0E3]">
            <div className="w-20 h-1 bg-[#D8E0E3] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#007374] rounded-full transition-all duration-500"
                style={{ width: `${progressoTotal}%` }}
              />
            </div>
            <span className="text-xs text-[#6F8E9A]">{progressoTotal}%</span>
          </div>
          {todasConcluidas && (
            <button
              onClick={() => setShowConcluir(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#007374] text-white rounded-lg hover:bg-[#007374]/90 transition-colors"
            >
              Concluir processo <ArrowRight size={13} />
            </button>
          )}
        </div>
      </header>

      {/* Stepper */}
      <div className="px-6 pt-5">
        <div className="flex gap-1 p-1 bg-white border border-[#D8E0E3] rounded-lg mb-5">
          {FASES_DEF.map(fase => {
            const Icon  = FASE_ICONS[fase.key]
            const pct   = progresso(fase.key)
            const ativo = fase.key === faseAtiva
            const feita = pct === 100

            return (
              <button
                key={fase.key}
                onClick={() => setFaseAtiva(fase.key)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs transition-all',
                  ativo  ? `font-medium border ${FASE_ACCENT[fase.key]}` :
                  feita  ? 'text-[#007374] hover:bg-[#007374]/5' :
                           'text-[#6F8E9A] hover:text-[#4D6571] hover:bg-[#F7F8F8]'
                )}
              >
                {feita && !ativo
                  ? <CircleCheck size={13} className="text-[#007374]" />
                  : <Icon size={13} />
                }
                <span className="hidden sm:inline">{fase.labelCurto}</span>
                {pct > 0 && pct < 100 && (
                  <span className="text-[10px] opacity-60">{pct}%</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Conteúdo */}
      <main className="flex-1 px-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ChecklistFase
              fase={faseDef}
              checklist={checklist}
              onToggle={toggleItem}
            />
          </div>
          <div>
            <PainelBitrix tarefas={bitrixTarefas} />
          </div>
        </div>
      </main>

      {/* Banner quando tudo concluído */}
      {todasConcluidas && (
        <div className="mx-6 mb-6 flex items-center justify-between gap-4 px-5 py-4 bg-[#007374]/8 border border-[#007374]/30 rounded-xl">
          <div className="flex items-center gap-3">
            <CircleCheck size={18} className="text-[#007374] flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#2E3E44]">Mapeamento concluído</p>
              <p className="text-xs text-[#6F8E9A] mt-0.5">
                Registre no Perpétuo e informe o ID para finalizar o processo
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowConcluir(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs bg-[#007374] text-white rounded-lg hover:bg-[#007374]/90 transition-colors flex-shrink-0"
          >
            Concluir <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Modal de conclusão — solicita ID do Perpétuo */}
      {showConcluir && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-[#2E3E44]">Concluir processo de onboarding</h3>
                <p className="text-xs text-[#6F8E9A] mt-1">
                  Informe o ID desta família no Perpétuo. Quando a integração estiver ativa,
                  os dados serão puxados automaticamente a partir deste ID.
                </p>
              </div>
              <button
                onClick={() => setShowConcluir(false)}
                className="text-[#B0BCC2] hover:text-[#6F8E9A] transition-colors ml-3"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#4D6571]">
                  ID no Perpétuo
                </label>
                <input
                  type="text"
                  value={perpetuoId}
                  onChange={e => setPerpetuoId(e.target.value)}
                  placeholder="Ex: 12345"
                  className="mt-1.5 w-full px-3 py-2 text-sm border border-[#D8E0E3] rounded-lg text-[#2E3E44] placeholder:text-[#B0BCC2] focus:outline-none focus:border-[#007374]"
                  autoFocus
                />
              </div>

              <p className="text-[10px] text-[#B0BCC2]">
                Não tem o ID ainda? Você pode preencher depois editando o cadastro.
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowConcluir(false)}
                  className="flex-1 px-3 py-2 text-xs border border-[#D8E0E3] rounded-lg text-[#6F8E9A] hover:border-[#4D6571] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConcluir}
                  disabled={!perpetuoId.trim() || salvando}
                  className="flex-1 px-3 py-2 text-xs bg-[#007374] text-white rounded-lg hover:bg-[#007374]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {salvando ? 'Salvando…' : 'Confirmar conclusão'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
