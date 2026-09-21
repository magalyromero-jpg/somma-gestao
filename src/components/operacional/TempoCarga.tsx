import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bloco, CORES, chartTooltipStyle, fmtDias, fmtNumero, tableClasses } from "./Shared";
import { TarefaOperacional, concluidaNoPrazo, emAndamento, faixaPrazo, familiaDaTarefa, idadeDias, mediana, responsavelDaTarefa, tarefasDoMes, tempoAtendimento, tipoDaTarefa, ymdSP } from "@/lib/operacional";
import { media } from "@/lib/tarefas";
import { addDias, hojeSP } from "@/lib/periodo";
import { cn } from "@/lib/utils";

export function TempoCarga({ tarefas, mes, semPrazo }: { tarefas: TarefaOperacional[]; mes: string; semPrazo: number }) {
  const fila = tarefas.filter(emAndamento);
  const fluxo = tarefasDoMes(tarefas, mes);
  const porTipo = useMemo(() => tabela(tarefas, mes, tipoDaTarefa, true), [tarefas, mes]);
  const porResp = useMemo(() => tabela(tarefas, mes, responsavelDaTarefa, false), [tarefas, mes]);
  const semanas = useMemo(() => semanasFluxo(mes, fluxo.criadas, fluxo.encerradas), [mes, fluxo.criadas, fluxo.encerradas]);
  const limiteParada = addDias(hojeSP(), -30);
  const paradas = [...fila].filter((t) => { const d=ymdSP(t.alterado_em); return !!d && d<=limiteParada; }).sort((a,b)=>(ymdSP(a.alterado_em)??"").localeCompare(ymdSP(b.alterado_em)??"")).slice(0,8);
  const qualidade = [
    {label:"Em andamento sem tipo",valor:fila.filter(t=>tipoDaTarefa(t)==="Sem tipo").length},
    {label:"Em andamento sem família",valor:fila.filter(t=>familiaDaTarefa(t)==="Sem família").length},
    {label:"Em andamento sem responsável",valor:fila.filter(t=>responsavelDaTarefa(t)==="Sem responsável").length},
    {label:"Tarefas sem prazo ignoradas",valor:semPrazo},
  ];
  return <div className="space-y-4">
    <div className="flex gap-2 rounded-md border border-warning/30 bg-warning-bg px-3 py-2 text-xs text-warning"><AlertTriangle className="h-4 w-4 shrink-0"/><span>Duração prevista não está preenchida no Bitrix; o tempo estimado é o tempo de atendimento (criação até conclusão) das demandas encerradas no mês. Serve de referência e não mede esforço.</span></div>
    <Bloco titulo="Carga e atendimento por tipo"><TabelaCarga rows={porTipo} tipo /></Bloco>
    <Bloco titulo="Carga e atendimento por responsável"><TabelaCarga rows={porResp} /></Bloco>
    <h2 className="pt-2 text-lg font-semibold">Gestão interna</h2>
    <div className="grid gap-4 xl:grid-cols-2">
      <Bloco titulo="Entrada x saída por semana do mês"><ResponsiveContainer width="100%" height={260}><BarChart data={semanas}><CartesianGrid vertical={false} stroke={CORES.borda}/><XAxis dataKey="nome" tick={{fontSize:10}}/><YAxis allowDecimals={false} tick={{fontSize:10}}/><Tooltip contentStyle={chartTooltipStyle}/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="criadas" name="Entrada" fill={CORES.marca}/><Bar dataKey="encerradas" name="Saída" fill={CORES.ouro}/><Bar dataKey="saldo" name="Saldo" fill={CORES.secundaria}/></BarChart></ResponsiveContainer></Bloco>
      <Bloco titulo={`Demandas paradas · ${paradas.length}`}><div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}><th className={tableClasses.th}>Demanda</th><th className={tableClasses.th}>Família</th><th className={tableClasses.th}>Responsável</th><th className={tableClasses.th}>Última alteração</th></tr></thead><tbody>{paradas.map(t=><tr key={t.bitrix_id}><td className={tableClasses.td}><a href={t.link_bitrix??undefined} target="_blank" rel="noreferrer" className="font-medium hover:underline">{t.titulo}</a></td><td className={tableClasses.td}>{familiaDaTarefa(t)}</td><td className={tableClasses.td}>{responsavelDaTarefa(t)}</td><td className={tableClasses.td}>{fmtData(t.alterado_em)}</td></tr>)}</tbody></table></div></Bloco>
      <Bloco titulo="Qualidade do dado" className="xl:col-span-2"><div className="grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4">{qualidade.map(x=><div key={x.label} className="bg-card p-4"><div className="text-2xl font-semibold tabular-nums">{x.valor}</div><div className="mt-1 text-xs text-muted-foreground">{x.label}</div></div>)}</div></Bloco>
    </div>
  </div>;
}
interface Linha { nome:string; emAndamento:number; atrasadas:number; idadeMedia:number|null; encerradas:number; tempoMedio:number|null; mediana:number|null; pctPrazo:number|null }
function tabela(tarefas:TarefaOperacional[],mes:string,chave:(t:TarefaOperacional)=>string,comPrazo:boolean):Linha[]{const nomes=new Set(tarefas.map(chave));const fluxo=tarefasDoMes(tarefas,mes);return [...nomes].map(nome=>{const fila=tarefas.filter(t=>emAndamento(t)&&chave(t)===nome);const enc=fluxo.encerradas.filter(t=>chave(t)===nome);const tempos=enc.map(tempoAtendimento).filter((n):n is number=>n!=null);return {nome,emAndamento:fila.length,atrasadas:fila.filter(t=>faixaPrazo(t)==="atrasadas").length,idadeMedia:media(fila.map(idadeDias).filter((n):n is number=>n!=null)),encerradas:enc.length,tempoMedio:media(tempos),mediana:mediana(tempos),pctPrazo:comPrazo&&enc.length?enc.filter(concluidaNoPrazo).length/enc.length*100:null}}).filter(r=>r.emAndamento+r.encerradas>0).sort((a,b)=>b.emAndamento-a.emAndamento)}
function TabelaCarga({rows,tipo=false}:{rows:Linha[];tipo?:boolean}){return <div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}><th className={tableClasses.th}>{tipo?"Tipo":"Responsável"}</th><th className={cn(tableClasses.th,"text-right")}>Em and.</th><th className={cn(tableClasses.th,"text-right")}>Atras.</th>{!tipo&&<th className={cn(tableClasses.th,"text-right")}>Idade média</th>}<th className={cn(tableClasses.th,"text-right")}>Encerradas no mês</th><th className={cn(tableClasses.th,"text-right")}>Tempo médio</th>{tipo&&<><th className={cn(tableClasses.th,"text-right")}>Mediana</th><th className={cn(tableClasses.th,"text-right")}>% no prazo</th></>}</tr></thead><tbody>{rows.map(r=><tr key={r.nome}><td className={cn(tableClasses.td,"font-medium")}>{r.nome}</td><td className={tableClasses.num}>{r.emAndamento}</td><td className={cn(tableClasses.num,r.atrasadas>0&&"text-destructive")}>{r.atrasadas}</td>{!tipo&&<td className={tableClasses.num}>{fmtDias(r.idadeMedia)}</td>}<td className={tableClasses.num}>{r.encerradas}</td><td className={tableClasses.num}>{fmtDias(r.tempoMedio)}</td>{tipo&&<><td className={tableClasses.num}>{fmtDias(r.mediana)}</td><td className={tableClasses.num}>{r.pctPrazo==null?"—":`${fmtNumero(r.pctPrazo,1)}%`}</td></>}</tr>)}</tbody></table></div>}
function semanasFluxo(mes:string,criadas:TarefaOperacional[],encerradas:TarefaOperacional[]){const [a,m]=mes.split("-").map(Number);const total=new Date(Date.UTC(a,m,0)).getUTCDate();return Array.from({length:Math.ceil(total/7)},(_,i)=>{const ini=`${mes}-${String(i*7+1).padStart(2,"0")}`,fim=`${mes}-${String(Math.min(total,i*7+7)).padStart(2,"0")}`;const c=criadas.filter(t=>{const d=ymdSP(t.criado_em);return d&&d>=ini&&d<=fim}).length,e=encerradas.filter(t=>{const d=ymdSP(t.concluido_em);return d&&d>=ini&&d<=fim}).length;return {nome:`Sem. ${i+1}`,criadas:c,encerradas:e,saldo:c-e}})}
const fmtData=(iso:string|null)=>iso?new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo"}).format(new Date(iso)):"—";