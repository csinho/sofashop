-- ============================================================================
-- SofáShop Multi-loja — schema PostgreSQL (Supabase)
-- Execute no SQL Editor ou via CLI após criar o projeto.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'novo',
    'em_analise',
    'aprovado',
    'em_producao',
    'pronto_entrega',
    'entregue',
    'cancelado'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.document_kind AS ENUM ('cpf', 'cnpj');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.store_user_role AS ENUM ('owner', 'admin', 'staff');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_kind AS ENUM (
    'pix',
    'cartao_debito',
    'cartao_credito',
    'parcelado',
    'entrada_parcelado'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Função updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Lojas
-- ---------------------------------------------------------------------------
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  slug text NOT NULL UNIQUE,
  legal_name text NOT NULL,
  trade_name text NOT NULL,
  document_kind public.document_kind NOT NULL,
  document text NOT NULL,
  phone_main text NOT NULL,
  whatsapp_1 text NOT NULL,
  whatsapp_2 text NOT NULL DEFAULT '',
  email_contact text NOT NULL,
  cep text NOT NULL,
  street text NOT NULL,
  number text NOT NULL,
  complement text NOT NULL DEFAULT '',
  district text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  logo_url text,
  banner_url text,
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  institutional_text text NOT NULL DEFAULT '',
  theme_primary text NOT NULL DEFAULT '#0f172a',
  theme_accent text NOT NULL DEFAULT '#c2410c',
  pdf_footer text NOT NULL DEFAULT '',
  default_order_notes text NOT NULL DEFAULT '',
  policy_text text NOT NULL DEFAULT '',
  whatsapp_orders_phone text NOT NULL,
  catalog_published boolean NOT NULL DEFAULT true
);

CREATE TRIGGER trg_stores_updated
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_stores_owner ON public.stores (owner_user_id);
CREATE INDEX idx_stores_slug ON public.stores (slug);

-- ---------------------------------------------------------------------------
-- Usuários vinculados à loja
-- ---------------------------------------------------------------------------
CREATE TABLE public.store_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.store_user_role NOT NULL DEFAULT 'staff',
  UNIQUE (store_id, user_id)
);

CREATE TRIGGER trg_store_users_updated
BEFORE UPDATE ON public.store_users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_store_users_user ON public.store_users (user_id);
CREATE INDEX idx_store_users_store ON public.store_users (store_id);

-- ---------------------------------------------------------------------------
-- Configurações / extensões futuras (relatórios, integrações)
-- ---------------------------------------------------------------------------
CREATE TABLE public.store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores (id) ON DELETE CASCADE,
  report_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  integration_hooks jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TRIGGER trg_store_settings_updated
BEFORE UPDATE ON public.store_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Clientes finais
-- ---------------------------------------------------------------------------
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  phone_normalized text NOT NULL,
  email text,
  cep text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  UNIQUE (store_id, phone_normalized)
);

CREATE TRIGGER trg_customers_updated
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_customers_store ON public.customers (store_id);
CREATE INDEX idx_customers_phone ON public.customers (store_id, phone_normalized);

-- ---------------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------------
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (store_id, slug)
);

CREATE TRIGGER trg_categories_updated
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_categories_store ON public.categories (store_id);

-- ---------------------------------------------------------------------------
-- Produtos
-- ---------------------------------------------------------------------------
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL,
  subcategory text,
  model_type text NOT NULL,
  short_description text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  sku text NOT NULL,
  base_price numeric(14,2) NOT NULL CHECK (base_price >= 0),
  promo_price numeric(14,2),
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  delivery_days int NOT NULL DEFAULT 15,
  internal_notes text NOT NULL DEFAULT '',
  sofa_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (store_id, slug),
  UNIQUE (store_id, sku)
);

CREATE TRIGGER trg_products_updated
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_products_store ON public.products (store_id);
CREATE INDEX idx_products_category ON public.products (category_id);
CREATE INDEX idx_products_active ON public.products (store_id, is_active);

-- ---------------------------------------------------------------------------
-- Imagens do produto (URLs públicas do Storage)
-- ---------------------------------------------------------------------------
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  alt text NOT NULL DEFAULT ''
);

CREATE TRIGGER trg_product_images_updated
BEFORE UPDATE ON public.product_images
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_product_images_product ON public.product_images (product_id);

-- ---------------------------------------------------------------------------
-- Cores (catálogo por loja)
-- ---------------------------------------------------------------------------
CREATE TABLE public.colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  name text NOT NULL,
  hex text NOT NULL
);

