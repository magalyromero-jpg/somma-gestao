import {describe,it,expect} from 'vitest';
import {lerAutomaticamente,reajusteRealizado,situacaoLeitura,validarVigencia} from './leituraDocumento';
describe('leitura de documentos',()=>{
 it('aceita PDF contratual de imóvel',()=>expect(lerAutomaticamente('TÉRMO ADITIVO.pdf','contrato')).toBe(true));
 it('não lê DOCX automaticamente',()=>expect(lerAutomaticamente('contrato.docx','contrato')).toBe(false));
 it('não lê Garagens sem contrato',()=>expect(lerAutomaticamente('contrato.pdf',null)).toBe(false));
 it('não lê vistoria automaticamente',()=>expect(lerAutomaticamente('vistoria.pdf','contrato')).toBe(false));
 it('confere até R$ 2,00',()=>expect(situacaoLeitura(18700.17,18698.17)).toBe('confere'));
 it('diverge acima de R$ 2,00',()=>expect(situacaoLeitura(18700.18,18698.17)).toBe('diverge'));
 it('sem valor da base não confere',()=>expect(situacaoLeitura(18698.17,null)).toBe('sem_previsto'));
 it('reajuste realizado sai dos próximos pelo mês do aniversário',()=>expect(reajusteRealizado([{contrato_id:'bradesco',aniversario:'2026-10-01',valor_aplicado:18698.17}],'bradesco','2026-10-20')).toBe(true));
 it('reajuste pendente permanece nos próximos',()=>expect(reajusteRealizado([{contrato_id:'bradesco',aniversario:'2026-10-01',valor_aplicado:null}],'bradesco','2026-10-20')).toBe(false));
 it('não confunde contratos no mesmo mês',()=>expect(reajusteRealizado([{contrato_id:'outro',aniversario:'2026-10-01',valor_aplicado:18698.17}],'bradesco','2026-10-20')).toBe(false));
 it('fim deve ser posterior ao início',()=>expect(validarVigencia({inicio:'2026-10-01',fim:'2026-10-01',valor_mensal:18698.17})).not.toBeNull());
 it('degrau deve pertencer à vigência',()=>expect(validarVigencia({inicio:'2026-10-01',fim:'2027-10-01',valor_mensal:18698.17,degraus:[{a_partir:'2027-11-01',valor_mensal:20000}]})).not.toBeNull());
});
