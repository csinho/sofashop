import { getSupabaseCatalogClient } from '@/integrations/supabase/client'
import type { CatalogStoreRow } from '@/types/database'

export async function fetchCatalogStoreBySlug(slug: string) {
  const sb = getSupabaseCatalogClient()
  const { data, error } = await sb.from('catalog_stores_v').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data as CatalogStoreRow | null
}

export type CatalogProductFilters = {
  categoryId?: string
  modelType?: string
  colorHex?: string
  minPrice?: number
  maxPrice?: number
  search?: string
  minLengthCm?: number
  maxLengthCm?: number
  minWidthCm?: number
  maxWidthCm?: number
  minHeightCm?: number
  maxHeightCm?: number
}

export async function fetchCatalogProducts(storeId: string, filters: CatalogProductFilters) {
  const sb = getSupabaseCatalogClient()
  let q = sb
    .from('products')
    .select(
      `
      *,
      categories ( id, name, slug ),
      product_images ( id, url, sort_order ),
      product_variants (
        id, name, price_override, stock, sort_order, is_active,
        color_id,
        colors ( id, name, hex ),
        variant_images ( id, url, sort_order )
      )
    `,
    )
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.categoryId) {
    q = q.eq('category_id', filters.categoryId)
  }
  if (filters.modelType) {
    q = q.eq('model_type', filters.modelType)
  }

  const { data, error } = await q
  if (error) throw error

  type Row = Record<string, unknown>
  let rows = (data ?? []) as Row[]

  if (filters.search?.trim()) {
    const t = filters.search.trim().toLowerCase()
    rows = rows.filter(
      (r) =>
        String(r.name ?? '')
          .toLowerCase()
          .includes(t) ||
        String(r.sku ?? '')
          .toLowerCase()
          .includes(t) ||
        String(r.short_description ?? '')
          .toLowerCase()
          .includes(t),
    )
  }

  if (filters.minPrice != null) {
    rows = rows.filter((r) => effectivePrice(r as never) >= filters.minPrice!)
  }
  if (filters.maxPrice != null) {
    rows = rows.filter((r) => effectivePrice(r as never) <= filters.maxPrice!)
  }
  if (filters.colorHex) {
    const hex = filters.colorHex.toLowerCase()
    rows = rows.filter((r) => {
      const vars = (r.product_variants as Row[] | undefined) ?? []
      return vars.some((v) => {
        const c = v.colors as { hex?: string } | null
        return c?.hex?.toLowerCase() === hex
      })
    })
  }

  const num = (v: unknown) => (v == null || v === '' ? null : Number(v))
  const dimOk = (r: Row) => {
    const L = num(r.dimension_length_cm)
    const W = num(r.dimension_width_cm)
    const H = num(r.dimension_height_cm)
    if (filters.minLengthCm != null && (L == null || L < filters.minLengthCm)) return false
    if (filters.maxLengthCm != null && (L == null || L > filters.maxLengthCm)) return false
    if (filters.minWidthCm != null && (W == null || W < filters.minWidthCm)) return false
    if (filters.maxWidthCm != null && (W == null || W > filters.maxWidthCm)) return false
    if (filters.minHeightCm != null && (H == null || H < filters.minHeightCm)) return false
    if (filters.maxHeightCm != null && (H == null || H > filters.maxHeightCm)) return false
    return true
  }
  if (
    filters.minLengthCm != null ||
    filters.maxLengthCm != null ||
    filters.minWidthCm != null ||
    filters.maxWidthCm != null ||
    filters.minHeightCm != null ||
    filters.maxHeightCm != null
  ) {
    rows = rows.filter(dimOk)
  }

  return rows
}

export async function fetchCatalogModelTypes(storeId: string) {
  const sb = getSupabaseCatalogClient()
  const { data, error } = await sb
    .from('product_model_types')
    .select('id, name, sort_order')
    .eq('store_id', storeId)
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as { id: string; name: string; sort_order: number }[]
}

export function effectivePrice(p: {
  base_price: number
  promo_price: number | null
  product_variants?: { price_override: number | null; is_active: boolean }[]
}) {
  const base = p.promo_price != null ? p.promo_price : p.base_price
  const overrides = (p.product_variants ?? [])
    .filter((v) => v.is_active && v.price_override != null)
    .map((v) => v.price_override as number)
  if (!overrides.length) return base
  return Math.min(base, ...overrides)
}

export async function fetchCatalogProductBySlug(storeId: string, productSlug: string) {
  const sb = getSupabaseCatalogClient()
  const { data, error } = await sb
    .from('products')
    .select(
      `
      *,
      categories ( id, name, slug ),
      product_images ( id, url, sort_order, alt ),
      product_variants (
        id, name, sku_suffix, price_override, stock, sort_order, is_active, color_id,
        colors ( id, name, hex ),
        variant_images ( id, url, sort_order, alt )
      )
    `,
    )
    .eq('store_id', storeId)
    .eq('slug', productSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function fetchCatalogCategories(storeId: string) {
  const sb = getSupabaseCatalogClient()
  const { data, error } = await sb
    .from('categories')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error
  return data ?? []
}
