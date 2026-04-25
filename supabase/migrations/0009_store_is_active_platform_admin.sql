-- =============================================================================
-- Loja ativa/inativa (plataforma) + admin da plataforma + acesso catálogo público
-- - store_catalog_is_live, view catalog_stores_v (publicado E ativo)
-- - RPCs: platform_list_stores, platform_get_store, platform_set_store_is_active
-- - checkout_catalog_order + resolve_catalog_customer: mesma regra (loja “viva”)
-- Após deploy: insert into public.platform_admins (user_id) values ('<seu-uuid-de-auth>'::uuid);
-- =============================================================================

-- 1) Conta da loja (default ativa; só a plataforma altera is_active)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.stores.is_active IS 'Habilita a loja na plataforma. Se falso, catálogo e gestão bloqueados (UI). Apenas plataforma altera.';

-- 2) Catálogo público: loja viva = publicada E ativa
CREATE OR REPLACE FUNCTION public.store_catalog_is_live(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = p_store_id
      AND s.catalog_published = true
      AND s.is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.store_catalog_is_live(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_catalog_is_live(uuid) TO anon, authenticated;

-- 3) View: só lojas acessíveis publicamente
CREATE OR REPLACE VIEW public.catalog_stores_v AS
SELECT
  s.id,
  s.slug,
  s.trade_name,
  s.logo_url,
  s.banner_url,
  s.phone_main,
  s.whatsapp_1,
  s.whatsapp_2,
  s.cep,
  s.street,
  s.number,
  s.complement,
  s.district,
  s.city,
  s.state,
  s.institutional_text,
  s.theme_primary,
  s.theme_accent,
  s.policy_text,
  s.whatsapp_orders_phone,
  s.catalog_published,
  s.checkout_payment_config
FROM public.stores s
WHERE s.catalog_published = true
  AND s.is_active = true;

GRANT SELECT ON public.catalog_stores_v TO anon, authenticated;

-- 4) Tabela de admins da plataforma
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Sem política = ninguém lê via postgrest; funções SECURITY DEFINER acessam.
COMMENT ON TABLE public.platform_admins IS 'Acesso à rota /plataforma. INSERT manual do user_id.';

-- 5) is_platform_admin() (antes do trigger abaixo)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- 6) Só a plataforma muda is_active
CREATE OR REPLACE FUNCTION public.stores_guard_is_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    RETURN NEW;
  END IF;
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Apenas a plataforma pode ativar ou desativar a loja.';
END;
$$;

REVOKE ALL ON FUNCTION public.stores_guard_is_active() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_stores_guard_is_active ON public.stores;
CREATE TRIGGER trg_stores_guard_is_active
BEFORE UPDATE OF is_active ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.stores_guard_is_active();

