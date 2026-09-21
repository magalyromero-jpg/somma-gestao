import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Bloco, CORES, FaixaNumeros, chartTooltipStyle, fmtDias, fmtNumero, tableClasses } from "./Shared";
import { ResumoFamilia, TarefaOperacional, emAndamento, faixaPrazo, familiaDaTarefa, media, resumirFamilias, serieFilaDiaria, tarefasDoMes, tempoAtendimento } from "@/lib/operacional";
import { cn } from "@/lib/utils";

export function Familias({ tarefas, mes, onFamilia }: { tarefas: TarefaOperacional[]; mes: string; onFamilia: (nome: string) => void }) {
  const resumo = useMemo(() => resumirFamilias(tarefas, mes), [tarefas, mes]);
  const fluxo = useMemo(() => tarefasDoMes(tarefas, mes), [tarefas, mes]);
  const serie = useMemo(() => serieFilaDiaria(tarefas, mes), [tarefas, mes]);
  const movimento = resumo.filter((f) => f.criadas + f.encerradas > 0).length;
  const tempos = fluxo.encerradas.map(tempoAtendimento).filter((n): n is number => n != null);
  const participacao = participacaoMes(resumo);
  const topFluxo = resumo.filter((f) => f.criadas + f.encerradas > 0).slice(0, 12);
  const topFila = [...resumo].filter((f) => f.emAndamento > 0).sort((a, b) => b.emAndamento - a.emAndamento).slice(0, 12);
  const topTempo = [...resumo].filter((f) => f.encerradas > 0 && f.tempoMedio != null).sort((a, b) => (b.tempoMedio ?? 0) - (a.tempoMedio ?? 0)).slice(0, 10);
  const niveis = ["Alta", "Média", "Baixa"].map((nivel) => {
    const fams = resumo.filter((f) => f.nivel === nivel);
    const criadas = fams.reduce((s, f) => s + f.criadas, 0);
    return { nivel, familias: fams.length, pct: fluxo.criadas.length ? criadas / fluxo.criadas.length * 100 : 0, emAndamento: fams.reduce((s, f) => s + f.emAndamento, 0), atrasadas: fams.reduce((s, f) => s + f.atrasadas, 0) };
  });
  const inicio = serie[0]?.valor ?? 0;
  const final = serie[serie.length - 1]?.valor ?? 0;
  return <div className="space-y-4">
    <FaixaNumeros itens={[
      { label: "Famílias com movimento", valor: movimento },
      { label: "Criadas", valor: fluxo.criadas.length },
      { label: "Encerradas", valor: fluxo.encerradas.length },
      { label: "Saldo", valor: fluxo.criadas.length - fluxo.encerradas.length, danger: fluxo.criadas.length - fluxo.encerradas.length > 0 },
      { label: "Tempo médio", valor: fmtDias(media(tempos)) },
    ]} />
    <div className="grid gap-4 xl:grid-cols-2">
      <Bloco titulo="Demandas em andamento por dia" acao={<span className="text-xs text-muted-foreground">De {inicio} em {serie[0]?.dia.slice(8, 10)}/{serie[0]?.dia.slice(5, 7)} para {final} hoje ({final - inicio >= 0 ? "+" : ""}{final - inicio})</span>}>
        <ResponsiveContainer width="100%" height={250}><LineChart data={serie}><CartesianGrid vertical={false} stroke={CORES.borda} /><XAxis dataKey="dia" tickFormatter={(v) => v.slice(8, 10)} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip contentStyle={chartTooltipStyle} labelFormatter={(v) => `${v.slice(8, 10)}/${v.slice(5, 7)}`} /><Line type="monotone" dataKey="valor" name="Em andamento" stroke={CORES.marca} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </Bloco>
      <Bloco titulo="Participação na demanda do mês"><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={participacao} dataKey="total" nameKey="nome" innerRadius={55} outerRadius={84}>{participacao.map((d, i) => <Cell key={d.nome} fill={[CORES.marca, CORES.ouro, CORES.secundaria, "hsl(var(--info))", "hsl(var(--success))", CORES.texto, CORES.borda, "hsl(var(--muted))"][i]} />)}</Pie><Tooltip contentStyle={chartTooltipStyle} /><Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></Bloco>
      <Bloco titulo="Criadas x encerradas por família"><FamilyBars data={topFluxo} keys={["criadas", "encerradas"]} /></Bloco>
      <Bloco titulo="Nível de demanda"><div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}><th className={tableClasses.th}>Nível</th><th className={cn(tableClasses.th,"text-right")}>Famílias</th><th className={cn(tableClasses.th,"text-right")}>% criadas</th><th className={cn(tableClasses.th,"text-right")}>Em andamento</th><th className={cn(tableClasses.th,"text-right")}>Atrasadas</th></tr></thead><tbody>{niveis.map((n) => <tr key={n.nivel}><td className={tableClasses.td}><Nivel nivel={n.nivel} /></td><td className={tableClasses.num}>{n.familias}</td><td className={tableClasses.num}>{fmtNumero(n.pct,1)}%</td><td className={tableClasses.num}>{n.emAndamento}</td><td className={cn(tableClasses.num,n.atrasadas>0&&"text-destructive")}>{n.atrasadas}</td></tr>)}</tbody></table></div></Bloco>
      <Bloco titulo="Fila atual por família"><FamilyBars data={topFila.map((f) => ({ ...f, noPrazo: f.emAndamento - f.atrasadas }))} keys={["atrasadas", "noPrazo"]} stacked /></Bloco>
      <Bloco titulo="Tempo médio de atendimento"><ResponsiveContainer width="100%" height={Math.max(250, topTempo.length*30)}><BarChart data={topTempo.map((f) => ({ nome: `${f.familia} (${f.encerradas})`, dias: f.tempoMedio }))} layout="vertical"><CartesianGrid horizontal={false} stroke={CORES.borda}/><XAxis type="number" tick={{fontSize:10}}/><YAxis dataKey="nome" type="category" width={135} tick={{fontSize:10}}/><Tooltip contentStyle={chartTooltipStyle}/><Bar dataKey="dias" name="Dias" fill={CORES.secundaria}/></BarChart></ResponsiveContainer></Bloco>
    </div>
    <Bloco titulo="Demanda por família"><div className={tableClasses.wrap}><table className={tableClasses.table}><thead><tr className={tableClasses.head}>{["Família","Nível","Criadas","Encerradas","Saldo","Em andamento","Atrasadas","% da demanda","Tempo médio","Mais antiga"].map((h,i)=><th key={h} className={cn(tableClasses.th,i>1&&"text-right")}>{h}</th>)}</tr></thead><tbody>{resumo.map((f)=><tr key={f.familia} className="cursor-pointer hover:bg-muted/50" onClick={()=>onFamilia(f.familia)}><td className={cn(tableClasses.td,"font-medium")}>{f.familia}</td><td className={tableClasses.td}><Nivel nivel={f.nivel}/></td><td className={tableClasses.num}>{f.criadas}</td><td className={tableClasses.num}>{f.encerradas}</td><td className={cn(tableClasses.num,f.saldo>0&&"text-destructive")}>{f.saldo}</td><td className={tableClasses.num}>{f.emAndamento}</td><td className={cn(tableClasses.num,f.atrasadas>0&&"font-medium text-destructive")}>{f.atrasadas}</td><td className={tableClasses.num}>{fmtNumero(f.pctDemanda,1)}%</td><td className={tableClasses.num}>{fmtDias(f.tempoMedio)}</td><td className={tableClasses.num}>{fmtDias(f.maisAntiga)}</td></tr>)}</tbody></table></div></Bloco>
  </div>;
}

