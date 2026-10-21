export type VigenciaLida = { descricao?: string; inicio: string | null; fim: string | null; valor_mensal: number | null; indice?: string | null; mes_reajuste?: number | null; degraus?: {a_partir:string;valor_mensal:number;motivo?:string;origem?:string}[] };
export type DadosLeitura = {tipo_documento?:string;data_documento?:string|null;confianca?:string;alertas?:string[];vigencias:VigenciaLida[];reajustes?:{data_efeito:string;valor_mensal:number}[];dia_vencimento?:number|null;retencao_pct?:number|null;descontos?:{descricao:string;valor_mensal?:number|null;inicio?:string|null;fim?:string|null}[];garagens?:string|null;observacoes?:string;trechos?:{campo:string;citacao:string}[]};
export type ConferenciaLeitura = {data:string;valor_documento:number;valor_anterior:number|null;previsto:number|null;regra:string|null;indice:string|null;percentual:number|null;estimado:boolean;ja_realizado:boolean;situacao:string;diferenca:number|null};
export type Leitura = {id:string;documento_id:string;contrato_id:string;status:string;dados:DadosLeitura;erro?:string;aplicado_em?:string;criado_em:string};
export const lerAutomaticamente=(nome:string,contrato:string|null)=>Boolean(contrato)&&/\.pdf$/i.test(nome)&&/(contrato|aditivo|termo)/.test(nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
export const situacaoLeitura=(documento:number,previsto:number|null)=>previsto===null?'sem_previsto':Math.abs(Math.round((documento-previsto)*100)/100)<=2?'confere':'diverge';
export const reajusteRealizado=(auditoria:{contrato_id:string;aniversario:string;valor_aplicado:number|null}[],contrato:string,data:string)=>auditoria.some(a=>a.contrato_id===contrato&&a.aniversario.slice(0,7)===data.slice(0,7)&&a.valor_aplicado!=null);
export function validarVigencia(v:VigenciaLida){
 if(!v.inicio||!v.fim||v.valor_mensal==null||!Number.isFinite(v.valor_mensal)||v.valor_mensal<0) return 'Preencha início, fim e valor mensal';
 if(v.fim<=v.inicio) return 'O fim deve ser posterior ao início';
 if(v.mes_reajuste!=null&&(v.mes_reajuste<1||v.mes_reajuste>12))return 'Mês de reajuste inválido';
 if(v.degraus?.some(d=>!d.a_partir||d.a_partir<v.inicio||d.a_partir>v.fim||!Number.isFinite(d.valor_mensal)||d.valor_mensal<0))return 'Confira as datas e valores dos degraus';
 return null;
}
