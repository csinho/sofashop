import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getCurrentPathnameWithSearch, setPreferredPwaStartPath } from '@/lib/pwaEntry'

/**
 * Grava a rota de entrada preferida do PWA (última visita ao catálogo de uma loja ou ao admin).
 * Também captura o `beforeinstallprompt` para associar a instalação à URL aberta nesse momento.
 */
export function PwaEntryHandler() {
  const loc = useLocation()

  useEffect(() => {
    const path = loc.pathname
    const p = `${path}${loc.search || ''}` || '/'
    if (p.startsWith('/loja/') || path === '/admin' || path.startsWith('/admin/')) {
      setPreferredPwaStartPath(p)
    }
  }, [loc.pathname, loc.search])

  useEffect(() => {
    const onBeforeInstall = () => {
      setPreferredPwaStartPath(getCurrentPathnameWithSearch())
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  return null
}
