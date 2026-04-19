/**
 * Arquivos estáticos em `/public` (logos e ícones da marca da plataforma).
 * Manter estes nomes alinhados aos arquivos na pasta `public/`.
 */
export const BRAND_ASSETS = {
  favicon: '/favicon.png',
  icon: '/logo-sofashop-icon.png',
  logoFull: '/logo-sofashop-full.png',
  pwa192: '/pwa-192x192.png',
  pwa512: '/pwa-512x512.png',
} as const

/** URL absoluta para fetch (PDF, etc.) no browser. */
export function brandAssetAbsoluteUrl(path: string): string {
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`
}
