const STORAGE_KEY = 'vender:pwaPreferredStart'

/**
 * O manifest do PWA só pode ter um `start_url` (ex.: "/"). Gravamos a última
 * rota "útil" (catálogo da loja ou /admin) para, ao abrir o app instalado,
 * redirecionar o usuário para o lugar certo.
 */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function normalizePath(value: string): string {
  return value.split('#')[0] ?? value
}

export function isSafePwaInternalPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false
  const p = path.split('?')[0] ?? path
  if (p === '/admin') return true
  if (p.startsWith('/admin/')) return true
  if (p.startsWith('/loja/')) return true
  return false
}

export function getPreferredPwaStartPath(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return isSafePwaInternalPath(raw) ? normalizePath(raw) : null
  } catch {
    return null
  }
}

export function setPreferredPwaStartPath(path: string) {
  const n = normalizePath(path)
  if (!isSafePwaInternalPath(n)) return
  try {
    localStorage.setItem(STORAGE_KEY, n)
  } catch {
    /* ignore */
  }
}

export function getCurrentPathnameWithSearch(): string {
  if (typeof window === 'undefined') return '/'
  return normalizePath(`${window.location.pathname}${window.location.search}` || '/')
}
