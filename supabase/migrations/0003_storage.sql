-- ============================================================================
-- Storage — bucket "store-assets" (logos, produtos, variações). Complementa 0002/0001;
-- policies aqui são só de storage.objects, não confundir com RLS de public.*.
-- Crie o bucket no Dashboard (Storage → New bucket) com nome: store-assets
-- Marque como público se quiser URLs diretas, ou use signed URLs (recomendado
-- em produção com RLS de storage mais restrita).
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública (catálogo)
CREATE POLICY store_assets_public_read
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'store-assets');

-- Upload apenas autenticado, pasta prefixada pelo store_id
CREATE POLICY store_assets_member_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM public.stores s
    WHERE public.is_store_member(s.id)
  )
);

CREATE POLICY store_assets_member_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM public.stores s
    WHERE public.is_store_member(s.id)
  )
)
WITH CHECK (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM public.stores s
    WHERE public.is_store_member(s.id)
  )
);

CREATE POLICY store_assets_member_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'store-assets'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM public.stores s
    WHERE public.is_store_member(s.id)
  )
);
