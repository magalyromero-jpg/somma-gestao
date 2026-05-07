
# Escopo

Duas frentes independentes, entregues no mesmo ciclo:

1. **Gestão de usuários** com convite por email, reset de senha e 3 perfis (admin/gestor/analista).
2. **Tela de imóveis redesenhada** sobre `imoveis_cliente` + `checklist_imovel`, com aba que preserva o acesso ao Lidderar atual.

Para a Parte 3 (convite), assumindo o caminho default: edge function `invite-user` usando service role + templates de email padrão do Supabase. Customização de templates fica como passo opcional posterior.

---

# Parte 1 — Gestão de usuários

## Banco

- Estender enum `app_role`: adicionar `'admin'` e `'analista'` (mantém `'gestor'` e `'familia'`).
- Migrar usuários atuais com role `'gestor'` para `'admin'` (admin = pode convidar; gestor = acesso total exceto gestão de usuários).
- Função `has_role()` continua funcionando sem mudanças.
- Adicionar coluna `status` em `profiles` (`pendente` | `ativo` | `inativo`, default `pendente`).
- Trigger `on_auth_user_email_confirmed`: ao confirmar email, marca `profiles.status = 'ativo'`.
- Política nova em `user_roles`: admins podem gerenciar roles; gestores apenas leem.

## Edge function `invite-user`

- Verifica que o chamador é `admin` (via JWT + `has_role`).
- Valida payload com zod (`nome`, `email`, `perfil`).
- Chama `auth.admin.inviteUserByEmail` com `redirectTo = {SITE_URL}/auth/set-password` e metadata `{ nome_completo, perfil }`.
- Insere/atualiza `profiles` (nome, email, status `pendente`) e `user_roles` (perfil escolhido).

## Frontend

- Nova rota `/configuracoes/usuarios` (protegida — só admin).
- Item adicional no menu (ou subnav dentro de Configurações).
- Tabela: Nome · Email · Perfil · Status · ações (mudar perfil, desativar/reativar).
- Modal "Convidar usuário": nome, email, select de perfil. Submit → `supabase.functions.invoke('invite-user', ...)`.
- Páginas públicas:
  - `/auth/forgot-password` — formulário de email + `resetPasswordForEmail`.
  - `/auth/reset-password` — captura recovery do hash, `updateUser({ password })`.
  - `/auth/set-password` — primeiro acesso via convite, mesmo fluxo.
- Link "Esqueci minha senha" na tela de Login.

---

# Parte 2 — Tela de imóveis

## Rota `/imoveis` redesenhada com tabs

```text
[ Imóveis dos clientes ]   [ Lidderar (sincronizados) ]
```

A aba "Lidderar (sincronizados)" mantém o conteúdo atual da página, intocado, para não perder operação. A aba default é "Imóveis dos clientes".

## Aba "Imóveis dos clientes"

- Header: filtros (família, status do checklist, busca) + botão "+ Adicionar imóvel" (manual).
- 4 cards de KPI: total imóveis, docs recebidos (X/Y + %), imóveis 100% completos, total de alertas.
- Lista ordenada por `valor_declarado` desc. Cada card:
  - Nome + endereço + valor.
  - Família + holding/PJ.
  - Barra de progresso (verde/amarelo/laranja/vermelho) com `recebidos/total`.
  - Badges: prioritário (top 3 valor) + `forma_aquisicao`.
- Query: `imoveis_cliente` join `familias_onboarding(nome)` + `checklist_imovel(*)`. Progresso calculado client-side com helper já existente em `checklistImovel.ts`.

## Detalhe `/imoveis/cliente/:id`

Para não conflitar com a rota Lidderar atual (`/imoveis/:codImovel`), a rota do cliente fica em `/imoveis/cliente/:id`.

Três seções:

1. **Resumo** — endereço completo, área, matrícula, cartório, data aquisição, forma, titularidade, alertas.
2. **Checklist** — três grupos (Recebidos / Pendentes / N/A). Botão "+ Anexar" em cada pendente: upload para bucket `familia-documentos`, marca item como recebido (`status='recebido'`, `data_recebimento=now()`, `documento_id`), opcional dispara `enrich-patrimonial` se PDF.
3. **Análise do documento** — lista `familia_documentos` ligados ao imóvel, mostra dados extraídos do `patrimonio_data` da família. Documentos não processados ganham botão "Processar documento" → invoca `enrich-patrimonial`.

---

# Detalhes técnicos

## Migrations
- `ALTER TYPE app_role ADD VALUE 'admin'` + `'analista'` (em transações separadas).
- `UPDATE user_roles SET role='admin' WHERE role='gestor'`.
- `ALTER TABLE profiles ADD COLUMN status TEXT NOT NULL DEFAULT 'pendente'`.
- Trigger `AFTER UPDATE ON auth.users WHEN OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL`.
- RLS: novas policies em `user_roles` para admins; manter policy "Usuario ve seus roles".

## Edge functions
- `supabase/functions/invite-user/index.ts` — service role client, valida admin, chama `inviteUserByEmail`.
- Reaproveita `LOVABLE_API_KEY`/`SUPABASE_SERVICE_ROLE_KEY` já existentes.

## Frontend
- `src/pages/auth/ForgotPassword.tsx`, `ResetPassword.tsx`, `SetPassword.tsx`.
- `src/pages/configuracoes/Usuarios.tsx`.
- `src/pages/ImoveisCliente.tsx` (lista, dentro da aba) + `src/pages/ImovelClienteDetalhe.tsx`.
- Refator de `Imoveis.tsx` para envolver Tabs.
- Rotas atualizadas em `App.tsx`. Rotas `/auth/*` ficam fora do `ProtectedRoute`.

## Fora de escopo (proposto)
- Customização branded dos emails de auth (Lovable Emails) — pode ser próximo passo.
- Função "desativar usuário" via Supabase admin (não há API direta; faremos via flag `status='inativo'` que bloqueia login no `AuthContext`).

---

# Ordem de execução

1. Migration (enum + status + trigger + policies).
2. Edge function `invite-user`.
3. Páginas auth (forgot/reset/set-password) + link no Login.
4. Página `/configuracoes/usuarios` + modal convite.
5. Refator `/imoveis` com Tabs (preservando Lidderar).
6. Lista de imóveis cliente + KPIs.
7. Detalhe + checklist + upload + análise.
