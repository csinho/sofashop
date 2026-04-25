import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { normalizeStoreLogoUrl } from '@/lib/storeImageUrl'

export type PlatformStoreSummary = {
  id: string
  slug: string
  trade_name: string
  legal_name: string
  email_contact: string
  logo_url: string | null
  is_active: boolean
  catalog_published: boolean
  created_at: string
  customer_count: number
  order_count: number
  orders_total: number
  /** Soma (R$) de pedidos com status entregue */
  orders_sum_delivered: number
  orders_count_delivered: number
  /** Soma (R$) de pedidos ainda não entregues (exclui cancelado) */
  orders_sum_not_delivered: number
  orders_count_not_delivered: number
}

function num(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function parseStoreSummary(raw: unknown): PlatformStoreSummary {
  const r = (
    typeof raw === 'string' && raw.trim() !== '' ? (JSON.parse(raw) as unknown) : raw
  ) as Record<string, unknown> | null
  if (r == null || typeof r !== 'object') {
    throw new Error('Resposta inválida do servidor (loja).')
  }
  const logoFromApi = r.logo_url ?? r['logoUrl']
  return {
    id: String(r.id ?? ''),
    slug: String(r.slug ?? ''),
    trade_name: String(r.trade_name ?? ''),
    legal_name: String(r.legal_name ?? ''),
    email_contact: String(r.email_contact ?? ''),
    logo_url: normalizeStoreLogoUrl(logoFromApi as string | null | undefined),
    is_active: Boolean(r.is_active),
    catalog_published: Boolean(r.catalog_published),
    created_at: String(r.created_at ?? ''),
    customer_count: num(r.customer_count),
    order_count: num(r.order_count),
    orders_total: num(r.orders_total),
    orders_sum_delivered: num(r.orders_sum_delivered),
    orders_count_delivered: num(r.orders_count_delivered),
    orders_sum_not_delivered: num(r.orders_sum_not_delivered),
    orders_count_not_delivered: num(r.orders_count_not_delivered),
  }
}

function parseList(data: unknown): PlatformStoreSummary[] {
  if (data == null) return []
  const arr = Array.isArray(data) ? data : JSON.parse(String(data))
  if (!Array.isArray(arr)) return []
  return arr.map((row) => parseStoreSummary(row))
}

export async function isPlatformAdmin(): Promise<boolean> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.rpc('is_platform_admin')
  if (error) return false
  return Boolean(data)
}

export async function listPlatformStores(): Promise<PlatformStoreSummary[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.rpc('platform_list_stores')
  if (error) throw error
  return parseList(data)
}

export async function getPlatformStore(storeId: string): Promise<PlatformStoreSummary | null> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.rpc('platform_get_store', { p_store_id: storeId })
  if (error) throw error
  if (data == null) return null
  return parseStoreSummary(data)
}

export async function setStoreActive(storeId: string, isActive: boolean): Promise<void> {
  const sb = getSupabaseBrowserClient()
  const { error } = await sb.rpc('platform_set_store_is_active', { p_store_id: storeId, p_is_active: isActive })
  if (error) throw error
}
