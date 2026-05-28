import { useEffect } from 'react'
import { getSupabaseCatalogClient } from '@/integrations/supabase/client'

/** Recarrega dados do catálogo quando produtos/variações mudam no painel (Supabase Realtime + fallback). */
export function useStoreCatalogRealtime(storeId: string, onRefresh: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled || !storeId) return

    let cancelled = false
    const tick = () => {
      if (!cancelled) onRefresh()
    }

    const sb = getSupabaseCatalogClient()
    const channel = sb
      .channel(`catalog-store-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `store_id=eq.${storeId}` },
        tick,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_variants' },
        (payload) => {
          const row = payload.new as { product_id?: string } | null
          const old = payload.old as { product_id?: string } | null
          if (row?.product_id || old?.product_id) tick()
        },
      )
      .subscribe()

    const poll = window.setInterval(tick, 20_000)

    return () => {
      cancelled = true
      window.clearInterval(poll)
      void sb.removeChannel(channel)
    }
  }, [storeId, onRefresh, enabled])
}

export function useProductCatalogRealtime(productId: string | null, onRefresh: () => void) {
  useEffect(() => {
    if (!productId) return

    let cancelled = false
    const tick = () => {
      if (!cancelled) onRefresh()
    }

    const sb = getSupabaseCatalogClient()
    const channel = sb
      .channel(`catalog-product-${productId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `id=eq.${productId}` },
        tick,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_variants', filter: `product_id=eq.${productId}` },
        tick,
      )
      .subscribe()

    const poll = window.setInterval(tick, 15_000)

    return () => {
      cancelled = true
      window.clearInterval(poll)
      void sb.removeChannel(channel)
    }
  }, [productId, onRefresh])
}
