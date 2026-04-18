-- ============================================================================
-- Correção: catálogo público não listava produtos.
-- Motivo: políticas RLS faziam EXISTS em public.stores, mas o papel anon não tem
-- SELECT em stores (apenas na view catalog_stores_v). O PostgreSQL exige
-- permissão nas tabelas referenciadas na expressão da política.
-- Solução: função SECURITY DEFINER que consulta stores com privilégios do dono.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.store_catalog_is_live(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = p_store_id AND s.catalog_published = true
  );
$$;

REVOKE ALL ON FUNCTION public.store_catalog_is_live(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_catalog_is_live(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.store_catalog_is_live IS 'Usado nas políticas RLS do catálogo público sem expor colunas sensíveis de stores ao anon.';

-- Recriar políticas de leitura pública que referenciam stores
DROP POLICY IF EXISTS categories_public_read ON public.categories;
CREATE POLICY categories_public_read
ON public.categories
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND public.store_catalog_is_live(store_id)
);

DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read
ON public.products
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND public.store_catalog_is_live(store_id)
);

DROP POLICY IF EXISTS product_images_public_read ON public.product_images;
CREATE POLICY product_images_public_read
ON public.product_images
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_images.product_id
      AND p.is_active = true
      AND public.store_catalog_is_live(p.store_id)
  )
);

DROP POLICY IF EXISTS colors_public_read ON public.colors;
CREATE POLICY colors_public_read
ON public.colors
FOR SELECT
TO anon, authenticated
USING (public.store_catalog_is_live(store_id));

DROP POLICY IF EXISTS variants_public_read ON public.product_variants;
CREATE POLICY variants_public_read
ON public.product_variants
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND p.is_active = true
      AND public.store_catalog_is_live(p.store_id)
  )
);

DROP POLICY IF EXISTS variant_images_public_read ON public.variant_images;
CREATE POLICY variant_images_public_read
ON public.variant_images
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    WHERE v.id = variant_images.variant_id
      AND v.is_active = true
      AND p.is_active = true
      AND public.store_catalog_is_live(p.store_id)
  )
);