-- 7) Resposta do catálogo sem expor CPF, etc.
CREATE OR REPLACE FUNCTION public.get_public_catalog_store(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text := lower(trim(p_slug));
  r public.stores%ROWTYPE;
  v_row jsonb;
BEGIN
  SELECT * INTO r FROM public.stores s WHERE s.slug = v_slug LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF NOT r.is_active THEN
    RETURN jsonb_build_object('status', 'inactive', 'trade_name', r.trade_name);
  END IF;
  IF NOT r.catalog_published THEN
    RETURN jsonb_build_object('status', 'unpublished', 'trade_name', r.trade_name);
  END IF;
  v_row := jsonb_build_object(
    'id', r.id,
    'slug', r.slug,
    'trade_name', r.trade_name,
    'logo_url', r.logo_url,
    'banner_url', r.banner_url,
    'phone_main', r.phone_main,
    'whatsapp_1', r.whatsapp_1,
    'whatsapp_2', r.whatsapp_2,
    'cep', r.cep,
    'street', r.street,
    'number', r.number,
    'complement', r.complement,
    'district', r.district,
    'city', r.city,
    'state', r.state,
    'institutional_text', r.institutional_text,
    'theme_primary', r.theme_primary,
    'theme_accent', r.theme_accent,
    'policy_text', r.policy_text,
    'whatsapp_orders_phone', r.whatsapp_orders_phone,
    'catalog_published', r.catalog_published,
    'checkout_payment_config', r.checkout_payment_config
  );
  RETURN jsonb_build_object('status', 'ok', 'store', v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_catalog_store(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_catalog_store(text) TO anon, authenticated;

-- 8) Lista de lojas (painel plataforma): logo_url, totais de pedidos, entregues e em aberto
CREATE OR REPLACE FUNCTION public.platform_list_stores()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT coalesce(
    (
      SELECT jsonb_agg(sub.j ORDER BY sub.ord DESC)
      FROM (
        SELECT
          s.created_at AS ord,
          jsonb_build_object(
            'id', s.id,
            'slug', s.slug,
            'trade_name', s.trade_name,
            'legal_name', s.legal_name,
            'email_contact', s.email_contact,
            'logo_url', s.logo_url,
            'is_active', s.is_active,
            'catalog_published', s.catalog_published,
            'created_at', s.created_at,
            'customer_count', (SELECT count(*)::int FROM public.customers c WHERE c.store_id = s.id),
            'order_count', (SELECT count(*)::int FROM public.orders o WHERE o.store_id = s.id),
            'orders_total', coalesce((
              SELECT sum(oo.total)::float FROM public.orders oo WHERE oo.store_id = s.id
            ), 0),
            'orders_sum_delivered', coalesce((
              SELECT sum(oo.total)::float FROM public.orders oo
              WHERE oo.store_id = s.id AND oo.status = 'entregue'::public.order_status
            ), 0),
            'orders_count_delivered', coalesce((
              SELECT count(*)::int FROM public.orders oo
              WHERE oo.store_id = s.id AND oo.status = 'entregue'::public.order_status
            ), 0),
            'orders_sum_not_delivered', coalesce((
              SELECT sum(oo.total)::float FROM public.orders oo
              WHERE oo.store_id = s.id
                AND oo.status <> 'entregue'::public.order_status
                AND oo.status <> 'cancelado'::public.order_status
            ), 0),
            'orders_count_not_delivered', coalesce((
              SELECT count(*)::int FROM public.orders oo
              WHERE oo.store_id = s.id
                AND oo.status <> 'entregue'::public.order_status
                AND oo.status <> 'cancelado'::public.order_status
            ), 0)
          ) AS j
        FROM public.stores s
      ) sub
    ),
    '[]'::jsonb
  ) INTO r;

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_list_stores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_list_stores() TO authenticated;

-- 9) Detalhe de uma loja (mesmo JSON que um item de platform_list_stores) — /plataforma/lojas/:id
CREATE OR REPLACE FUNCTION public.platform_get_store(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p_store_id) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', s.id,
    'slug', s.slug,
    'trade_name', s.trade_name,
    'legal_name', s.legal_name,
    'email_contact', s.email_contact,
    'logo_url', s.logo_url,
    'is_active', s.is_active,
    'catalog_published', s.catalog_published,
    'created_at', s.created_at,
    'customer_count', (SELECT count(*)::int FROM public.customers c WHERE c.store_id = s.id),
    'order_count', (SELECT count(*)::int FROM public.orders o WHERE o.store_id = s.id),
    'orders_total', coalesce((
      SELECT sum(oo.total)::float FROM public.orders oo WHERE oo.store_id = s.id
    ), 0),
    'orders_sum_delivered', coalesce((
      SELECT sum(oo.total)::float FROM public.orders oo
      WHERE oo.store_id = s.id AND oo.status = 'entregue'::public.order_status
    ), 0),
    'orders_count_delivered', coalesce((
      SELECT count(*)::int FROM public.orders oo
      WHERE oo.store_id = s.id AND oo.status = 'entregue'::public.order_status
    ), 0),
    'orders_sum_not_delivered', coalesce((
      SELECT sum(oo.total)::float FROM public.orders oo
      WHERE oo.store_id = s.id
        AND oo.status <> 'entregue'::public.order_status
        AND oo.status <> 'cancelado'::public.order_status
    ), 0),
    'orders_count_not_delivered', coalesce((
      SELECT count(*)::int FROM public.orders oo
      WHERE oo.store_id = s.id
        AND oo.status <> 'entregue'::public.order_status
        AND oo.status <> 'cancelado'::public.order_status
    ), 0)
  ) INTO r
  FROM public.stores s
  WHERE s.id = p_store_id;

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_get_store(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_get_store(uuid) TO authenticated;

-- 10) Plataforma ativa/desativa loja
CREATE OR REPLACE FUNCTION public.platform_set_store_is_active(
  p_store_id uuid,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p_store_id) THEN
    RAISE EXCEPTION 'Loja não encontrada';
  END IF;
  UPDATE public.stores SET is_active = p_is_active WHERE id = p_store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_set_store_is_active(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_set_store_is_active(uuid, boolean) TO authenticated;

-- 11) Catálogo: checkout e resolve de cliente exigem a mesma regra que o RLS (loja publicada E ativa).
--     Substitui a verificação só com catalog_published de 0008; usa store_catalog_is_live (def. acima).
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
  v_phone2_norm text;
  v_phone2_disp text;