CREATE UNIQUE INDEX idx_colors_store_name_lower ON public.colors (store_id, lower(name));

CREATE TRIGGER trg_colors_updated
BEFORE UPDATE ON public.colors
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_colors_store ON public.colors (store_id);

-- ---------------------------------------------------------------------------
-- Variações (cor + preço/estoque opcional)
-- ---------------------------------------------------------------------------
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  color_id uuid REFERENCES public.colors (id) ON DELETE SET NULL,
  name text NOT NULL,
  sku_suffix text NOT NULL DEFAULT '',
  price_override numeric(14,2),
  stock int,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TRIGGER trg_product_variants_updated
BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_variants_product ON public.product_variants (product_id);

-- ---------------------------------------------------------------------------
-- Imagens por variação
-- ---------------------------------------------------------------------------
CREATE TABLE public.variant_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  alt text NOT NULL DEFAULT ''
);

CREATE TRIGGER trg_variant_images_updated
BEFORE UPDATE ON public.variant_images
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_variant_images_variant ON public.variant_images (variant_id);

-- ---------------------------------------------------------------------------
-- Sequência de pedidos por loja
-- ---------------------------------------------------------------------------
CREATE TABLE public.store_order_counters (
  store_id uuid PRIMARY KEY REFERENCES public.stores (id) ON DELETE CASCADE,
  last_value bigint NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.next_order_number(p_store_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_next bigint;
BEGIN
  UPDATE public.store_order_counters
  SET last_value = last_value + 1
  WHERE store_id = p_store_id
  RETURNING last_value INTO v_next;

  IF NOT FOUND THEN
    INSERT INTO public.store_order_counters (store_id, last_value)
    VALUES (p_store_id, 1)
    RETURNING last_value INTO v_next;
  END IF;

  RETURN 'PED-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD') || '-' || lpad(v_next::text, 5, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  order_number text NOT NULL,
  status public.order_status NOT NULL DEFAULT 'novo',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  payment_kind public.payment_kind NOT NULL,
  payment_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_snapshot jsonb NOT NULL,
  shipping_snapshot jsonb NOT NULL,
  notes text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'catálogo online',
  UNIQUE (store_id, order_number)
);

CREATE TRIGGER trg_orders_updated
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_orders_store ON public.orders (store_id);
CREATE INDEX idx_orders_status ON public.orders (store_id, status);
CREATE INDEX idx_orders_created ON public.orders (store_id, created_at DESC);
CREATE INDEX idx_orders_customer ON public.orders (customer_id);

-- ---------------------------------------------------------------------------
-- Itens do pedido
-- ---------------------------------------------------------------------------
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants (id) ON DELETE SET NULL,
  product_name text NOT NULL,
  sku text NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL,
  line_total numeric(14,2) NOT NULL,
  options_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TRIGGER trg_order_items_updated
BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_order_items_order ON public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Histórico de status
-- ---------------------------------------------------------------------------
CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  status public.order_status NOT NULL,
  changed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT ''
);

CREATE INDEX idx_order_status_history_order ON public.order_status_history (order_id);

