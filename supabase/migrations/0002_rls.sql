-- ============================================================================
-- RLS — isolamento por loja (tenant). Nunca use service_role no frontend.
-- catalog_stores_v aqui é a primeira versão; 0005/0009 recriam a view (colunas e filtros).
-- ============================================================================

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_counters ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helpers: lojas do usuário autenticado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_store_member(p_store uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_users su
    WHERE su.store_id = p_store AND su.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_store_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_store_member(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- stores — dados sensíveis (CPF/CNPJ, e-mail de contato) só para membros.
-- Catálogo público usa a view catalog_stores_v (sem colunas sensíveis).
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.stores FROM anon;

CREATE OR REPLACE VIEW public.catalog_stores_v AS
SELECT
  id,
  slug,
  trade_name,
  logo_url,
  banner_url,
  phone_main,
  whatsapp_1,
  whatsapp_2,
  cep,
  street,
  number,
  complement,
  district,
  city,
  state,
  institutional_text,
  theme_primary,
  theme_accent,
  policy_text,
  whatsapp_orders_phone,
  catalog_published
FROM public.stores
WHERE catalog_published = true;

GRANT SELECT ON public.catalog_stores_v TO anon, authenticated;

CREATE POLICY stores_member_manage
ON public.stores
FOR ALL
TO authenticated
USING (public.is_store_member(id))
WITH CHECK (public.is_store_member(id));

-- ---------------------------------------------------------------------------
-- store_users
-- ---------------------------------------------------------------------------
CREATE POLICY store_users_member_read
ON public.store_users
FOR SELECT
TO authenticated
USING (public.is_store_member(store_id));

CREATE POLICY store_users_self_read
ON public.store_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- store_settings
-- ---------------------------------------------------------------------------
CREATE POLICY store_settings_member
ON public.store_settings
FOR ALL
TO authenticated
USING (public.is_store_member(store_id))
WITH CHECK (public.is_store_member(store_id));

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
CREATE POLICY customers_member
ON public.customers
FOR ALL
TO authenticated
USING (public.is_store_member(store_id))
WITH CHECK (public.is_store_member(store_id));

-- ---------------------------------------------------------------------------
-- categories — leitura pública apenas ativas + loja publicada
-- ---------------------------------------------------------------------------
CREATE POLICY categories_public_read
ON public.categories
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = categories.store_id AND s.catalog_published = true
  )
);

CREATE POLICY categories_member_write
ON public.categories
FOR ALL
TO authenticated
USING (public.is_store_member(store_id))
WITH CHECK (public.is_store_member(store_id));

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE POLICY products_public_read
ON public.products
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = products.store_id AND s.catalog_published = true
  )
);

CREATE POLICY products_member_write
ON public.products
FOR ALL
TO authenticated
USING (public.is_store_member(store_id))
WITH CHECK (public.is_store_member(store_id));

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
CREATE POLICY product_images_public_read
ON public.product_images
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_images.product_id
      AND p.is_active = true
      AND s.catalog_published = true
  )
);

CREATE POLICY product_images_member_write
ON public.product_images
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_images.product_id AND public.is_store_member(p.store_id))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_images.product_id AND public.is_store_member(p.store_id))
);

-- ---------------------------------------------------------------------------
-- colors
-- ---------------------------------------------------------------------------
CREATE POLICY colors_public_read
ON public.colors
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = colors.store_id AND s.catalog_published = true
  )
);

CREATE POLICY colors_member_write
ON public.colors
FOR ALL
TO authenticated
USING (public.is_store_member(store_id))
WITH CHECK (public.is_store_member(store_id));

-- ---------------------------------------------------------------------------
-- product_variants
-- ---------------------------------------------------------------------------
CREATE POLICY variants_public_read
ON public.product_variants
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_variants.product_id
      AND p.is_active = true
      AND s.catalog_published = true
  )
);

CREATE POLICY variants_member_write
ON public.product_variants
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND public.is_store_member(p.store_id))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND public.is_store_member(p.store_id))
);

-- ---------------------------------------------------------------------------
-- variant_images
-- ---------------------------------------------------------------------------
CREATE POLICY variant_images_public_read
ON public.variant_images
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    JOIN public.stores s ON s.id = p.store_id
    WHERE v.id = variant_images.variant_id
      AND v.is_active = true
      AND p.is_active = true
      AND s.catalog_published = true
  )
);

CREATE POLICY variant_images_member_write
ON public.variant_images
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    WHERE v.id = variant_images.variant_id AND public.is_store_member(p.store_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    WHERE v.id = variant_images.variant_id AND public.is_store_member(p.store_id)
  )
);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE POLICY orders_member
ON public.orders
FOR ALL
TO authenticated
USING (public.is_store_member(store_id))
WITH CHECK (public.is_store_member(store_id));

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
CREATE POLICY order_items_member
ON public.order_items
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.is_store_member(o.store_id))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.is_store_member(o.store_id))
);

-- ---------------------------------------------------------------------------
-- order_status_history
-- ---------------------------------------------------------------------------
CREATE POLICY order_status_history_member
ON public.order_status_history
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id AND public.is_store_member(o.store_id))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id AND public.is_store_member(o.store_id))
);

-- ---------------------------------------------------------------------------
-- store_order_counters — apenas backend via função SECURITY DEFINER
-- ---------------------------------------------------------------------------
CREATE POLICY store_order_counters_no_client
ON public.store_order_counters
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Privilégios mínimos (RLS continua sendo a barreira principal)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.colors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variant_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_status_history TO authenticated;

GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.product_images TO anon;
GRANT SELECT ON public.colors TO anon;
GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT ON public.variant_images TO anon;
