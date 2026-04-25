import { getSupabaseCatalogClient } from '@/integrations/supabase/client'
import type { CatalogStoreRow } from '@/types/database'

export type PublicCatalogAccess =
  | { status: 'ok'; store: CatalogStoreRow }
  | { status: 'not_found' }
  | { status: 'inactive'; trade_name: string }
  | { status: 'unpublished'; trade_name: string }

function parseCatalogRow(raw: unknown): CatalogStoreRow {
  const s = raw as Record<string, unknown> & { checkout_payment_config?: unknown }
  return {
    ...(s as unknown as CatalogStoreRow),
    checkout_payment_config: (s.checkout_payment_config ?? null) as CatalogStoreRow['checkout_payment_config'],
  }
}

/**
 * Loja pública: usa RPC (slug inativo / não publicado / 404) sem vazar CPF, etc.
 */
export async function fetchPublicCatalogAccess(slug: string): Promise<PublicCatalogAccess> {
  const sb = getSupabaseCatalogClient()
  const { data, error } = await sb.rpc('get_public_catalog_store', { p_slug: slug })
  if (error) throw error
  const j = (typeof data === 'string' ? JSON.parse(data) : data) as Record<string, unknown>
  const st = j.status as string
  if (st === 'ok' && j.store) {
    const store = parseCatalogRow(j.store)
    return { status: 'ok', store: { ...store, is_active: true } }
  }
  if (st === 'inactive' && j.trade_name) {
    return { status: 'inactive', trade_name: String(j.trade_name) }
  }
  if (st === 'unpublished' && j.trade_name) {
    return { status: 'unpublished', trade_name: String(j.trade_name) }
  }
  return { status: 'not_found' }
}

/** @deprecated Prefer fetchPublicCatalogAccess. Mantido para retorno só da loja “ok”. */
export async function fetchCatalogStoreBySlug(slug: string): Promise<CatalogStoreRow | null> {
  const res = await fetchPublicCatalogAccess(slug)
  return res.status === 'ok' ? res.store : null
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
