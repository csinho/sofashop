-- ============================================================================
-- Billing SaaS — plano mensal da loja (trial, PIX, pagamentos, config global)
-- Depende de: 0001 (stores), 0009 (platform_admins, store_catalog_is_live)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Colunas de billing em stores
-- ---------------------------------------------------------------------------
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'trial'
    CHECK (billing_status IN ('trial', 'ativo', 'pendente', 'inadimplente')),
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_billing_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_period_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS catalog_paused_by_billing boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.stores.billing_status IS 'Status do plano SaaS: trial | ativo | pendente | inadimplente';
COMMENT ON COLUMN public.stores.catalog_paused_by_billing IS 'Catálogo pausado automaticamente por billing vencido (reativa no pagamento)';

-- Grandfather: lojas existentes ficam ativas por 30 dias
UPDATE public.stores
SET
  billing_status = 'ativo',
  trial_ends_at = created_at,
  next_billing_at = now() + interval '30 days',
  billing_period_ends_at = now() + interval '30 days'
WHERE trial_ends_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2) Configuração global (valor do plano)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_system_settings_updated ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated
BEFORE UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.system_settings (key, value)
VALUES ('billing', '{"plan_value_cents": 3990}'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.system_settings FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Histórico de pagamentos do plano
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  paid_at timestamptz NOT NULL,
  value_cents integer NOT NULL CHECK (value_cents > 0),
  correlation_id text,
  end_to_end_id text,
  woovi_event_key text UNIQUE,
  status text NOT NULL DEFAULT 'pago' CHECK (status IN ('pago', 'reembolsado')),
  refunded_at timestamptz,
  refund_value_cents integer,
  refund_woovi_event_key text UNIQUE,
  refund_type text,
  days_used_at_refund integer,
  suggested_refund_cents integer
);

CREATE INDEX IF NOT EXISTS billing_payments_store_id_idx ON public.billing_payments (store_id);
CREATE INDEX IF NOT EXISTS billing_payments_paid_at_idx ON public.billing_payments (paid_at DESC);
CREATE INDEX IF NOT EXISTS billing_payments_status_idx ON public.billing_payments (status);

ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_payments FROM anon, authenticated;

-- Log de lembretes billing (evita duplicata no cron)
CREATE TABLE IF NOT EXISTS public.billing_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  due_date date NOT NULL,
  UNIQUE (store_id, event_type, due_date)
);

ALTER TABLE public.billing_reminder_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_reminder_log FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Realtime
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.stores;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_payments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 5) store_catalog_is_live — exige billing em dia
-- ---------------------------------------------------------------------------
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
      AND s.billing_status IN ('trial', 'ativo')
  );
$$;

-- ---------------------------------------------------------------------------
-- 6) Helpers internos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_plan_value_cents()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
  c integer;
BEGIN
  SELECT value INTO v FROM public.system_settings WHERE key = 'billing';
  IF v IS NULL THEN
    RETURN 3990;
  END IF;
  c := (v->>'plan_value_cents')::integer;
  IF c IS NULL OR c < 100 THEN
    RETURN 3990;
  END IF;
  RETURN c;
END;
$$;

