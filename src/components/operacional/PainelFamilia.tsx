import { useMemo, useState } from "react";
import { ExternalLink, Flame } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addDias } from "@/lib/periodo";
import { FAIXAS_PRAZO, TarefaOperacional, emAndamento, faixaPrazo, familiaDaTarefa, fmtMes, idadeDias, prioridade, responsavelDaTarefa, resumirFamilias, serieFilaDiaria, tarefasDoMes, tempoAtendimento, tipoDaTarefa } from "@/lib/operacional";
import { media } from "@/lib/tarefas";
import { cn } from "@/lib/utils";
import { Bloco, CORES, FaixaNumeros, chartTooltipStyle, fmtDias, fmtNumero, tableClasses } from "./Shared";
import { Nivel } from "./Familias";

export function PainelFamilia({ nome, tarefas, mes, onVoltar }: { nome: string; tarefas: TarefaOperacional[]; mes: string; onVoltar: () => void }) {
  const [limite, setLimite] = useState(40);
  const escopo = tarefas.filter((t) => familiaDaTarefa(t) === nome);
  const fila = escopo.filter(emAndamento);
  const fluxo = tarefasDoMes(escopo, mes);
  const geralFluxo = tarefasDoMes(tarefas, mes);
  const resumo = resumirFamilias(tarefas, mes).find((f) => f.familia === nome);
  const tempos = fluxo.encerradas.map(tempoAtendimento).filter((n): n is number => n != null);
  const contPrazo = (key: string) => fila.filter((t) => faixaPrazo(t) === key).length;
  const antiga = [...fila].sort((a,b)=>(idadeDias(b)??-1)-(idadeDias(a)??-1))[0];
  const tipo = conta(fila, tipoDaTarefa); const responsavel=conta(fila,responsavelDaTarefa);
  const semanas = useMemo(() => semanasMes(mes, fluxo.criadas, fluxo.encerradas), [mes, fluxo.criadas, fluxo.encerradas]);
  const ordenadas = [...fila].sort((a,b)=>Number(prioridade(b))-Number(prioridade(a)) || ordemPrazo(faixaPrazo(a))-ordemPrazo(faixaPrazo(b)) || (idadeDias(b)??0)-(idadeDias(a)??0));
  return <div className="space-y-4">
    <Button variant="ghost" size="sm" className="-ml-2" onClick={onVoltar}>← Voltar</Button>
    <div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold">{nome}</h2><Nivel nivel={resumo?.nivel ?? "Sem movimento"}/><span className="text-sm text-muted-foreground">{fmtMes(mes)}</span></div>
    <FaixaNumeros itens={[
      {label:"Em andamento",valor:fila.length},{label:"Atrasadas",valor:contPrazo("atrasadas"),danger:true},{label:"Vencem hoje",valor:contPrazo("hoje")},{label:"Esta semana",valor:contPrazo("esta_semana")},{label:"Próx. semana",valor:contPrazo("proxima_semana")},{label:"Depois",valor:contPrazo("depois")},{label:"🔥 Prioridade",valor:fila.filter(prioridade).length},
    ]}/>
    {antiga&&<div className="rounded-md border-l-4 border-gold bg-card px-4 py-3 text-sm"><span className="mr-3 text-xs font-medium uppercase text-muted-foreground">Mais antiga</span><a href={antiga.link_bitrix??undefined} target="_blank" rel="noreferrer" className="font-semibold hover:underline">{antiga.titulo}</a><span className="ml-3 text-muted-foreground">{responsavelDaTarefa(antiga)} · {fmtDias(idadeDias(antiga))}</span></div>}
    <FaixaNumeros itens={[{label:"Criadas",valor:fluxo.criadas.length},{label:"Encerradas",valor:fluxo.encerradas.length},{label:"Saldo",valor:fluxo.criadas.length-fluxo.encerradas.length,danger:fluxo.criadas.length>fluxo.encerradas.length},{label:"% da demanda",valor:`${fmtNumero(geralFluxo.criadas.length?fluxo.criadas.length/geralFluxo.criadas.length*100:0,1)}%`},{label:"Tempo médio",valor:fmtDias(media(tempos))}]}/>
    <div className="grid gap-4 xl:grid-cols-2">
      <Bloco titulo="Em andamento por dia"><ResponsiveContainer width="100%" height={240}><LineChart data={serieFilaDiaria(escopo,mes)}><CartesianGrid vertical={false} stroke={CORES.borda}/><XAxis dataKey="dia" tickFormatter={v=>v.slice(8,10)} tick={{fontSize:10}}/><YAxis allowDecimals={false} tick={{fontSize:10}}/><Tooltip contentStyle={chartTooltipStyle}/><Line dataKey="valor" stroke={CORES.marca} strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></Bloco>
      <Bloco titulo="Por tipo"><Donut data={tipo}/></Bloco>
      <Bloco titulo="Criadas x encerradas por semana do mês"><ResponsiveContainer width="100%" height={240}><BarChart data={semanas}><CartesianGrid vertical={false} stroke={CORES.borda}/><XAxis dataKey="nome" tick={{fontSize:10}}/><YAxis allowDecimals={false} tick={{fontSize:10}}/><Tooltip contentStyle={chartTooltipStyle}/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="criadas" name="Criadas" fill={CORES.marca}>{semanas.map(s=><Cell key={s.nome} fill={s.futura?CORES.borda:CORES.marca}/>)}</Bar><Bar dataKey="encerradas" name="Encerradas" fill={CORES.ouro}>{semanas.map(s=><Cell key={s.nome} fill={s.futura?CORES.borda:CORES.ouro}/>)}</Bar></BarChart></ResponsiveContainer></Bloco>
      <Bloco titulo="Por prazo"><Simple data={FAIXAS_PRAZO.map(f=>({nome:f.label,total:contPrazo(f.key),key:f.key}))}/></Bloco>
      <Bloco titulo="Por responsável" className="xl:col-span-2"><Simple data={responsavel.slice(0,12)}/></Bloco>
    </div>
    <Bloco titulo={`Demandas em andamento (${fila.length})`}><div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}><th className={tableClasses.th}>🔥</th><th className={tableClasses.th}>Demanda</th><th className={tableClasses.th}>Tipo</th><th className={tableClasses.th}>Responsável</th><th className={tableClasses.th}>Prazo</th><th className={tableClasses.th}>Situação</th><th className={cn(tableClasses.th,"text-right")}>Idade</th></tr></thead><tbody>{ordenadas.slice(0,limite).map(t=><tr key={t.bitrix_id}><td className={tableClasses.td}>{prioridade(t)&&<Flame className="h-4 w-4 text-gold"/>}</td><td className={tableClasses.td}><a href={t.link_bitrix??undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">{t.titulo??"Sem título"}<ExternalLink className="h-3 w-3"/></a></td><td className={tableClasses.td}>{tipoDaTarefa(t)}</td><td className={tableClasses.td}>{responsavelDaTarefa(t)}</td><td className={tableClasses.td}>{fmtData(t.prazo)}</td><td className={tableClasses.td}><Situacao faixa={faixaPrazo(t)}/></td><td className={tableClasses.num}>{fmtDias(idadeDias(t))}</td></tr>)}</tbody></table></div>{limite<ordenadas.length&&<Button variant="outline" size="sm" className="mt-3" onClick={()=>setLimite(v=>v+40)}>Mostrar mais</Button>}</Bloco>
    <Bloco titulo={`Encerradas em ${fmtMes(mes)} (${fluxo.encerradas.length})`}><div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}><th className={tableClasses.th}>Demanda</th><th className={tableClasses.th}>Tipo</th><th className={tableClasses.th}>Responsável</th><th className={tableClasses.th}>Encerrada</th><th className={cn(tableClasses.th,"text-right")}>Tempo</th></tr></thead><tbody>{fluxo.encerradas.map(t=><tr key={t.bitrix_id}><td className={tableClasses.td}><a href={t.link_bitrix??undefined} target="_blank" rel="noreferrer" className="hover:underline">{t.titulo}</a></td><td className={tableClasses.td}>{tipoDaTarefa(t)}</td><td className={tableClasses.td}>{responsavelDaTarefa(t)}</td><td className={tableClasses.td}>{fmtData(t.concluido_em)}</td><td className={tableClasses.num}>{fmtDias(tempoAtendimento(t))}</td></tr>)}</tbody></table></div></Bloco>
  </div>;
}
function conta(t:TarefaOperacional[],fn:(x:TarefaOperacional)=>string){const m=new Map<string,number>();t.forEach(x=>m.set(fn(x),(m.get(fn(x))??0)+1));return [...m].map(([nome,total])=>({nome,total})).sort((a,b)=>b.total-a.total)}
function Donut({data}:{data:{nome:string;total:number}[]}){return <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={data} dataKey="total" nameKey="nome" innerRadius={52} outerRadius={82}>{data.map((d,i)=><Cell key={d.nome} fill={[CORES.marca,CORES.ouro,CORES.secundaria,"hsl(var(--info))","hsl(var(--success))",CORES.texto][i%6]}/>)}</Pie><Tooltip contentStyle={chartTooltipStyle}/><Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{fontSize:11}}/></PieChart></ResponsiveContainer>}
function Simple({data}:{data:{nome:string;total:number;key?:string}[]}){return <ResponsiveContainer width="100%" height={240}><BarChart data={data}><CartesianGrid vertical={false} stroke={CORES.borda}/><XAxis dataKey="nome" tick={{fontSize:10}}/><YAxis allowDecimals={false} tick={{fontSize:10}}/><Tooltip contentStyle={chartTooltipStyle}/><Bar dataKey="total" fill={CORES.marca}>{data.map(d=><Cell key={d.nome} fill={d.key==="atrasadas"?CORES.atraso:d.key==="hoje"||d.key==="esta_semana"?CORES.ouro:CORES.marca}/>)}</Bar></BarChart></ResponsiveContainer>}
function semanasMes(mes:string,criadas:TarefaOperacional[],encerradas:TarefaOperacional[]){const inicio=`${mes}-01`;const [a,m]=mes.split("-").map(Number);const ultimo=new Date(Date.UTC(a,m,0)).getUTCDate();return Array.from({length:Math.ceil(ultimo/7)},(_,i)=>{const ini=addDias(inicio,i*7),fim=addDias(inicio,Math.min(ultimo-1,i*7+6));return {nome:`Sem. ${i+1}${ini>new Date().toISOString().slice(0,10)?" · a registrar":""}`,criadas:criadas.filter(t=>{const d=t.criado_em?.slice(0,10);return d&&d>=ini&&d<=fim}).length,encerradas:encerradas.filter(t=>{const d=t.concluido_em?.slice(0,10);return d&&d>=ini&&d<=fim}).length,futura:ini>new Date().toISOString().slice(0,10)}})}
function Situacao({faixa}:{faixa:string|null}){const label=FAIXAS_PRAZO.find(f=>f.key===faixa)?.label??"—";return <Badge variant={faixa==="atrasadas"?"destructive":"outline"}>{label}</Badge>}
function ordemPrazo(f:string|null){return ["atrasadas","hoje","esta_semana","proxima_semana","depois"].indexOf(f??"depois")}
const fmtData=(iso:string|null)=>iso?new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo"}).format(new Date(iso)):"—";