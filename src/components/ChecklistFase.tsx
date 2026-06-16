import { CheckSquare, Square } from 'lucide-react'
import { FaseDef, FaseKey, WsChecklistItem } from '@/types/onboarding-workspace'
import { cn } from '@/lib/utils'

interface Props {
  fase: FaseDef
  checklist: WsChecklistItem[]
  onToggle: (itemKey: string, fase: FaseKey) => Promise<void>
}

const TAG_STYLE: Record<string, string> = {
  pf:     'bg-[#E0F0F0] text-[#007374]',
  pj:     'bg-[#F5E6C8] text-[#8A5E0A]',
  alerta: 'bg-[#FDECEA] text-[#B02818]',
}
const TAG_LABEL: Record<string, string> = { pf: 'PF', pj: 'PJ', alerta: '⚠' }

export function ChecklistFase({ fase, checklist, onToggle }: Props) {
  const allKeys = fase.sections.flatMap(s => s.items.map(i => i.key))
  const feitos  = allKeys.filter(k => checklist.find(c => c.item_key === k)?.concluido).length
  const pct     = allKeys.length ? Math.round((feitos / allKeys.length) * 100) : 0

  return (
    <div className="bg-white border border-[#D8E0E3] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8E0E3]">
        <div>
          <h2 className="text-sm font-medium text-[#2E3E44]">{fase.label}</h2>
          <p className="text-xs text-[#6F8E9A] mt-0.5">{feitos} de {allKeys.length} itens</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-28 h-1.5 bg-[#EEF1F2] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: pct === 100 ? '#007374' : '#CC8B15' }}
            />
          </div>
          <span className="text-xs font-medium text-[#6F8E9A] w-8 text-right">{pct}%</span>
        </div>
      </div>

      <div className="divide-y divide-[#F0F3F4]">
        {fase.sections.map(section => {
          const secFeitos = section.items.filter(
            i => checklist.find(c => c.item_key === i.key)?.concluido
          ).length

          return (
            <div key={section.title} className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-medium text-[#6F8E9A] uppercase tracking-wider">
                  {section.title}
                </span>
                <span className="text-[10px] text-[#B0BCC2]">
                  {secFeitos}/{section.items.length}
                </span>
              </div>

              <div className="space-y-1">
                {section.items.map(item => {
                  const concluido = checklist.find(c => c.item_key === item.key)?.concluido ?? false
                  return (
                    <button
                      key={item.key}
                      onClick={() => onToggle(item.key, fase.key)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all border',
                        concluido
                          ? 'bg-[#F7F8F8] border-[#E8EDEF]'
                          : 'border-transparent hover:bg-[#F7F8F8] hover:border-[#D8E0E3]'
                      )}
                    >
                      <span className="flex-shrink-0">
                        {concluido
                          ? <CheckSquare size={15} className="text-[#007374]" />
                          : <Square size={15} className="text-[#B0BCC2]" />
                        }
                      </span>
                      <span className={cn(
                        'flex-1 text-xs leading-relaxed',
                        concluido ? 'text-[#B0BCC2] line-through' : 'text-[#2E3E44]'
                      )}>
                        {item.label}
                      </span>
                      {item.tag && (
                        <span className={cn(
                          'flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full',
                          TAG_STYLE[item.tag]
                        )}>
                          {TAG_LABEL[item.tag]}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
