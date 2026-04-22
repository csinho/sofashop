import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { fetchCatalogStoreBySlug } from '@/services/catalogPublicService'
import { useCart } from '@/contexts/CartContext'
import type { CatalogStoreRow } from '@/types/database'
import { getDefaultDocumentTitle, getPwaBrandName } from '@/lib/documentTitle'
import { CatalogTopBanner } from '@/components/catalog/CatalogTopBanner'

export function CatalogLayout() {
  const { slug } = useParams<{ slug: string }>()
  const loc = useLocation()
  const nav = useNavigate()
  const { setStore, lines } = useCart()
  const [store, setStoreState] = useState<CatalogStoreRow | null | undefined>(undefined)
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null)

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
    const brand = getPwaBrandName()
    if (!store) {
      document.title = `${brand} — Loja não encontrada`
      return () => {
        document.title = getDefaultDocumentTitle()
      }
    }
    document.title = `${brand} — ${store.trade_name}`
    return () => {
      document.title = getDefaultDocumentTitle()
    }
  }, [store])

  useEffect(() => {
    setBannerImageUrl(null)
  }, [loc.pathname])

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
  const basePath = `/loja/${slug}`
  const showCartButton = loc.pathname === basePath || loc.pathname.startsWith(`${basePath}/produto/`)
  const showBackButton =
    loc.pathname.startsWith(`${basePath}/produto/`) || loc.pathname === `${basePath}/carrinho` || loc.pathname === `${basePath}/checkout`

  function onBackClick() {
    if (window.history.length > 1) {
      nav(-1)
      return
    }
    nav(basePath)
  }

  return (
    <div style={style} className="min-h-svh bg-gradient-to-b from-ink-50 to-white">
      <CatalogTopBanner
        store={store}
        slug={slug!}
        cartCount={cartCount}
        bannerImageUrl={bannerImageUrl}
        showCartButton={showCartButton}
        showBackButton={showBackButton}
        onBackClick={onBackClick}
      />
      <div className="pt-56 md:pt-80">
        <Outlet context={{ store, slug: slug!, cartCount, setBannerImageUrl }} />
      </div>
    </div>
  )
}
