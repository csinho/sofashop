import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { fetchPublicCatalogAccess } from '@/services/catalogPublicService'
import { useCart } from '@/contexts/CartContext'
import type { CatalogStoreRow } from '@/types/database'
import { getDefaultDocumentTitle, getPwaBrandName } from '@/lib/documentTitle'
import { CatalogTopBanner } from '@/components/catalog/CatalogTopBanner'

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'ok'; store: CatalogStoreRow }
  | { kind: 'not_found' }
  | { kind: 'inactive'; trade_name: string }
  | { kind: 'unpublished'; trade_name: string }

export function CatalogLayout() {
  const { slug } = useParams<{ slug: string }>()
  const loc = useLocation()
  const nav = useNavigate()
  const { setStore, lines, clear } = useCart()
  const [state, setState] = useState<CatalogState>({ kind: 'loading' })
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!slug) return
      try {
        const res = await fetchPublicCatalogAccess(slug)
        if (!alive) return
        if (res.status === 'ok') {
          setState({ kind: 'ok', store: res.store })
          setStore(res.store.id)
        } else {
          clear()
          if (res.status === 'not_found') setState({ kind: 'not_found' })
          else if (res.status === 'inactive') setState({ kind: 'inactive', trade_name: res.trade_name })
          else setState({ kind: 'unpublished', trade_name: res.trade_name })
        }
      } catch {
        if (alive) {
          clear()
          setState({ kind: 'not_found' })
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [slug, setStore, clear])

  useEffect(() => {
    if (state.kind === 'loading') return
    const brand = getPwaBrandName()
    if (state.kind === 'ok') {
      document.title = `${brand} — ${state.store.trade_name}`
      return () => {
        document.title = getDefaultDocumentTitle()
      }
    }
    if (state.kind === 'not_found') {
      document.title = `${brand} — Loja não encontrada`
    } else if (state.kind === 'inactive' || state.kind === 'unpublished') {
      document.title = `${brand} — Loja indisponível`
    } else {
      document.title = `${brand} — Erro`
    }
    return () => {
      document.title = getDefaultDocumentTitle()
    }
  }, [state])

  useEffect(() => {
    setBannerImageUrl(null)
  }, [loc.pathname])

  if (state.kind === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-ink-500">
        Carregando catálogo…
      </div>
    )
  }

  if (state.kind === 'not_found') {
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

  if (state.kind === 'inactive') {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">Loja indisponível</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-900">Esta loja está inativa no momento</h1>
        <p className="mt-2 text-sm text-ink-600">
          {state.trade_name ? (
            <>Você tentou acessar <span className="font-semibold text-ink-800">{state.trade_name}</span>. </>
          ) : null}
          A loja foi temporariamente desativada. Entre em contato com o vendedor se precisar.
        </p>
      </div>
    )
  }

  if (state.kind === 'unpublished') {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">Loja indisponível</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-900">O catálogo desta loja não está publicado no momento</h1>
        <p className="mt-2 text-sm text-ink-600">
          {state.trade_name ? (
            <>Você tentou acessar <span className="font-semibold text-ink-800">{state.trade_name}</span>. </>
          ) : null}
          Entre em contato com a loja ou tente novamente mais tarde.
        </p>
        <Link className="mt-6 inline-block text-sm font-semibold text-brand-700 hover:underline" to="/">
          Ir ao início
        </Link>
      </div>
    )
  }

  if (state.kind !== 'ok') {
    return null
  }
  const { store } = state

  const style = {
    ['--cat-primary' as string]: store.theme_primary,
    ['--cat-accent' as string]: store.theme_accent,
  } as React.CSSProperties

  const cartCount = lines.filter((l) => l.storeId === store.id).reduce((n, l) => n + l.qty, 0)
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
