import { useEffect, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { fetchCatalogStoreBySlug } from '@/services/catalogPublicService'
import { useCart } from '@/contexts/CartContext'
import type { CatalogStoreRow } from '@/types/database'

export function CatalogLayout() {
  const { slug } = useParams<{ slug: string }>()
  const { setStore, lines } = useCart()
  const [store, setStoreState] = useState<CatalogStoreRow | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!slug) return
      try {
        const s = await fetchCatalogStoreBySlug(slug)
        if (!alive) return
        setStoreState(s)
        if (s) setStore(s.id)
      } catch {
        if (alive) setStoreState(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [slug, setStore])

  useEffect(() => {
    if (store === undefined) return
    if (!store) {
      document.title = 'SofáShop — Loja não encontrada'
      return () => {
        document.title = 'SofáShop — Catálogo online'
      }
    }
    document.title = `SofáShop — ${store.trade_name}`
    return () => {
      document.title = 'SofáShop — Catálogo online'
    }
  }, [store])

  if (store === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-ink-500">
        Carregando catálogo…
      </div>
    )
  }

  if (!store) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Loja não encontrada</h1>
        <p className="mt-2 text-sm text-ink-600">Verifique o link ou tente novamente mais tarde.</p>
        <Link className="mt-6 inline-block text-sm font-semibold text-brand-700 hover:underline" to="/">
          Ir ao início
        </Link>
      </div>
    )
  }

  const style = {
    ['--cat-primary' as string]: store.theme_primary,
    ['--cat-accent' as string]: store.theme_accent,
  } as React.CSSProperties

  const cartCount = lines.reduce((n, l) => n + l.qty, 0)

  return (
    <div style={style} className="min-h-svh bg-gradient-to-b from-ink-50 to-white">
      <header className="sticky top-0 z-20 border-b border-[color-mix(in_srgb,var(--cat-primary)_28%,#e5e7eb)] bg-[color-mix(in_srgb,var(--cat-primary)_6%,white)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to={`/loja/${slug}`} className="flex min-w-0 items-center gap-3">
            {store.logo_url ? (
              <img src={store.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover ring-1 ring-[color-mix(in_srgb,var(--cat-primary)_40%,#e5e7eb)]" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--cat-accent)]/15 text-sm font-bold text-[var(--cat-accent)]">
                {store.trade_name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 text-left">
              <p className="truncate font-display text-lg font-semibold text-[var(--cat-primary)]">{store.trade_name}</p>
              <p className="truncate text-xs text-ink-500">{store.city}</p>
            </div>
          </Link>
          <Link
            to={`/loja/${slug}/carrinho`}
            className="relative inline-flex items-center gap-2 rounded-xl border-2 border-[color-mix(in_srgb,var(--cat-primary)_50%,#e5e7eb)] bg-white px-3 py-2 text-sm font-semibold text-[var(--cat-primary)] shadow-sm transition hover:bg-[color-mix(in_srgb,var(--cat-primary)_10%,white)]"
          >
            <ShoppingBag className="h-4 w-4" />
            Carrinho
            {cartCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--cat-accent)] px-1 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            ) : null}
          </Link>
        </div>
      </header>
      <Outlet context={{ store, slug: slug! }} />
    </div>
  )
}