-- ---------------------------------------------------------------------------
-- RPC: checkout público (SECURITY DEFINER) — evita expor service_role no FE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_catalog_order(
  p_store_id uuid,
  p_customer jsonb,
  p_shipping jsonb,
  p_items jsonb,
  p_payment jsonb,
  p_notes text,
  p_payment_kind public.payment_kind
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_order_id uuid;
  v_number text;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_item jsonb;
  v_phone_norm text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = p_store_id AND s.catalog_published = true
  ) THEN
    RAISE EXCEPTION 'Loja indisponível';
  END IF;

  v_phone_norm := regexp_replace(coalesce(p_customer->>'phone', ''), '\D', '', 'g');
  IF length(v_phone_norm) < 10 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;

  INSERT INTO public.customers (
    store_id, full_name, phone, phone_normalized, email,
    cep, street, number, complement, district, city, state
  )
  VALUES (
    p_store_id,
    p_customer->>'full_name',
    p_customer->>'phone',
    v_phone_norm,
    nullif(p_customer->>'email', ''),
    p_shipping->>'cep',
    p_shipping->>'street',
    p_shipping->>'number',
    coalesce(p_shipping->>'complement', ''),
    p_shipping->>'district',
    p_shipping->>'city',
    p_shipping->>'state'
  )
  ON CONFLICT (store_id, phone_normalized) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    cep = EXCLUDED.cep,
    street = EXCLUDED.street,
    number = EXCLUDED.number,
    complement = EXCLUDED.complement,
    district = EXCLUDED.district,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    updated_at = now()
  RETURNING id INTO v_customer_id;

  v_number := public.next_order_number(p_store_id);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_subtotal := v_subtotal + (v_item->>'line_total')::numeric;
  END LOOP;

  v_total := v_subtotal;

  INSERT INTO public.orders (
    store_id, customer_id, order_number, status,
    subtotal, total, payment_kind, payment_details,
    customer_snapshot, shipping_snapshot, notes, source
  ) VALUES (
    p_store_id,
    v_customer_id,
    v_number,
    'novo',
    v_subtotal,
    v_total,
    p_payment_kind,
    p_payment,
    p_customer,
    p_shipping,
    coalesce(p_notes, ''),
    'catálogo online'
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_status_history (order_id, status, note)
  VALUES (v_order_id, 'novo', 'Pedido criado pelo catálogo');

  INSERT INTO public.order_items (
    order_id, product_id, variant_id, product_name, sku, quantity, unit_price, line_total, options_snapshot
  )
  SELECT
    v_order_id,
    nullif(x->>'product_id', '')::uuid,
    nullif(x->>'variant_id', '')::uuid,
    x->>'product_name',
    x->>'sku',
    (x->>'quantity')::int,
    (x->>'unit_price')::numeric,
    (x->>'line_total')::numeric,
    coalesce(x->'options_snapshot', '{}'::jsonb)
  FROM jsonb_array_elements(p_items) AS x;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_number,
    'customer_id', v_customer_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_catalog_order(uuid, jsonb, jsonb, jsonb, jsonb, text, public.payment_kind) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_catalog_order(uuid, jsonb, jsonb, jsonb, jsonb, text, public.payment_kind) TO anon;
GRANT EXECUTE ON FUNCTION public.checkout_catalog_order(uuid, jsonb, jsonb, jsonb, jsonb, text, public.payment_kind) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: cadastro da loja após signUp (usuário autenticado)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_store(
  p_slug text,
  p_legal_name text,
  p_trade_name text,
  p_document_kind public.document_kind,
  p_document text,
  p_phone_main text,
  p_whatsapp_1 text,
  p_whatsapp_2 text,
  p_email_contact text,
  p_cep text,
  p_street text,
  p_number text,
  p_complement text,
  p_district text,
  p_city text,
  p_state text,
  p_logo_url text,
  p_whatsapp_orders_phone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  IF EXISTS (SELECT 1 FROM public.store_users su WHERE su.user_id = v_uid) THEN
    RAISE EXCEPTION 'Usuário já possui loja vinculada';
  END IF;

  INSERT INTO public.stores (
    slug, legal_name, trade_name, document_kind, document,
    phone_main, whatsapp_1, whatsapp_2, email_contact,
    cep, street, number, complement, district, city, state,
    logo_url, owner_user_id, whatsapp_orders_phone
  ) VALUES (
    lower(trim(p_slug)),
    p_legal_name,
    p_trade_name,
    p_document_kind,
    regexp_replace(p_document, '\D', '', 'g'),
    p_phone_main,
    p_whatsapp_1,
    coalesce(p_whatsapp_2, ''),
    p_email_contact,
    regexp_replace(p_cep, '\D', '', 'g'),
    p_street,
    p_number,
    coalesce(p_complement, ''),
    p_district,
    p_city,
    upper(p_state),
    p_logo_url,
    v_uid,
    p_whatsapp_orders_phone
  )
  RETURNING id INTO v_store_id;

  INSERT INTO public.store_users (store_id, user_id, role)
  VALUES (v_store_id, v_uid, 'owner');

  INSERT INTO public.store_settings (store_id)
  VALUES (v_store_id)
  ON CONFLICT (store_id) DO NOTHING;

  INSERT INTO public.categories (store_id, name, slug, sort_order, is_active) VALUES
    (v_store_id, 'Sofás', 'sofas', 1, true),
    (v_store_id, 'Puffs', 'puffs', 2, true),
    (v_store_id, 'Camas', 'camas', 3, true),
    (v_store_id, 'Bicamas', 'bicamas', 4, true);

  RETURN v_store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_store FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_store TO authenticated;

COMMENT ON FUNCTION public.register_store IS 'Cria loja + vínculo owner; executar após supabase.auth.signUp/signIn.';
