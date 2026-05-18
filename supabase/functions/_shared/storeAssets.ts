/** URL pública de asset no Storage Supabase (banner/logo). */
export function publicStoreAssetUrl(path: string | null | undefined): string | null {
  if (path == null) return null
  const t = String(path).trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith('//')) return `https:${t}`
  const base = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '')
  if (!base) return t
  if (t.startsWith('/storage/')) return `${base}${t}`
  if (t.startsWith('/')) return `${base}${t}`
  return t
}

export function appPublicBaseUrl(storeAppBaseUrl: string | null | undefined): string {
  const fromStore = (storeAppBaseUrl ?? '').trim().replace(/\/$/, '')
  if (fromStore) return fromStore
  const secret = (Deno.env.get('APP_PUBLIC_URL') ?? '').trim().replace(/\/$/, '')
  return secret
}

export function buildOrderAdminUrl(baseUrl: string, orderId: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return `${base}/admin/pedidos/${orderId}`
}
