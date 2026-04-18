-- Busca cliente do catálogo por id ou telefone (loja publicada). Usado no checkout para pré-preencher dados.
CREATE OR REPLACE FUNCTION public.resolve_catalog_customer(
  p_store_id uuid,
  p_customer_id uuid DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.customers%ROWTYPE;
  v_phone_norm text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = p_store_id AND s.catalog_published = true
  ) THEN
    RETURN NULL;
  END IF;

  IF p_customer_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.customers c
    WHERE c.id = p_customer_id AND c.store_id = p_store_id;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_row.id,
        'full_name', v_row.full_name,
        'phone', v_row.phone,
        'cep', coalesce(v_row.cep, ''),
        'street', coalesce(v_row.street, ''),
        'number', coalesce(v_row.number, ''),
        'complement', coalesce(v_row.complement, ''),
        'district', coalesce(v_row.district, ''),
        'city', coalesce(v_row.city, ''),
        'state', coalesce(v_row.state, '')
      );
    END IF;
  END IF;

  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    v_phone_norm := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
    IF length(v_phone_norm) >= 10 THEN
      SELECT * INTO v_row FROM public.customers c
      WHERE c.store_id = p_store_id AND c.phone_normalized = v_phone_norm;
      IF FOUND THEN
        RETURN jsonb_build_object(
          'id', v_row.id,
          'full_name', v_row.full_name,
          'phone', v_row.phone,
          'cep', coalesce(v_row.cep, ''),
          'street', coalesce(v_row.street, ''),
          'number', coalesce(v_row.number, ''),
          'complement', coalesce(v_row.complement, ''),
          'district', coalesce(v_row.district, ''),
          'city', coalesce(v_row.city, ''),
          'state', coalesce(v_row.state, '')
        );
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_catalog_customer(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_catalog_customer(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_catalog_customer(uuid, uuid, text) TO authenticated;