BEGIN
  IF NOT public.store_catalog_is_live(p_store_id) THEN
    RAISE EXCEPTION 'Loja indisponível';
  END IF;

  v_phone_norm := regexp_replace(coalesce(p_customer->>'phone', ''), '\D', '', 'g');
  IF length(v_phone_norm) < 10 THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;

  v_phone2_norm := regexp_replace(coalesce(p_customer->>'phone_secondary', ''), '\D', '', 'g');
  IF length(v_phone2_norm) < 10 OR v_phone2_norm = v_phone_norm THEN
    v_phone2_norm := '';
    v_phone2_disp := '';
  ELSE
    v_phone2_disp := trim(coalesce(p_customer->>'phone_secondary', ''));
  END IF;

  INSERT INTO public.customers (
    store_id, full_name, phone, phone_normalized, email,
    phone_secondary, phone_secondary_normalized,
    cep, street, number, complement, district, city, state
  )
  VALUES (
    p_store_id,
    p_customer->>'full_name',
    p_customer->>'phone',
    v_phone_norm,
    nullif(p_customer->>'email', ''),
    coalesce(nullif(v_phone2_disp, ''), ''),
    v_phone2_norm,
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
    phone_secondary = EXCLUDED.phone_secondary,
    phone_secondary_normalized = EXCLUDED.phone_secondary_normalized,
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

CREATE OR REPLACE FUNCTION public.resolve_catalog_customer(
  p_store_id uuid,
  p_customer_id uuid DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH store_ok AS (
    SELECT public.store_catalog_is_live(p_store_id) AS ok
  ),
  by_id AS (
    SELECT jsonb_build_object(
      'id', c.id,
      'full_name', c.full_name,
      'phone', c.phone,
      'phone_secondary', coalesce(c.phone_secondary, ''),
      'cep', coalesce(c.cep, ''),
      'street', coalesce(c.street, ''),
      'number', coalesce(c.number, ''),
      'complement', coalesce(c.complement, ''),
      'district', coalesce(c.district, ''),
      'city', coalesce(c.city, ''),
      'state', coalesce(c.state, '')
    ) AS j
    FROM public.customers c
    INNER JOIN store_ok so ON so.ok
    WHERE p_customer_id IS NOT NULL
      AND c.id = p_customer_id
      AND c.store_id = p_store_id
    LIMIT 1
  ),
  by_phone AS (
    SELECT jsonb_build_object(
      'id', c.id,
      'full_name', c.full_name,
      'phone', c.phone,
      'phone_secondary', coalesce(c.phone_secondary, ''),
      'cep', coalesce(c.cep, ''),
      'street', coalesce(c.street, ''),
      'number', coalesce(c.number, ''),
      'complement', coalesce(c.complement, ''),
      'district', coalesce(c.district, ''),
      'city', coalesce(c.city, ''),
      'state', coalesce(c.state, '')
    ) AS j
    FROM public.customers c
    INNER JOIN store_ok so ON so.ok
    WHERE p_phone IS NOT NULL
      AND length(trim(p_phone)) > 0
      AND length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 10
      AND c.store_id = p_store_id
      AND c.phone_normalized = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
    LIMIT 1
  )
  SELECT CASE
    WHEN NOT (SELECT ok FROM store_ok) THEN NULL::jsonb
    ELSE coalesce((SELECT j FROM by_id), (SELECT j FROM by_phone))
  END;
$$;

REVOKE ALL ON FUNCTION public.resolve_catalog_customer(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_catalog_customer(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_catalog_customer(uuid, uuid, text) TO authenticated;
