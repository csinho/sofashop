import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { StoreRow } from '@/types/database'

type Link = { store_id: string; role: string; stores: StoreRow | StoreRow[] | null }

export function useMyStore() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<StoreRow | null>(null)
  const [role, setRole] = useState<string | null>(null)
  /** Evita tela “Carregando painel…” em todo refresh (ex.: token ao voltar à aba), que desmontava formulários. */
  const hasLoadedStoreRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!user) {
      hasLoadedStoreRef.current = false
      setStore(null)
      setRole(null)
      setLoading(false)
      return
    }
    if (!hasLoadedStoreRef.current) setLoading(true)
    const sb = getSupabaseBrowserClient()
    const { data, error } = await sb
      .from('store_users')
      .select('store_id, role, stores(*)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error(error)
      setStore(null)
      setRole(null)
    } else {
      const row = data as unknown as Link | null
      const s = row?.stores
      const one = Array.isArray(s) ? s[0] : s
      setStore(one ?? null)
      setRole(row?.role ?? null)
      if (one) hasLoadedStoreRef.current = true
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, refresh])

  return { store, role, loading: authLoading || loading, refresh }
}
