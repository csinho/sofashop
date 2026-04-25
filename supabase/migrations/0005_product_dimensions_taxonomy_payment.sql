-- Dimensões do produto, tipos de modelo por loja, config de checkout (taxas) e view atualizada.
-- A view public.catalog_stores_v é recriada em 0009 (filtro publicado + loja ativa + colunas finais).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS dimension_length_cm numeric(12, 2),
  ADD COLUMN IF NOT EXISTS dimension_width_cm numeric(12, 2),
  ADD COLUMN IF NOT EXISTS dimension_height_cm numeric(12, 2);

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS checkout_payment_config jsonb NOT NULL DEFAULT '{
    "accepted_methods": ["pix", "cartao_debito", "cartao_credito", "parcelado", "entrada_parcelado"],
    "card_fee_credit_percent": 0,
    "card_fee_debit_percent": 0
  }'::jsonb;

CREATE TABLE IF NOT EXISTS public.product_model_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (store_id, name)
);

CREATE TRIGGER trg_product_model_types_updated
BEFORE UPDATE ON public.product_model_types
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_product_model_types_store ON public.product_model_types (store_id);

ALTER TABLE public.product_model_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_model_types_public_read
ON public.product_model_types
FOR SELECT
TO anon, authenticated
USING (public.store_catalog_is_live(store_id));

CREATE POLICY product_model_types_member_write
ON public.product_model_types
FOR ALL
TO authenticated
USING (public.is_store_member(store_id))
WITH CHECK (public.is_store_member(store_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_model_types TO authenticated;
GRANT SELECT ON public.product_model_types TO anon;

-- Tipos padrão para lojas já existentes
INSERT INTO public.product_model_types (store_id, name, sort_order)
SELECT s.id, v.name, v.ord
FROM public.stores s
CROSS JOIN (
  VALUES
    ('Sofá fixo', 1),
    ('Sofá retrátil', 2),
    ('Sofá reclinável', 3),
    ('Sofá retrátil e reclinável', 4),
    ('Sofá-cama', 5),
    ('Sofá de canto', 6),
    ('Sofá modular', 7),
    ('Sofá com chaise', 8),
    ('Sofá 2 lugares', 9),
    ('Sofá 3 lugares', 10),
    ('Sofá 4 lugares ou mais', 11)
) AS v(name, ord)
ON CONFLICT (store_id, name) DO NOTHING;

-- Novas lojas: tipos padrão após insert
CREATE OR REPLACE FUNCTION public.seed_default_product_model_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.product_model_types (store_id, name, sort_order) VALUES
    (NEW.id, 'Sofá fixo', 1),
    (NEW.id, 'Sofá retrátil', 2),
    (NEW.id, 'Sofá reclinável', 3),
    (NEW.id, 'Sofá retrátil e reclinável', 4),
    (NEW.id, 'Sofá-cama', 5),
    (NEW.id, 'Sofá de canto', 6),
    (NEW.id, 'Sofá modular', 7),
    (NEW.id, 'Sofá com chaise', 8),
    (NEW.id, 'Sofá 2 lugares', 9),
    (NEW.id, 'Sofá 3 lugares', 10),
    (NEW.id, 'Sofá 4 lugares ou mais', 11)
  ON CONFLICT (store_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stores_seed_model_types ON public.stores;
CREATE TRIGGER trg_stores_seed_model_types
AFTER INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.seed_default_product_model_types();

-- View pública com tema + config checkout (somente chaves seguras)
CREATE OR REPLACE VIEW public.catalog_stores_v AS
SELECT
  id,
  slug,
  trade_name,
  logo_url,
  banner_url,
  phone_main,
  whatsapp_1,
  whatsapp_2,
  cep,
  street,
  number,
  complement,
  district,
  city,
  state,
  institutional_text,
  theme_primary,
  theme_accent,
  policy_text,
  whatsapp_orders_phone,
  catalog_published,
  checkout_payment_config
FROM public.stores
WHERE catalog_published = true;

GRANT SELECT ON public.catalog_stores_v TO anon, authenticated;
