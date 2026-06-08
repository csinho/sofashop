import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { resolveAuthenticatedHomePath } from '@/lib/authHomePath'

/**
 * Resolve a rota do painel quando há sessão Supabase (loja → /admin, plataforma → /plataforma).
 */
export function useAuthenticatedHomePath() {
  const { user, loading: authLoading, recoveryPending } = useAuth()
  const [homePath, setHomePath] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!user || recoveryPending) {
      setHomePath(null)
      setResolving(false)
      return
    }

    let alive = true
    setResolving(true)
    void resolveAuthenticatedHomePath()
      .then((path) => {
        if (alive) setHomePath(path)
      })
      .catch(() => {
        if (alive) setHomePath('/login')
      })
      .finally(() => {
        if (alive) setResolving(false)
      })

    return () => {
      alive = false
    }
  }, [user, authLoading, recoveryPending])

  const shouldRedirect = Boolean(user && !recoveryPending)

  return {
    homePath: shouldRedirect ? homePath : null,
    loading: authLoading || (shouldRedirect && resolving),
  }
}
