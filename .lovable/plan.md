## Objetivo
Reorganizar abas do Mapa da Família, criar checklists para Holdings e Outros Bens (com geração automática ao processar IR) e adicionar nova seção de Veículos/Investimentos/Cripto/Exterior.

## Parte 1 — Renomeações de abas (`src/pages/MapaFamilia.tsx`)
- Aba `Diligência` → **Imóveis**
- Aba `Holdings & Imóveis` → **Holdings**
- Em `HoldingsTab`: remover sub-abas `Imóveis`, `Imóveis na PF`, `Imóveis na PJ`. Manter apenas conteúdo de holdings (sem `Tabs` interno).
- Atualizar texto auxiliar: "Documentos por imóvel ficam na aba **Imóveis**".

## Parte 2 — Checklist por Holding
**Banco** (`supabase--migration`):
```sql
CREATE TABLE public.checklist_holding (
  id uuid PK default gen_random_uuid(),
  holding_id text NOT NULL,
  familia_id uuid NOT NULL,  -- referencia familias_onboarding(id) (padrão usado nas outras checklists)
  item_id text NOT NULL,
  label text NOT NULL,
  opcional boolean DEFAULT false,
  status text DEFAULT 'pendente',
  documento_id uuid REFERENCES familia_documentos(id),
  data_recebimento timestamptz,
  notas text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(holding_id, familia_id, item_id)
);
-- RLS: mesmo padrão de checklist_imovel (acesso via familias_onboarding.created_by ou role gestor)
```
Observação: o spec menciona `familias(id)` e `documentos_cliente(id)`, mas o projeto usa `familias_onboarding` + `familia_documentos` — vou alinhar com o padrão existente.

**Constante** em novo arquivo `src/lib/onboarding/checklistHolding.ts` com `CHECKLIST_HOLDING`.

**Geração automática**: na etapa que processa IR e cria holdings (procurar em `OnboardingFamilia.tsx` / `enrich-patrimonial`), após salvar holdings, fazer upsert dos itens do checklist. Pular `tipo === "encerrada"`.

**UI** em `HoldingsTab` (MapaFamilia):
- Cada holding vira card expansível (`Collapsible`) com:
  - Header: razão social, CNPJ, badge tipo, contador `X/N documentos`.
  - Conteúdo: lista de itens do checklist com checkbox de status + botão "Anexar" (abre upload contextual existente, ou placeholder por ora vinculando a `familia_documentos`).

## Parte 3 — Outros Bens
**Banco**:
```sql
CREATE TABLE public.checklist_outros_bens (
  id uuid PK default gen_random_uuid(),
  familia_id uuid NOT NULL,
  bem_tipo text NOT NULL,        -- 'veiculo' | etc
  bem_ref_id text,
  bem_descricao text,
  item_id text NOT NULL,
  label text NOT NULL,
  opcional boolean DEFAULT false,
  status text DEFAULT 'pendente',
  documento_id uuid REFERENCES familia_documentos(id),
  data_recebimento timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(familia_id, bem_ref_id, item_id)
);
-- RLS análogo
```

**Constante** `CHECKLIST_VEICULO` em `src/lib/onboarding/checklistOutrosBens.ts`.

**Geração automática**: ao processar IR, iterar `dados.veiculos` (ignorando `alienado`) e fazer upsert.

**UI** — nova seção "Outros Bens" na aba **Família** (após Holdings) em `MapaFamilia.tsx`:
- **Veículos**: card por veículo com header (descrição, placa, ano, valor, titular) + checklist 0/2 com botões "Anexar".
- **Investimentos**: card resumo somando renda fixa, previdência, fundos, exterior — usa `data.investimentos`.
- **Criptoativos**: lista nome/valor + alerta visual se algum em recuperação judicial.
- **Bens no Exterior**: lista descrição/país/valor.

Sem checklist detalhado para investimentos/cripto/exterior nesta entrega.

## Parte 4 — Upload contextual
Reaproveitar fluxo de upload já existente em `familia_documentos`. Em cada item de checklist (holding ou veículo), botão "Anexar" abre input file → upload para storage `familia-documentos` no path `{familia_id}/holdings/{holding_id}/{item_id}-{filename}` (ou `outros/{bem_ref_id}/...`), insere em `familia_documentos`, e atualiza `documento_id` + `status='recebido'` + `data_recebimento` no item.

## Parte 5 — Audit Log
**Nota**: o título menciona "Audit Log" mas o corpo da spec não detalha campos/escopo. Vou registrar mudanças de status de checklist (holding + outros bens) em uma tabela genérica `audit_log` (familia_id, entidade, entidade_id, acao, antes, depois, autor_id, created_at) e logar via trigger ou no client. **Pergunta a confirmar**: o usuário quer escopo amplo ou só checklists? Vou implementar só checklists por enquanto e perguntar depois se precisa expandir.

## Ordem de execução
1. Migration (cria 2 tabelas + RLS + audit_log).
2. Constantes de checklist.
3. Hook de criação automática no processamento de IR.
4. Renomear abas e remover sub-abas.
5. Implementar UI de checklist em HoldingsTab.
6. Implementar seção Outros Bens.
7. Componente de upload reutilizável.
8. QA visual no preview.