import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { brl, dt, indiceLabel } from '@/lib/locacoes';
import { Leitura, VigenciaLida, ConferenciaLeitura, validarVigencia } from '@/lib/leituraDocumento';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
const db=supabase as any;
function Campo({nome,children,mudou=false}:{nome:string;children:React.ReactNode;mudou?:boolean}) {return <div className={cn('space-y-1',mudou&&'rounded border border-warning p-2')}><Label className="text-xs">{nome}</Label>{children}</div>;}
export function PropostaDocumento({leitura,nome,imovel,data,onFechar}:{leitura:Leitura;nome:string;imovel:string;data:any;onFechar:()=>void}){
 const qc=useQueryClient(), [ocupado,setOcupado]=useState(false),[erro,setErro]=useState(''),[resultado,setResultado]=useState<any>(null);
 const atuais=(data.vigencias??[]).filter((v:any)=>v.contrato_id===leitura.contrato_id);
 const contrato=(data.contratosInfo??[]).find((c:any)=>c.id===leitura.contrato_id);
 const [vigencias,setVigencias]=useState(()=> (leitura.dados.vigencias??[]).map(v=>({...v,aplicar:!atuais.some((a:any)=>a.inicio===v.inicio&&a.no_orcamento),degraus:v.degraus??[]})));
 const [dia,setDia]=useState(leitura.dados.dia_vencimento??null),[ret,setRet]=useState(leitura.dados.retencao_pct??null);
 const [usarDia,setUsarDia]=useState(dia!=null&&dia!==contrato?.dia_vencimento),[usarRet,setUsarRet]=useState(ret!=null&&ret!==Number(contrato?.retencao_pct));
 const [marcadas,setMarcadas]=useState<Record<string,boolean>>({});
 const payloadConferencia={...leitura.dados,vigencias:vigencias.filter(v=>v.aplicar)};
 const {data:conferencia,isFetching,error:erroConferencia}=useQuery<ConferenciaLeitura[]>({queryKey:['loc-conferencia-leitura',leitura.id,payloadConferencia],queryFn:async()=>{const r=await db.rpc('loc_conferir_leitura',{p_leitura:leitura.id,p_dados:payloadConferencia});if(r.error)throw r.error;return r.data??[];}});
 const chave=(r:ConferenciaLeitura)=>`${r.data}:${r.valor_documento}`;
 const marcada=(r:ConferenciaLeitura)=>marcadas[chave(r)]??(!r.ja_realizado&&r.situacao!=='sem_previsto');
 const editar=(i:number,p:Partial<VigenciaLida>)=>setVigencias(v=>v.map((x,j)=>i===j?{...x,...p}:x));
 const terminar=async(descartar=false)=>{
  setErro(''); if(isFetching||erroConferencia)return setErro('Aguarde a conferência dos valores');
  const escolhidas=vigencias.filter(v=>v.aplicar);
  if(!descartar){for(const v of escolhidas){const e=validarVigencia(v);if(e)return setErro(e);}}
  setOcupado(true);
  try{
   if(descartar){const r=await db.from('loc_leituras_documento').update({status:'descartada'}).eq('id',leitura.id).eq('status','pendente');if(r.error)throw r.error;onFechar();}
   else{
    const r=await db.rpc('loc_aplicar_leitura',{p_leitura:leitura.id,p_dados:{vigencias:escolhidas.map(v=>({...v,data_documento:leitura.dados.data_documento??null,degraus:v.degraus.map(d=>({...d,origem:d.origem??'degrau'}))})),reajustes:(conferencia??[]).filter(marcada).map(r=>({data:r.data,valor_documento:r.valor_documento})),contrato:{dia_vencimento:usarDia?dia:null,retencao_pct:usarRet?ret:null}}});if(r.error)throw r.error;setResultado(r.data);
    await qc.invalidateQueries({predicate:q=>String(q.queryKey[0]).startsWith('loc-')});
   }
   await qc.invalidateQueries({queryKey:['loc-leituras',data.edificio.id]});
  }catch(e){setErro((e as Error).message);}finally{setOcupado(false);}
 };
 return <Dialog open onOpenChange={o=>!o&&!ocupado&&onFechar()}><DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto op-theme zen-portal"><DialogHeader><DialogTitle>Proposta de Atualização</DialogTitle><DialogDescription className="break-all">{nome} · {imovel}</DialogDescription></DialogHeader>
 {resultado?<div className="space-y-3"><p className="text-sm text-success">Atualização aplicada: {resultado.inseridas} vigências novas, {resultado.atualizadas} atualizadas, {resultado.protegidas} protegidas (Orçado). {resultado.realizados} reajustes marcados como realizados.</p>{(resultado.avisos??[]).map((a:string,i:number)=><p key={i} className="op-tag op-tag-amber block whitespace-normal">{a}</p>)}<Button onClick={onFechar}>Fechar</Button></div>:<>
 <div className="flex flex-wrap gap-2 text-xs"><span>{leitura.dados.tipo_documento} · {dt(leitura.dados.data_documento)}</span><span className={cn('op-tag',leitura.dados.confianca==='alta'?'op-tag-green':'op-tag-amber')}>Confiança {leitura.dados.confianca}</span></div>
 {(leitura.dados.alertas??[]).map((a,i)=><p key={i} className="op-tag op-tag-amber block whitespace-normal">{a}</p>)}
 <section className="space-y-3"><h3 className="text-sm font-semibold">Conferência com o Previsto</h3>{isFetching&&<p className="text-xs text-muted-foreground">Conferindo…</p>}{erroConferencia&&<p className="text-xs text-destructive">{(erroConferencia as Error).message}</p>}
 {!!conferencia?.length&&<div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Reajuste a Partir de','Regra','Previsto','No Documento','Diferença','Situação','Marcar como Realizado'].map(h=><th key={h} className="border-b p-2 text-left">{h}</th>)}</tr></thead><tbody>{conferencia.map(r=><tr key={chave(r)}><td className="border-b p-2">{dt(r.data)}</td><td className="border-b p-2">{r.regra??'—'}</td><td className="border-b p-2">{brl(r.previsto)}</td><td className="border-b p-2">{brl(r.valor_documento)}</td><td className="border-b p-2">{brl(r.diferenca)}</td><td className="border-b p-2"><span className={cn('op-tag',r.situacao==='confere'?'op-tag-green':r.situacao==='diverge'?'op-tag-amber':'op-tag-gray')}>{r.situacao==='confere'?'Confere':r.situacao==='diverge'?'Diverge':'Sem Previsão'}</span>{r.estimado&&<p className="mt-1 text-muted-foreground">Previsto estimado: índice ainda não publicado</p>}{r.ja_realizado&&<p className="mt-1 text-muted-foreground">Já Realizado</p>}</td><td className="border-b p-2"><Checkbox aria-label={`Marcar como Realizado ${dt(r.data)}`} checked={marcada(r)} onCheckedChange={v=>setMarcadas(x=>({...x,[chave(r)]:Boolean(v)}))}/></td></tr>)}</tbody></table></div>}
 {!isFetching&&!conferencia?.length&&<p className="text-xs text-muted-foreground">Nenhum valor para conferir.</p>}</section>
 <section className="space-y-3"><h3 className="text-sm font-semibold">Vigências</h3>{vigencias.map((v,i)=>{const atual=atuais.filter((a:any)=>a.inicio===v.inicio).sort((a:any,b:any)=>b.seq-a.seq)[0]; const protegida=atuais.some((a:any)=>a.inicio===v.inicio&&a.no_orcamento);return <div key={i} className="rounded-md border p-3 space-y-3">
 <div className="flex items-center justify-between gap-2"><label className="flex items-center gap-2 text-xs"><Checkbox checked={v.aplicar&&!protegida} disabled={protegida} onCheckedChange={b=>setVigencias(x=>x.map((a,j)=>j===i?{...a,aplicar:Boolean(b)}:a))}/>Aplicar Esta Vigência</label><span className={cn('op-tag',protegida?'op-tag-amber':'op-tag-gray')}>{protegida?'Faz Parte do Orçado':atual?'Atualiza':'Nova'}</span></div>
 <div className="grid gap-3 md:grid-cols-[1fr_2fr]"><div className="text-xs space-y-2"><h4 className="font-medium">Hoje no Portal</h4>{atual?<><p>{dt(atual.inicio)} a {dt(atual.fim)}</p><p>{brl(atual.valor_mensal)} · {indiceLabel(atual.indice)}</p><p>Mês de Reajuste: {atual.mes_reajuste??'—'}</p></>:<p>Sem vigência com este início</p>}</div><div className="space-y-2"><h4 className="text-xs font-medium">No Documento</h4><div className="grid gap-2 sm:grid-cols-2">
 <Campo nome="Início" mudou={!!atual&&atual.inicio!==v.inicio}><Input aria-label={`Início ${i+1}`} type="date" value={v.inicio??''} onChange={e=>editar(i,{inicio:e.target.value})}/></Campo>
 <Campo nome="Fim" mudou={!!atual&&atual.fim!==v.fim}><Input aria-label={`Fim ${i+1}`} type="date" value={v.fim??''} onChange={e=>editar(i,{fim:e.target.value})}/></Campo>
 <Campo nome="Valor Mensal (R$)" mudou={!!atual&&Number(atual.valor_mensal)!==v.valor_mensal}><Input aria-label={`Valor Mensal ${i+1}`} type="number" min="0" step="0.01" value={v.valor_mensal??''} onChange={e=>editar(i,{valor_mensal:e.target.value===''?null:Number(e.target.value)})}/></Campo>
 <Campo nome="Índice" mudou={!!atual&&atual.indice!==v.indice}><Select value={v.indice??'NENHUM'} onValueChange={s=>editar(i,{indice:s})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['IPCA','IGPM','FIXO','MEDIA','NENHUM'].map(s=><SelectItem key={s} value={s}>{indiceLabel(s)}</SelectItem>)}</SelectContent></Select></Campo>
 <Campo nome="Mês de Reajuste (1 a 12)" mudou={!!atual&&atual.mes_reajuste!==v.mes_reajuste}><Input type="number" min="1" max="12" value={v.mes_reajuste??''} onChange={e=>editar(i,{mes_reajuste:e.target.value===''?null:Number(e.target.value)})}/></Campo></div></div></div>
 <div className="space-y-2"><div className="flex items-center justify-between"><h4 className="text-xs font-medium">Degraus</h4><Button variant="outline" size="sm" onClick={()=>editar(i,{degraus:[...v.degraus,{a_partir:'',valor_mensal:0}]})}><Plus/>Adicionar</Button></div>{v.degraus.map((d,j)=><div key={j} className="grid grid-cols-[1fr_1fr_auto] gap-2"><Input aria-label="A Partir de" type="date" value={d.a_partir} onChange={e=>editar(i,{degraus:v.degraus.map((a,k)=>k===j?{...a,a_partir:e.target.value}:a)})}/><Input aria-label="Valor do Degrau" type="number" min="0" step="0.01" value={d.valor_mensal} onChange={e=>editar(i,{degraus:v.degraus.map((a,k)=>k===j?{...a,valor_mensal:Number(e.target.value)}:a)})}/><Button variant="ghost" size="icon" aria-label="Remover Degrau" onClick={()=>editar(i,{degraus:v.degraus.filter((_,k)=>k!==j)})}><Trash2/></Button></div>)}</div>
 <p className="text-xs text-muted-foreground">Entra no Reforecast e na Projeção. Não altera o Orçado.</p>{protegida&&<p className="text-xs text-warning">Esta vigência não será alterada</p>}
 </div>;})}</section>
 <section className="space-y-2"><h3 className="text-sm font-semibold">Vigências Hoje no Portal</h3>{atuais.map((v:any)=><p key={v.id} className="text-xs">{dt(v.inicio)} a {dt(v.fim)} · {brl(v.valor_mensal)}</p>)}</section>
 <section className="space-y-3"><h3 className="text-sm font-semibold">Contrato</h3><div className="grid gap-3 sm:grid-cols-2"><Campo nome="Dia de Vencimento"><p className="text-xs">Hoje: {contrato?.dia_vencimento??'—'} · No Documento</p><Input type="number" min="1" max="31" value={dia??''} onChange={e=>setDia(e.target.value===''?null:Number(e.target.value))}/><label className="flex gap-2 items-center text-xs"><Checkbox checked={usarDia} onCheckedChange={b=>setUsarDia(Boolean(b))}/>Atualizar Dia de Vencimento</label></Campo><Campo nome="Retenção (%)"><p className="text-xs">Hoje: {contrato?.retencao_pct??'—'} · No Documento</p><Input type="number" min="0" max="100" step="0.01" value={ret??''} onChange={e=>setRet(e.target.value===''?null:Number(e.target.value))}/><label className="flex gap-2 items-center text-xs"><Checkbox checked={usarRet} onCheckedChange={b=>setUsarRet(Boolean(b))}/>Atualizar Retenção</label></Campo></div></section>
 {(leitura.dados.descontos?.length||leitura.dados.garagens||leitura.dados.observacoes)&&<section className="text-xs space-y-2"><h3 className="text-sm font-semibold">Descontos e Garagens</h3>{leitura.dados.descontos?.map((d,i)=><p key={i}>{d.descricao} · {brl(d.valor_mensal)} · {dt(d.inicio)} a {dt(d.fim)}</p>)}<p>{leitura.dados.garagens}</p><p>{leitura.dados.observacoes}</p></section>}
 <details className="text-xs"><summary className="cursor-pointer font-medium">Trechos do Documento</summary>{leitura.dados.trechos?.map((t,i)=><blockquote key={i} className="border-l p-2 mt-2"><strong>{t.campo}</strong>: {t.citacao}</blockquote>)}</details>
 {erro&&<p role="alert" className="text-sm text-destructive">{erro}</p>}
 <DialogFooter><Button variant="outline" disabled={ocupado} onClick={onFechar}>Fechar</Button><Button variant="outline" disabled={ocupado} onClick={()=>terminar(true)}>Descartar</Button><Button disabled={ocupado||isFetching||!!erroConferencia} onClick={()=>terminar()}>{ocupado?'Aplicando…':'Aplicar no Portal'}</Button></DialogFooter>
 </>}
 </DialogContent></Dialog>;
}
