import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { fetchStoreBilling, type StoreBillingSafe } from '@/services/billingService'

function newChannelInstanceId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

export function useStoreBilling(storeId: string | undefined) {
  const [billing, setBilling] = useState<StoreBillingSafe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelInstanceIdRef = useRef(newChannelInstanceId())

  const refresh = useCallback(async () => {
    if (!storeId) {
      setBilling(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await fetchStoreBilling(storeId)
      setBilling(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar plano')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!storeId) return undefined
    const sb = getSupabaseBrowserClient()
    const channel = sb
      .channel(`store-billing-${storeId}-${channelInstanceIdRef.current}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stores', filter: `id=eq.${storeId}` },
        () => {
          void refreshRef.current()
        },
      )
      .subscribe()
    return () => {
      void sb.removeChannel(channel)
    }
  }, [storeId])

  return { billing, loading, error, refresh }
}
