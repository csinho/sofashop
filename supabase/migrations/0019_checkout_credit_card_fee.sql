-- Checkout cartão crédito: total do pedido inclui taxa da maquinha conforme parcelas (1x–10x).

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

  v_total := v_subtotal;
  v_payment := p_payment;

  IF p_payment_kind = 'cartao_credito' THEN
    v_inst := greatest(1, least(10, coalesce((p_payment->>'installments')::int, 1)));
    v_fee_pct := CASE v_inst
      WHEN 1 THEN 3.8
      WHEN 2 THEN 5.0
      WHEN 3 THEN 5.73
      WHEN 4 THEN 6.46
      WHEN 5 THEN 7.19
      WHEN 6 THEN 7.92
      WHEN 7 THEN 8.65
      WHEN 8 THEN 9.38
      WHEN 9 THEN 10.11
      ELSE 10.84
    END;
    v_fee_amt := round(v_subtotal * v_fee_pct / 100.0, 2);
    v_total := v_subtotal + v_fee_amt;
    v_payment := coalesce(p_payment, '{}'::jsonb) || jsonb_build_object(
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
    p_shipping,
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