REVOKE ALL ON FUNCTION public.get_plan_value_cents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_plan_value_cents() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7) RPCs públicas e por papel
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_billing_plan()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN json_build_object(
    'plan_value_cents', public.get_plan_value_cents(),
    'trial_days', 7
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_billing_plan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_billing_plan() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_store_billing_safe(p_store_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.stores%ROWTYPE;
BEGIN
  IF NOT public.is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Sem permissão nesta loja';
  END IF;

  SELECT * INTO s FROM public.stores WHERE id = p_store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loja não encontrada';
  END IF;

  RETURN json_build_object(
    'store_id', s.id,
    'billing_status', s.billing_status,
    'trial_ends_at', s.trial_ends_at,
    'next_billing_at', s.next_billing_at,
    'billing_period_ends_at', s.billing_period_ends_at,
    'last_payment_at', s.last_payment_at,
    'catalog_paused_by_billing', s.catalog_paused_by_billing,
    'plan_value_cents', public.get_plan_value_cents()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_store_billing_safe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_billing_safe(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_store_billing_payments(
  p_store_id uuid,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'Sem permissão nesta loja';
  END IF;

  SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.paid_at DESC), '[]'::json)
  INTO result
  FROM (
    SELECT
      bp.id,
      bp.paid_at,
      bp.value_cents,
      bp.correlation_id,
      bp.end_to_end_id,
      bp.status,
      bp.refunded_at,
      bp.refund_value_cents,
      bp.suggested_refund_cents,
      bp.refund_type,
      bp.days_used_at_refund
    FROM public.billing_payments bp
    WHERE bp.store_id = p_store_id
      AND (p_from IS NULL OR bp.paid_at::date >= p_from)
      AND (p_to IS NULL OR bp.paid_at::date <= p_to)
  ) t;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_store_billing_payments(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_store_billing_payments(uuid, date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_platform_billing_settings()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN json_build_object('plan_value_cents', public.get_plan_value_cents());
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_billing_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_billing_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_platform_billing_plan(p_cents integer)
RETURNS json
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_c integer;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_cents IS NULL OR p_cents < 100 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  old_c := public.get_plan_value_cents();

  INSERT INTO public.system_settings (key, value)
  VALUES ('billing', jsonb_build_object('plan_value_cents', p_cents))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN json_build_object(
    'ok', true,
    'plan_value_cents', p_cents,
    'changed', old_c <> p_cents,
    'previous_cents', old_c
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_platform_billing_plan(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_platform_billing_plan(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_list_billing_payments(p_store_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.paid_at DESC), '[]'::json)
  INTO result
  FROM (
    SELECT
      bp.id,
      bp.paid_at,
      bp.value_cents,
      bp.correlation_id,
      bp.end_to_end_id,
      bp.status,
      bp.refunded_at,
      bp.refund_value_cents,
      bp.suggested_refund_cents,
      bp.refund_type,
      bp.days_used_at_refund,
      bp.woovi_event_key
    FROM public.billing_payments bp
    WHERE bp.store_id = p_store_id
  ) t;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_list_billing_payments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_list_billing_payments(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_billing_dashboard(
  p_from date,
  p_to date
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  revenue_cents bigint;
  pending_count int;
  active_count int;
  trial_count int;
  overdue_count int;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT coalesce(sum(bp.value_cents), 0)::bigint
  INTO revenue_cents
  FROM public.billing_payments bp
  WHERE bp.status = 'pago'
    AND bp.paid_at::date >= p_from
    AND bp.paid_at::date <= p_to;

  SELECT count(*)::int INTO active_count
  FROM public.stores s WHERE s.billing_status = 'ativo';

  SELECT count(*)::int INTO trial_count
  FROM public.stores s WHERE s.billing_status = 'trial';

  SELECT count(*)::int INTO pending_count
  FROM public.stores s WHERE s.billing_status IN ('pendente', 'inadimplente');

  SELECT count(*)::int INTO overdue_count
  FROM public.stores s
  WHERE s.billing_status IN ('pendente', 'inadimplente', 'trial')
    AND s.next_billing_at IS NOT NULL
    AND s.next_billing_at < now();

  RETURN json_build_object(
    'revenue_cents', revenue_cents,
    'active_count', active_count,
    'trial_count', trial_count,
    'pending_count', pending_count,
    'overdue_count', overdue_count,
    'plan_value_cents', public.get_plan_value_cents()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_billing_dashboard(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_billing_dashboard(date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) register_store — trial 7 dias
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
  v_trial_end timestamptz := now() + interval '7 days';
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
    logo_url, owner_user_id, whatsapp_orders_phone,
    billing_status, trial_ends_at, next_billing_at, billing_period_ends_at
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
    p_whatsapp_orders_phone,
    'trial',
    v_trial_end,
    v_trial_end,
    v_trial_end
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

-- ---------------------------------------------------------------------------
-- 9) platform_list_stores / platform_get_store — incluir billing
-- ---------------------------------------------------------------------------
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
            'billing_status', s.billing_status,
            'next_billing_at', s.next_billing_at,
            'trial_ends_at', s.trial_ends_at,
            'last_payment_at', s.last_payment_at,
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
    'billing_status', s.billing_status,
    'next_billing_at', s.next_billing_at,
    'trial_ends_at', s.trial_ends_at,
    'last_payment_at', s.last_payment_at,
    'billing_period_ends_at', s.billing_period_ends_at,
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

-- ---------------------------------------------------------------------------
-- 10) payment_due_1d no WhatsApp da plataforma
-- ---------------------------------------------------------------------------
UPDATE public.platform_whatsapp_instance
SET notify_settings = notify_settings || jsonb_build_object(
  'payment_due_1d',
  jsonb_build_object(
    'enabled', false,
    'template', 'Olá! Amanhã vence o plano da loja {{NOME_LOJA}}. Efetue o pagamento via PIX para manter o acesso.'
  )
)
WHERE singleton_key = 'platform';

-- ---------------------------------------------------------------------------
-- 11) Catálogo público — bloquear lojas com billing vencido
-- ---------------------------------------------------------------------------
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
  IF r.billing_status NOT IN ('trial', 'ativo') THEN
    RETURN jsonb_build_object('status', 'billing_inactive', 'trade_name', r.trade_name);
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
