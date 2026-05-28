-- Variação padrão do produto (preço alinhado ao produto base/promo).

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Índice único removido em 0021: várias variações podem ser "padrão" ao mesmo tempo.
