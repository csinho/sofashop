/** Preço de vitrine do produto (promo válida ou preço base). */
export function productListPrice(p: { base_price: number; promo_price?: number | null }): number {
  const base = Number(p.base_price) || 0
  const promo = p.promo_price != null ? Number(p.promo_price) : null
  if (promo != null && promo > 0 && promo < base) return promo
  return base
}

/** Preço próprio da variação; null se vazio, zero ou não informado. */
export function variantPriceOverrideValue(variant: { price_override: number | null } | null | undefined): number | null {
  if (!variant || variant.price_override == null) return null
  const n = Number(variant.price_override)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

type VariantPricing = {
  price_override: number | null
  is_default?: boolean
}

/** Preço exibido/cobrado para a variação escolhida (ou vitrine se nenhuma). */
export function variantUnitPrice(
  product: { base_price: number; promo_price?: number | null },
  variant: VariantPricing | null | undefined,
): number {
  if (variant?.is_default) return productListPrice(product)
  const override = variantPriceOverrideValue(variant)
  if (override != null) return override
  return productListPrice(product)
}

/** Preço usado em listagens e filtros do catálogo (não usa mínimo das variações). */
export function effectivePrice(p: { base_price: number; promo_price?: number | null }) {
  return productListPrice(p)
}
