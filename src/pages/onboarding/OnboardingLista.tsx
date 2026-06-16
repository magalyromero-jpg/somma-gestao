import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Search, ChevronRight, CircleCheck, Clock, AlertCircle, Map } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

interface FamiliaResumo {
  id: string
  nome: string
  patrimonio_data: any
  perpetuo_id: string | null
  progresso_total: number
  fases_concluidas: number
  status: 'pendente' | 'em_andamento' | 'concluido'
  updated_at: string
}

export default function OnboardingLista() {
  const navigate = useNavigate()
  const [familias, setFamilias] = useState<FamiliaResumo[]>([])
  const [busca, setBusca]       = useState('')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('familias_onboarding')
        .select(`
          id, nome, patrimonio_data, perpetuo_id, updated_at,
          onboarding_fases (fase, status, progresso)
        `)
        .order('updated_at', { ascending: false })

      const resumos: FamiliaResumo[] = (data ?? []).map((f: any) => {
        const fases      = f.onboarding_fases ?? []
        const concluidas = fases.filter((x: any) => x.status === 'concluida').length
        const progMedia  = fases.length
          ? Math.round(fases.reduce((a: number, x: any) => a + (x.progresso ?? 0), 0) / fases.length)
          : 0
        const status: FamiliaResumo['status'] =
          f.perpetuo_id        ? 'concluido' :
          progMedia > 0        ? 'em_andamento' : 'pendente'

        return {
          id:               f.id,
          nome:             f.nome,
          patrimonio_data:  f.patrimonio_data,
          perpetuo_id:      f.perpetuo_id,
          progresso_total:  progMedia,
          fases_concluidas: concluidas,
          status,
          updated_at:       f.updated_at,
        }
      })

      setFamilias(resumos)
      setLoading(false)
    }
    load()
  }, [])

  const filtradas = familias.filter(f =>
    f.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#F7F8F8]">
      <div className="px-6 pt-6 pb-4 bg-white border-b border-[#D8E0E3]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-base font-medium text-[#2E3E44]">Onboarding</h1>
            <p className="text-xs text-[#6F8E9A] mt-0.5">
              {familias.length} famílias · {familias.filter(f => f.status === 'em_andamento').length} em andamento
            </p>
          </div>
          <button
            onClick={() => navigate('/onboarding/novo')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#2E3E44] text-white rounded-lg hover:bg-[#3a4c54] transition-colors"
          >
            <UserPlus size={13} /> Nova família
          </button>
        </div>

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0BCC2]" />
          <input
            type="text"
            placeholder="Buscar família…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-[#F7F8F8] border border-[#D8E0E3] rounded-lg text-[#2E3E44] placeholder:text-[#B0BCC2] focus:outline-none focus:border-[#4D6571]"
          />
        </div>
      </div>

      <div className="px-6 py-4 space-y-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-white border border-[#D8E0E3] rounded-xl animate-pulse" />
            ))
          : filtradas.length === 0
            ? (
              <div className="text-center py-16">
                <p className="text-sm text-[#B0BCC2]">Nenhuma família encontrada</p>
              </div>
            )
            : filtradas.map(f => (
              <div
                key={f.id}
                className="flex items-center gap-4 px-4 py-3.5 bg-white border border-[#D8E0E3] rounded-xl hover:border-[#4D6571]/50 hover:shadow-sm transition-all group"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-lg bg-[#CC8B15]/15 flex items-center justify-center text-[#CC8B15] font-medium text-xs flex-shrink-0">
                  {f.nome.slice(0, 2).toUpperCase()}
                </div>

                {/* Info — clicável para o workspace */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/onboarding/workspace/${f.id}`)}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#2E3E44] truncate">{f.nome}</p>
                    {f.status === 'concluido' && (
                      <StatusPill color="teal" label="Concluído" Icon={CircleCheck} />
                    )}
                    {f.status === 'em_andamento' && (
                      <StatusPill color="gold" label="Em andamento" Icon={Clock} />
                    )}
                    {f.status === 'pendente' && (
                      <StatusPill color="gray" label="Pendente" Icon={AlertCircle} />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={cn('w-4 h-1 rounded-full',
                          i < f.fases_concluidas
                            ? 'bg-[#007374]'
                            : i === f.fases_concluidas && f.status === 'em_andamento'
                              ? 'bg-[#CC8B15]'
                              : 'bg-[#D8E0E3]'
                        )} />
                      ))}
                    </div>
                    <span className="text-[10px] text-[#B0BCC2]">
                      {f.fases_concluidas}/5 fases
                    </span>
                    {f.perpetuo_id && (
                      <span className="text-[10px] text-[#007374]">
                        Perpétuo #{f.perpetuo_id}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {f.patrimonio_data && (
                    <button
                      onClick={() => navigate(`/familias-onboarding/${f.id}`)}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-[#D8E0E3] text-[#6F8E9A] hover:border-[#007374] hover:text-[#007374] transition-colors"
                    >
                      <Map size={10} /> Mapa
                    </button>
                  )}
                  <span className={cn('text-sm font-medium',
                    f.progresso_total === 100 ? 'text-[#007374]' :
                    f.progresso_total > 0     ? 'text-[#CC8B15]' :
                    'text-[#B0BCC2]'
                  )}>
                    {f.progresso_total}%
                  </span>
                  <ChevronRight
                    size={14}
                    className="text-[#D8E0E3] group-hover:text-[#6F8E9A] transition-colors cursor-pointer"
                    onClick={() => navigate(`/onboarding/workspace/${f.id}`)}
                  />
                </div>
              </div>
            ))
        }
      </div>
    </div>
  )
}

function StatusPill({
  color, label, Icon,
}: {
  color: 'teal' | 'gold' | 'gray'
  label: string
  Icon: React.ComponentType<{ size?: number }>
}) {
  const styles = {
    teal: 'bg-[#E0F0F0] text-[#007374]',
    gold: 'bg-[#F5E6C8] text-[#8A5E0A]',
    gray: 'bg-[#EEF1F2] text-[#6F8E9A]',
  }
  return (
    <span className={cn('flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full', styles[color])}>
      <Icon size={9} /> {label}
    </span>
  )
}
