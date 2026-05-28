import { getSupabaseCatalogClient } from '@/integrations/supabase/client'
import { variantUnitPrice } from '@/lib/productPricing'
import type { CartLine } from '@/contexts/CartContext'

export type CartPriceChange = {
  key: string
  name: string
  variantLabel?: string
  qty: number
  oldPrice: number
  newPrice: number
}

type ProductRow = {
  id: string
  base_price: number
  promo_price: number | null
  product_variants: {
    id: string
    price_override: number | null
    is_active: boolean
    is_default: boolean
  }[]
}

const PRICE_EPS = 0.009

export async function fetchCartPriceChanges(storeId: string, lines: CartLine[]): Promise<CartPriceChange[]> {
  if (!lines.length) return []

  const productIds = [...new Set(lines.map((l) => l.productId))]
  const sb = getSupabaseCatalogClient()
  const { data, error } = await sb
    .from('products')
    .select(
      `id, base_price, promo_price,
      product_variants ( id, price_override, is_active, is_default )`,
    )
    .eq('store_id', storeId)
    .eq('is_active', true)
    .in('id', productIds)

  if (error) throw error

  const byId = new Map(((data ?? []) as ProductRow[]).map((p) => [p.id, p]))
  const changes: CartPriceChange[] = []

  for (const line of lines) {
    const p = byId.get(line.productId)
    if (!p) {
      changes.push({
        key: line.key,
        name: line.name,
        variantLabel: line.variantLabel,
        qty: line.qty,
        oldPrice: line.unitPrice,
        newPrice: line.unitPrice,
      })
      continue
    }

    const variant =
      line.variantId != null
        ? (p.product_variants ?? []).find((v) => v.id === line.variantId && v.is_active)
        : null

    const newPrice = variantUnitPrice(
      { base_price: Number(p.base_price), promo_price: p.promo_price != null ? Number(p.promo_price) : null },
      variant ?? null,
    )

    if (Math.abs(newPrice - line.unitPrice) > PRICE_EPS) {
      changes.push({
        key: line.key,
        name: line.name,
        variantLabel: line.variantLabel,
        qty: line.qty,
        oldPrice: line.unitPrice,
        newPrice,
      })
    }
  }

  return changes
}
