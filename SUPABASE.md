# Supabase — configuração de produção

Este documento complementa o código em `supabase/migrations/`. Use sempre a **anon key** no frontend e a **service_role** apenas em ambientes seguros (servidor, CI, Edge Functions), **nunca** no bundle Vite/React.

## 1. Criar o projeto

1. Acesse [https://supabase.com](https://supabase.com) e crie um projeto (região próxima ao Brasil, ex. `South America`).
2. Anote **Project URL** e **anon public** em *Settings → API*.

## 2. Aplicar SQL (tabelas + funções)

No **SQL Editor**, execute **nesta ordem**:

1. `supabase/migrations/0001_schema.sql` — tabelas, enums, RPC `register_store` e `checkout_catalog_order`, sequência de pedidos.
2. `supabase/migrations/0002_rls.sql` — RLS, grants, view implícita na política de `stores` (catálogo usa `catalog_stores_v` + leitura pública controlada).
3. `supabase/migrations/0003_storage.sql` — bucket `store-assets` e políticas de objeto.
4. **`supabase/migrations/0004_catalog_rls_fix.sql`** — obrigatório: corrige o catálogo público para listar produtos (função `store_catalog_is_live`; políticas antigas referenciavam `stores` sem permissão de `SELECT` para o papel `anon`).

Se a loja e o cabeçalho do catálogo aparecem, mas **nenhum produto** lista, é quase sempre porque o passo 4 ainda não foi aplicado em projetos criados antes desta migração.

5. `supabase/migrations/0010_whatsapp.sql` — instância WhatsApp por loja (Evolution API), log de mensagens, view segura sem token.
6. `supabase/migrations/0011_whatsapp_safe_rpc.sql` — RPC `get_store_whatsapp_instance_safe`.
7. `supabase/migrations/0013_whatsapp_templates_group.sql` — templates por status (`notify_settings`), grupo de pedidos na loja, `app_base_url`, log `recipient_kind`.

Se preferir CLI: `supabase db push` (com projeto linkado).

## 3. Políticas RLS (resumo)

- **Tenant**: tabelas com `store_id` só são lidas/escritas por usuários presentes em `store_users` da mesma loja (via `is_store_member`).
- **Catálogo público**: papel `anon` (e `authenticated` visitante) lê `catalog_stores_v`, produtos ativos, categorias, imagens e variações conforme políticas em `0002_rls.sql`.
- **Pedido checkout**: função `SECURITY DEFINER` `checkout_catalog_order` — chamada com **anon** ou **authenticated**, sem expor `service_role` no navegador.
- **Contadores de pedido**: `store_order_counters` bloqueado para clientes; só funções internas alteram.

## 4. Autenticação

- *Authentication → Providers*: habilite **Email**.
- Para desenvolvimento rápido: *Authentication → Providers → Email* desative **Confirm email** (ou confirme o e-mail após cada cadastro em produção).
- **Recuperar senha**: o app chama `resetPasswordForEmail`; em *Authentication → URL Configuration* cadastre `Site URL` e `Redirect URLs` (ex. `http://localhost:5173/login`).

## 5. Storage

1. *Storage → New bucket* → nome: **`store-assets`** (público se quiser URLs diretas; em produção avalie URLs assinadas).
2. Execute `0003_storage.sql` (cria bucket se não existir e políticas).
3. Estrutura de pastas usada pelo app: `{store_id}/logo.ext`, `{store_id}/products/{productId}/arquivo`.

## 6. Variáveis de ambiente (frontend)

Crie `.env` na raiz (veja `.env.example`):

| Variável | Onde obter | Uso |
|----------|-------------|-----|
| `VITE_SUPABASE_URL` | Dashboard → API → Project URL | `getSupabaseBrowserClient()` / catálogo |
| `VITE_SUPABASE_ANON_KEY` | Dashboard → API → anon **public** | Mesmo cliente; respeita RLS |

**Onde informar no código**: `src/integrations/supabase/env.ts` lê `import.meta.env.VITE_*` (padrão Vite).

## 7. O que nunca vai para o frontend

- **`service_role` secret**: ignora RLS; vazou = vazamento total do banco. Use só em backend, scripts administrativos ou Edge Functions com segredo.
- **Chaves de API de terceiros** sensíveis: mesmo princípio (ex.: `EVOLUTION_API_KEY`, token por instância WhatsApp).

## 7.1 WhatsApp (Evolution API) — Edge Functions

Após aplicar as migrações WhatsApp (`0010`, `0011`, `0013`), faça o deploy das funções em `supabase/functions/`:

```bash
supabase login
supabase functions deploy whatsapp-admin --project-ref SEU_PROJECT_REF
supabase functions deploy whatsapp-webhook --project-ref SEU_PROJECT_REF
supabase functions deploy whatsapp-check --project-ref SEU_PROJECT_REF
supabase functions deploy whatsapp-send --project-ref SEU_PROJECT_REF
supabase functions deploy whatsapp-notify-checkout --project-ref SEU_PROJECT_REF --no-verify-jwt
```

Ou gere o bundle local e publique com token (recomendado se `supabase login` falhar no navegador):

```bash
node scripts/bundle-whatsapp-edge.mjs whatsapp-admin
node scripts/publish-edge-from-bundle.mjs whatsapp-admin
```

Ou no PowerShell (lê o token do `.env`):

```powershell
.\scripts\deploy-whatsapp-admin.ps1
.\scripts\deploy-whatsapp-all.ps1
```

### Login do CLI (`supabase login`) não abre ou dá "Unable to create CLI sign-in"

Isso é um problema conhecido (navegador, extensões, rede ou sessão no dashboard). **Use um Personal Access Token** em vez do fluxo pelo browser:

1. Abra [https://supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) (logado na conta certa).
2. **Generate new token** → copie o valor (começa com `sbp_`).
3. No PowerShell, na pasta do projeto:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_COLE_SEU_TOKEN_AQUI"
node scripts/bundle-whatsapp-edge.mjs whatsapp-admin
node scripts/publish-edge-from-bundle.mjs whatsapp-admin
```

Alternativa equivalente:

```powershell
npx supabase login --token sbp_COLE_SEU_TOKEN_AQUI
npx supabase functions deploy whatsapp-admin --project-ref hacpynysbnetrsxaekxz
```

Dicas se o browser ainda for necessário: aba anônima, desative bloqueadores de anúncio na página `supabase.com`, ou tente outro navegador. O token **não** vai para o `.env` do frontend — só na sessão do terminal ou em variável de ambiente local para deploy.

Ou gere bundles das demais funções:

```bash
node scripts/bundle-whatsapp-edge.mjs whatsapp-send
node scripts/bundle-whatsapp-edge.mjs whatsapp-notify-checkout
node scripts/bundle-whatsapp-edge.mjs whatsapp-webhook
```

Em *Project Settings → Edge Functions → Secrets*, configure:

| Secret | Exemplo |
|--------|---------|
| `EVOLUTION_API_URL` | `https://whats.sofashop.digital` |
| `EVOLUTION_API_KEY` | chave global da Evolution (header `apikey`) |
| `APP_PUBLIC_URL` | (opcional) URL pública do app, ex. `https://app.sofashop.digital` — fallback para links de pedido no grupo quando o admin ainda não salvou `app_base_url` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pelo Supabase.

O painel usa a aba **WhatsApp** em `/admin/configuracoes` (templates `{{NOME_CLIENTE}}`, `{{NUMERO_PEDIDO}}`, `{{STATUS_PEDIDO}}`). O checkout dispara `whatsapp-notify-checkout` (cliente + grupo interno); não abre mais `wa.me`.

## 8. Conectar o app ao Supabase

1. Copie `.env.example` → `.env`.
2. Preencha URL + anon key.
3. `npm install` e `npm run dev`.
4. Cadastre uma loja em `/cadastro` (cria usuário Auth + loja + categorias iniciais via RPC).

## 9. Deploy (ex.: Vercel)

- *Build command*: `npm run build`
- *Output directory*: `dist`
- Configure as mesmas variáveis `VITE_*` no painel do host.
- `vercel.json` inclui rewrite SPA para rotas do React Router.

## 10. Dúvidas comuns

- **Multi-loja**: cada linha de `stores` é um tenant; `store_users` liga `auth.users` à loja.
- **Catálogo sem login**: o app usa `getSupabaseCatalogClient()` (sem persistir sessão) nas leituras públicas + RPC de checkout com anon.
- **Isolamento**: RLS + funções definer + ausência de service_role no browser garantem que uma loja não acessa dados de outra.
