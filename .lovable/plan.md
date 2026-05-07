# Módulo Onboarding + Mapa Patrimonial + Diligência

Escopo grande: novo módulo completo, integração com Claude via edge function, persistência em Lovable Cloud, várias telas. Vou estruturar em fases para entrega coerente.

## Arquitetura

### Backend (Lovable Cloud)
Novas tabelas:
- `familias_onboarding` — id, nome, email_familia, sede, perfil, fonte, patrimonio_data (jsonb com schema completo), confianca, created_by, created_at, updated_at
- `familia_documentos` — id, familia_id, nome_arquivo, tipo, storage_path, recebido_em, categoria
- `familia_diligencia_itens` — id, familia_id, categoria, item_key, item_label, status (recebido/pendente/nao_recebido), imovel_ref (nullable), is_locacao, ordem

Bucket de storage: `familia-documentos` (privado, RLS por user_id criador).

RLS: criador (e admin/gestor) lê/escreve. Vou usar `has_role` existente + coluna `created_by`.

### Edge functions
- `extract-patrimonial` — recebe `familyName` + `files[]` (base64 pdf), chama **Lovable AI Gateway** com `google/gemini-2.5-pro` (suporta PDFs e raciocínio pesado), tool calling para garantir JSON do schema. Não usar Anthropic direto (sem créditos — já vimos esse erro antes). System prompt = o do brief, adaptado.
- `enrich-patrimonial` — recebe `existingData` + novo arquivo, prompt de enriquecimento, retorna JSON atualizado.

### Frontend

Rotas novas:
- `/onboarding` — wizard 3 passos
- `/familias-onboarding/:id` — Mapa da Família (4 abas)

Wizard `/onboarding`:
1. Passo 1: input nome família, botão Continuar (≥2 chars)
2. Passo 2: drag & drop multi-PDF (react-dropzone — adicionar dep), chips com check, botões "Analisar" e "Pular"
3. Passo 3: loading com steps animados sequenciais (1.2s cada), depois resumo extraído, botão "Abrir mapa da família"

Mapa da família (4 abas via shadcn Tabs):
- **Família** — hierarquia visual: titular destacado, cônjuge/dependentes, sócios externos. Badges coloridos por papel.
- **Holdings & Imóveis** — accordion por holding (sócios + imóveis integralizados). Seção "Imóveis na PF". Cada imóvel com badge de alerta.
- **Documentos** — Recebidos (lista) + Checklist Somma (componente de diligência expandido com todas as categorias do brief, accordion, barra de progresso geral, cards de resumo, categoria Imóveis com botão "+ Adicionar imóvel" e checkbox locação).
- **Diligência** — lista de imóveis ordenados por valor, badge prioridade, chips de docs faltantes, alertas automáticos.

Header: nome + cidade/UF, fonte, botão Relatório. Cards de resumo (patrimônio, qtd imóveis, qtd holdings, dividendos).

Email da família gerado automaticamente: `familia.<sobrenome>@sommainvestimentos.com.br`.

Adicionar item "Onboarding" no menu lateral (`AppLayout`).

### Tipos
`src/lib/onboarding/types.ts` com `PatrimonialData` exato do schema.

## Fases (entrega nesta loop)

1. Migração SQL (tabelas + RLS + bucket)
2. Edge functions `extract-patrimonial` e `enrich-patrimonial` (Lovable AI, sem Anthropic)
3. Tipos + hook `useOnboarding`
4. Wizard `/onboarding`
5. Tela `/familias-onboarding/:id` com 4 abas + componente Diligência
6. Item de menu + rotas em `App.tsx`

## Decisões técnicas

- **AI**: Lovable AI Gateway com `google/gemini-2.5-pro` (multimodal, PDFs nativos, sem custo de API key Anthropic). Tool calling com schema completo para JSON garantido.
- **Storage**: bucket privado, signed URLs para download.
- **Persistência**: dados extraídos salvos como `jsonb` único em `familias_onboarding.patrimonio_data` para flexibilidade; checklist e docs em tabelas relacionais para edição granular.
- **Estado de checklist**: derivado inicialmente de `checklist_documentos` da extração + imóveis; persistido em `familia_diligencia_itens` para permitir toggle manual.

## Observações

- Não vou alterar o módulo existente de Análise de Leilão.
- O e-mail `familia.<sobrenome>@...` é apenas exibição — não há infra de inbox.
- "Relatório ↗" será placeholder (toast "em breve") nesta primeira entrega, salvo se preferir já gerar PDF.
