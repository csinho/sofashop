-- Detalhe de uma loja (mesmo shape de um item de platform_list_stores), para a rota /plataforma/lojas/:id

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
