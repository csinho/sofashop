/** Normaliza URL pública de logo (Supabase, protocolo relativo, path absoluto). */
export function normalizeStoreLogoUrl(logo: string | null | undefined): string | null {
  if (logo == null) return null
  const t = String(logo).trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith('//')) return `https:${t}`
  const base = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  if (t.startsWith('/')) {
    if (!base) return t
    if (t.startsWith('/storage/')) return `${base}${t}`
    return t
  }
  return t
}
