# Multa e Juros no Realizado
- [x] Criar view de encargos sem duplicar pagamentos importados.
- [x] Compartilhar totais entre Fluxo de Caixa e Visão Geral e conferir julho/2026: Multa 132,75, Juros 82,02; acumulado 5.427.073,10 em ambas as telas, inclusive visualização Cliente; outubro aguarda importação.

# Proteção Bitrix
- [ ] Guardar webhook em secret e remover acesso ao valor nas três funções e na tela.
- [ ] Remover registro legado e restringir configurações sensíveis.
- [ ] Verificar status, teste real de conexão e permissões.

# Visual do portal
- [x] Implementar leitura PDF restrita a Admin/Gestor e proposta revisável.
- [x] Implementar aplicação protegida e conferência com valores da base; Orçado conferido em R$ 6.855.976,20.
- [ ] Conferir leitura concluída, revisão, descarte e aplicação: bloqueado por saldo insuficiente na Anthropic; teste real exibiu o erro sem alterar contrato ou arquivo.
- [x] Ajustar Reforecast aos 12 meses contratuais, diferenças e motivos; 18 testes e tela conferidos, preservando os valores retornados pelo banco.
- [x] Aplicar tokens e tipografia do modelo em todo o sistema.
- [x] Ajustar menu, blocos, indicadores e disposição do Zen Tower.
- [x] Conferir telas e navegação com dados reais.

# Zen Tower sem documentos
- [x] Retirar aba, exibição e upload de documentos sem alterar o banco.
- [x] Manter conferência de metragem e importação de pagamentos, rejeitando PDF/ZIP.
- [x] Conferir o portal com dados reais e executar os testes de pagamentos.

# Autenticação Somma MFO
- [x] Trocar os logotipos das três telas claras pela versão escura, mantendo o branco no painel escuro e na sidebar.
- [x] Verificar as três telas de autenticação: logotipos escuros carregados, título Somma MFO e nenhum erro de página.
- [ ] Personalizar os e-mails e o remetente: depende da configuração do domínio e do envio do modelo email_convite_somma.html.
- [ ] Informar os registros DNS reais após a configuração do domínio.