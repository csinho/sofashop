-- Extende platform_list_stores: logo + totais entregues vs em aberto (valor + quantidade)

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
