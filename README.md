# SofáShop — catálogo multi-loja + painel (React + Vite + Tailwind + Supabase)

Aplicação **production-ready** para lojas de sofás (e linha complementar: puffs, camas, bicamas): catálogo público com carrinho, checkout, pedido persistido, redirecionamento para **WhatsApp** com mensagem montada, painel administrativo (dashboard, produtos, pedidos, clientes, financeiro, configurações) e **PDF** do pedido (A4, jsPDF).

## Requisitos

- Node.js **18+** (testado com build em Vite 5).
- Conta [Supabase](https://supabase.com).

## Rodar localmente

```bash
cp .env.example .env
# Edite .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

Aplique os SQL em `supabase/migrations/` antes de usar o app (ver `SUPABASE.md`).

## Estrutura do projeto

```
src/
  components/ui/       # Botões, inputs, cards, etc.
  pages/               # Rotas (marketing, auth, catálogo público, admin)
  contexts/            # Auth + carrinho (localStorage por loja)
  hooks/               # useMyStore, etc.
  services/            # Checkout, PDF, mensagem WhatsApp, catálogo
  integrations/        # Supabase (2 clientes), ViaCEP
  lib/                 # cn, máscaras, validadores CPF/CNPJ/telefone, format
  types/               # Tipos de domínio / DB parciais
  constants/           # Status de pedido, pagamentos, modelos de sofá
supabase/migrations/   # Schema, RLS, Storage
```

## Fluxos principais

1. **Cadastro da loja** (`/cadastro`): `auth.signUp` → RPC `register_store` (loja + owner + categorias iniciais) → upload opcional da logo no bucket `store-assets`.
2. **Catálogo** (`/loja/:slug`): leitura via cliente **anon** (`getSupabaseCatalogClient`) + view `catalog_stores_v` (sem expor CPF/CNPJ a visitantes).
3. **Carrinho / checkout**: itens no `localStorage`; `checkout_catalog_order` grava cliente (upsert por telefone), pedido, itens e histórico; depois abre `wa.me` com texto formatado.
4. **Admin** (`/admin`): sessão Supabase; dados filtrados por RLS à loja do usuário.

## Scripts

| Comando | Descrição |
|---------|------------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck + build de produção |
| `npm run preview` | Preview do `dist/` |

## Documentação Supabase

Consulte **`SUPABASE.md`** para: SQL completo, RLS, Storage, variáveis de ambiente, anon vs service_role e deploy.

## Licença

Uso interno / projeto entregue conforme contrato com a loja.