export function Nivel({ nivel }: { nivel: string }) { return <Badge variant="outline" className={cn("font-medium", nivel === "Alta" && "border-gold bg-gold/10", nivel === "Baixa" && "text-muted-foreground")}>{nivel}</Badge>; }
function participacaoMes(resumo: ResumoFamilia[]) { const top=resumo.filter(f=>f.criadas>0).slice(0,7); const demais=resumo.filter(f=>f.criadas>0).slice(7).reduce((s,f)=>s+f.criadas,0); return [...top.map(f=>({nome:f.familia,total:f.criadas})),...(demais?[{nome:"Demais famílias",total:demais}]:[])]; }
function FamilyBars({data,keys,stacked=false}:{data:any[];keys:string[];stacked?:boolean}) { return <ResponsiveContainer width="100%" height={Math.max(250,data.length*29)}><BarChart data={data} layout="vertical"><CartesianGrid horizontal={false} stroke={CORES.borda}/><XAxis type="number" allowDecimals={false} tick={{fontSize:10}}/><YAxis dataKey="familia" type="category" width={130} tick={{fontSize:10}}/><Tooltip contentStyle={chartTooltipStyle}/><Legend wrapperStyle={{fontSize:11}}/>{keys.map((k,i)=><Bar key={k} dataKey={k} name={k==="noPrazo"?"No prazo":k[0].toUpperCase()+k.slice(1)} stackId={stacked?"a":undefined} fill={k==="atrasadas"?CORES.atraso:[CORES.marca,CORES.ouro][i%2]}/>)}</BarChart></ResponsiveContainer>; }