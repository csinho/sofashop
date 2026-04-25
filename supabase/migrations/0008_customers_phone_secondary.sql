-- Telefone alternativo do cliente final (opcional) para contato quando o principal não atende.
-- Após 0009: a checagem de "loja disponível" em checkout/resolve passa a usar
-- public.store_catalog_is_live (catálogo publicado E loja ativa). Ver fim de 0009.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone_secondary text NOT NULL DEFAULT '';

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone_secondary_normalized text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.customers.phone_secondary IS 'Telefone alternativo exibido (texto livre).';
COMMENT ON COLUMN public.customers.phone_secondary_normalized IS 'Apenas dígitos; vazio se não informado ou inválido.';

-- ---------------------------------------------------------------------------
-- Checkout: grava phone_secondary no cliente e mantém no snapshot (p_customer).
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
  v_phone2_norm text;
  v_phone2_disp text;
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

-- ---------------------------------------------------------------------------
-- Resolve: devolve telefone alternativo para pré-preencher checkout.
-- LANGUAGE sql: sem variáveis PL/pgSQL (evita erro "relation v_payload does not exist"
-- ao colar só parte do script no editor do Supabase).
-- Troca a implementação plpgsql de 0006: DROP é necessário para mudar a linguagem.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.resolve_catalog_customer(uuid, uuid, text);

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
    SELECT EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = p_store_id AND s.catalog_published = true
    ) AS ok
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
