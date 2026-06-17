import { ExternalLink, ListCheck, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BitrixTarefa } from '@/hooks/useOnboardingWorkspace'

interface Props { tarefas: BitrixTarefa[] }

function formatPrazo(prazo: string | null): string {
  if (!prazo) return '—'
  const diff = Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000)
  if (diff < 0)   return `${Math.abs(diff)}d atraso`
  if (diff === 0) return 'hoje'
  if (diff <= 7)  return `${diff}d`
  return new Date(prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function prazoClass(prazo: string | null): string {
  if (!prazo) return 'text-[#B0BCC2]'
  const diff = Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000)
  if (diff < 0)  return 'text-[#B02818]'
  if (diff <= 3) return 'text-[#CC8B15]'
  return 'text-[#007374]'
}

export function PainelBitrix({ tarefas }: Props) {
  return (
    <div className="bg-white border border-[#D8E0E3] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#D8E0E3]">
        <div className="flex items-center gap-2">
          <ListCheck size={14} className="text-[#6F8E9A]" />
          <span className="text-xs font-medium text-[#2E3E44]">Tarefas em aberto</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#EEF1F2] text-[#6F8E9A]">
            Bitrix
          </span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded bg-[#F7F8F8] text-[#C8D0D4] border border-dashed border-[#D8E0E3]"
            title="Integração com Perpétuo — em breve"
          >
            Perpétuo
          </span>
        </div>
      </div>

      {tarefas.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <Clock size={20} className="text-[#D8E0E3] mx-auto mb-2" />
          <p className="text-xs text-[#B0BCC2]">Nenhuma tarefa em aberto</p>
          <p className="text-[10px] text-[#C8D0D4] mt-0.5">
            Vincule esta família a um marcador no Bitrix
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#F0F3F4]">
          {tarefas.map(t => (
            <div
              key={t.id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-[#F7F8F8] transition-colors group"
            >
              <span className={cn(
                'mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0',
                t.prioridade === 'high'    ? 'bg-[#B02818]' :
                t.prioridade === 'average' ? 'bg-[#CC8B15]' : 'bg-[#D8E0E3]'
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#2E3E44] leading-snug line-clamp-2">{t.titulo}</p>
                {t.responsavel_nome && (
                  <p className="text-[10px] text-[#B0BCC2] mt-0.5">{t.responsavel_nome}</p>
                )}
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                <span className={cn('text-[10px] font-medium', prazoClass(t.prazo))}>
                  {formatPrazo(t.prazo)}
                </span>
                {t.link_bitrix && (
                  <a
                    href={t.link_bitrix}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink size={11} className="text-[#6F8E9A]" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-[#F0F3F4] bg-[#F7F8F8]">
        <p className="text-[10px] text-[#C8D0D4]">
          Dados do Perpétuo serão vinculados quando a integração estiver ativa
        </p>
      </div>
    </div>
  )
}
