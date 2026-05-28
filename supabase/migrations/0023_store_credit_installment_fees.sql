-- Taxas da maquinha por parcela no cartão de crédito (configurável por loja).

CREATE TABLE IF NOT EXISTS public.store_credit_installment_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  installments int NOT NULL CHECK (installments >= 1),
  fee_percent numeric(6, 2) NOT NULL CHECK (fee_percent >= 0),
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (store_id, installments)
);

CREATE TRIGGER trg_store_credit_installment_fees_updated
BEFORE UPDATE ON public.store_credit_installment_fees
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_store_credit_installment_fees_store
ON public.store_credit_installment_fees (store_id);

ALTER TABLE public.store_credit_installment_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY store_credit_installment_fees_public_read
ON public.store_credit_installment_fees
FOR SELECT
TO anon, authenticated
USING (public.store_catalog_is_live(store_id));

CREATE POLICY store_credit_installment_fees_member_write
ON public.store_credit_installment_fees
FOR ALL
TO authenticated
USING (public.is_store_member(store_id))
WITH CHECK (public.is_store_member(store_id));

GRANT SELECT ON public.store_credit_installment_fees TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_credit_installment_fees TO authenticated;

CREATE OR REPLACE FUNCTION public.seed_store_credit_installment_fees(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.store_credit_installment_fees (store_id, installments, fee_percent, sort_order)
  VALUES
    (p_store_id, 1, 3.8, 1),
    (p_store_id, 2, 5.0, 2),
    (p_store_id, 3, 5.73, 3),
    (p_store_id, 4, 6.46, 4),
    (p_store_id, 5, 7.19, 5),
    (p_store_id, 6, 7.92, 6),
    (p_store_id, 7, 8.65, 7),
    (p_store_id, 8, 9.38, 8),
    (p_store_id, 9, 10.11, 9),
    (p_store_id, 10, 10.84, 10)
  ON CONFLICT (store_id, installments) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_store_credit_installment_fees(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_store_credit_installment_fees(uuid) TO authenticated;

SELECT public.seed_store_credit_installment_fees(s.id) FROM public.stores s;

CREATE OR REPLACE FUNCTION public.credit_installment_fee_percent(p_store_id uuid, p_installments int)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst int := greatest(1, coalesce(p_installments, 1));
  v_pct numeric(6, 2);
BEGIN
  SELECT f.fee_percent INTO v_pct
  FROM public.store_credit_installment_fees f
  WHERE f.store_id = p_store_id AND f.installments = v_inst;

  IF FOUND THEN
    RETURN v_pct;
  END IF;

  SELECT f.fee_percent INTO v_pct
  FROM public.store_credit_installment_fees f
  WHERE f.store_id = p_store_id AND f.installments <= v_inst
  ORDER BY f.installments DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_pct;
  END IF;

  SELECT f.fee_percent INTO v_pct
  FROM public.store_credit_installment_fees f
  WHERE f.store_id = p_store_id
  ORDER BY f.installments ASC
  LIMIT 1;

  RETURN v_pct;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_installment_fee_percent(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_installment_fee_percent(uuid, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_stores_seed_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_store_delivery_cities(NEW.id);
  PERFORM public.seed_store_credit_installment_fees(NEW.id);
  RETURN NEW;
END;
$$;

-- checkout: taxa de cartão lida da tabela por loja

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
  v_base numeric(14,2) := 0;
  v_delivery numeric(14,2) := 0;
  v_delivery_lookup jsonb;
  v_shipping jsonb;
  v_item jsonb;
  v_phone_norm text;
  v_phone2_norm text;
  v_phone2_disp text;
  v_pid uuid;
  v_vid uuid;
  v_line_qty int;
  v_p public.products%ROWTYPE;
  v_have int;
  v_variant_stock int;
  v_has_variants boolean;
  v_stock_applied boolean := false;
  v_payment jsonb;
  v_inst int;
  v_fee_pct numeric(6,2);
  v_fee_amt numeric(14,2);
BEGIN
  IF NOT public.store_catalog_is_live(p_store_id) THEN
    RAISE EXCEPTION 'Loja indisponível';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := nullif(v_item->>'product_id', '')::uuid;
    v_vid := nullif(v_item->>'variant_id', '')::uuid;
    v_line_qty := coalesce((v_item->>'quantity')::int, 0);
    IF v_pid IS NULL OR v_line_qty < 1 THEN
      RAISE EXCEPTION 'Itens do pedido inválidos';
    END IF;

    SELECT * INTO v_p FROM public.products p
    WHERE p.id = v_pid AND p.store_id = p_store_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado';
    END IF;
    IF v_p.is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'Produto indisponível no catálogo';
    END IF;

    IF v_p.stock IS NULL THEN
      CONTINUE;
    END IF;

    v_has_variants := public.product_has_active_variants(v_pid);

    IF v_has_variants THEN
      IF v_vid IS NULL THEN
        RAISE EXCEPTION 'Selecione uma variação';
      END IF;
      SELECT stock INTO v_variant_stock
      FROM public.product_variants
      WHERE id = v_vid AND product_id = v_pid AND is_active = true
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variação indisponível';
      END IF;
      IF v_variant_stock IS NULL THEN
        RAISE EXCEPTION 'Variação sem estoque configurado';
      END IF;
      IF v_variant_stock < v_line_qty THEN
        RAISE EXCEPTION 'Estoque insuficiente';
      END IF;
    ELSE
      IF v_p.stock < v_line_qty THEN
        RAISE EXCEPTION 'Estoque insuficiente';
      END IF;
    END IF;
  END LOOP;

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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + (v_item->>'line_total')::numeric;
  END LOOP;

  v_delivery_lookup := public.lookup_delivery_fee(p_store_id, p_shipping->>'city');
  v_delivery := (v_delivery_lookup->>'fee')::numeric;
  v_shipping := coalesce(p_shipping, '{}'::jsonb) || jsonb_build_object(
    'delivery_fee', v_delivery,
    'delivery_city_key', v_delivery_lookup->>'city_key',
    'delivery_found', (v_delivery_lookup->>'found')::boolean
  );

  v_base := v_subtotal + v_delivery;
  v_total := v_base;
  v_payment := p_payment;

  IF p_payment_kind = 'cartao_credito' THEN
    v_inst := greatest(1, coalesce((p_payment->>'installments')::int, 1));
    v_fee_pct := public.credit_installment_fee_percent(p_store_id, v_inst);
    IF v_fee_pct IS NULL THEN
      RAISE EXCEPTION 'Taxa de cartão não configurada para esta quantidade de parcelas';
    END IF;
    v_fee_amt := round(v_base * v_fee_pct / 100.0, 2);
    v_total := v_base + v_fee_amt;
    v_payment := coalesce(v_payment, '{}'::jsonb) || jsonb_build_object(
      'installments', v_inst,
      'fee_percent', v_fee_pct,
      'fee_amount', v_fee_amt
    );
  END IF;

  INSERT INTO public.orders (
    store_id, customer_id, order_number, status,
    subtotal, total, payment_kind, payment_details,
    customer_snapshot, shipping_snapshot, notes, source,
    stock_applied, stock_restored
  ) VALUES (
    p_store_id,
    v_customer_id,
    v_number,
    'novo',
    v_subtotal,
    v_total,
    p_payment_kind,
    v_payment,
    p_customer,
    v_shipping,
    coalesce(p_notes, ''),
    'catálogo online',
    false,
    false
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := nullif(v_item->>'product_id', '')::uuid;
    v_vid := nullif(v_item->>'variant_id', '')::uuid;
    v_line_qty := coalesce((v_item->>'quantity')::int, 0);

    SELECT stock INTO v_have FROM public.products WHERE id = v_pid;
    IF v_have IS NULL THEN
      CONTINUE;
    END IF;

    v_stock_applied := true;

    UPDATE public.products
    SET stock = stock - v_line_qty, updated_at = now()
    WHERE id = v_pid;

    IF v_vid IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock = stock - v_line_qty, updated_at = now()
      WHERE id = v_vid AND product_id = v_pid;
    END IF;
  END LOOP;

  IF v_stock_applied THEN
    UPDATE public.orders
    SET stock_applied = true
    WHERE id = v_order_id;
  END IF;

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
