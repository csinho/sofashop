-- =============================================================================
-- Loja ativa/inativa (plataforma) + admin da plataforma + acesso catálogo público
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

-- 8) Lista de lojas (painel plataforma)
CREATE OR REPLACE FUNCTION public.platform_list_stores()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
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
            'is_active', s.is_active,
            'catalog_published', s.catalog_published,
            'created_at', s.created_at,
            'customer_count', (SELECT count(*)::int FROM public.customers c WHERE c.store_id = s.id),
            'order_count', (SELECT count(*)::int FROM public.orders o WHERE o.store_id = s.id),
            'orders_total', coalesce((
              SELECT (sum(oo.total))::float
              FROM public.orders oo
              WHERE oo.store_id = s.id
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

-- 9) Plataforma ativa/desativa loja
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
