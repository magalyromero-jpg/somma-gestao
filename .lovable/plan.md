# Plano — Operacional unificado

## Objetivo
Substituir as duas visões atuais por uma única página analítica em `/operacional`, mantendo o detalhe existente em `/operacional/:taskId` intacto e redirecionando `/operacional/principais` para a nova página.

## Estrutura
- Criar `src/pages/Operacional.tsx` como orquestrador único da consulta, sincronização, mês de referência, abas e painel de família.
- Criar `src/lib/operacional.ts` com tipos e funções puras para datas em São Paulo, classificação de prazo/idade/tipo, filtros e agregações de fila e fluxo.
- Adicionar `INICIO_HISTORICO = "2026-09-01"` em `src/lib/tarefas.ts`.
- Dividir a interface em componentes em `src/components/operacional/`: cabeçalho/filtros, aviso histórico, indicadores, gráficos/tabelas do Espelho, Famílias, Painel da Família, Tempo e carga e Relatórios semanais.

## Dados e regras
- Usar uma única consulta React Query, paginada com `fetchAll`, ordenada por `bitrix_id`, limitada às colunas e aos três status pedidos.
- Excluir tarefas sem prazo de todos os cálculos e exibir a contagem no rodapé do Espelho.
- Calcular fila sempre na situação atual; calcular fluxo somente desde 01/09/2026 e dentro do mês selecionado.
- Aplicar exatamente as definições de andamento, atraso, faixas de prazo, idade, família, tipo, prioridade, encerramento, prazo e série diária.
- Usar o maior `synced_at` como última sincronização; “Sincronizar agora” chama `bitrix-sync`, informa execução parcial e recarrega a consulta.

## Experiência
- Implementar as quatro abas: Espelho das demandas, Famílias, Tempo e carga e Relatórios semanais.
- No Espelho, aplicar busca, prioridade, filtros clicáveis cruzados, gráficos e listas solicitados, sem tabela geral de demandas.
- Em Famílias, combinar fluxo do mês com fila atual, incluindo indicadores, seis análises e tabela detalhada.
- Abrir o painel da família por `/operacional?familia=NOME`, com todos os blocos escopados e paginação de 40 demandas.
- Em Tempo e carga, apresentar comparativos por tipo/responsável, gestão interna, demandas paradas e qualidade do dado.
- Em Relatórios semanais, oferecer os modos gerencial e por usuário, seletores válidos, impressão/PDF e envio por e-mail desabilitado.
- Manter tabelas densas, cabeçalhos fixos, números tabulares e cores semânticas Somma, incluindo modo escuro.

## Rotas e limpeza
- Restringir `/operacional` a admin, gestor e analista.
- Redirecionar `/operacional/principais` para `/operacional` com preservação do controle de acesso.
- Não alterar `/operacional/:taskId` nem outras telas, salvo a mensagem de parcial e duração solicitada em `/sync-bitrix`.
- Após migrar imports e rotas, apagar `src/pages/OperacionalBitrix.tsx`, `src/pages/OperacionalPrincipais.tsx` e o componente antigo de abas se ficar sem uso.

## Validação
- Testar as funções puras de classificação/agregação.
- Verificar compilação e erros da prévia.
- Validar visualmente `/operacional`, painel de família, abas, sincronização e larguras desktop/mobile; confirmar que `/operacional/principais` redireciona e `/operacional/:taskId` permanece acessível.
