import { useEffect, useRef, useState } from 'react'
import type { MouseEventHandler } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShoppingBag } from 'lucide-react'
import type { CatalogStoreRow } from '@/types/database'

type Props = {
  store: CatalogStoreRow
  slug: string
  cartCount: number
  bannerImageUrl?: string | null
  showCartButton?: boolean
  showBackButton?: boolean
  onBackClick?: MouseEventHandler<HTMLButtonElement>
}

export function CatalogTopBanner({
  store,
  slug,
  cartCount,
  bannerImageUrl,
  showCartButton = true,
  showBackButton = false,
  onBackClick,
}: Props) {
  const [cartPulse, setCartPulse] = useState(false)
  const prevCountRef = useRef(cartCount)

  useEffect(() => {
    const prev = prevCountRef.current
    prevCountRef.current = cartCount
    if (cartCount <= prev) return
    setCartPulse(true)
    const t = window.setTimeout(() => setCartPulse(false), 700)
    return () => window.clearTimeout(t)
  }, [cartCount])

  const bannerSrc = bannerImageUrl || store.banner_url
  if (!bannerSrc) return null

  return (
    <div className="catalog-banner-curved fixed inset-x-0 top-0 z-40 shadow-sm">
      <img src={bannerSrc} alt="" className="relative z-0 h-56 w-full object-cover md:h-80" />
      <div className="absolute inset-0 z-10 bg-black/45" />
      {showBackButton ? (
        <button
          type="button"
          onClick={onBackClick}
          className="absolute left-4 top-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[var(--cat-primary)] shadow-md"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : null}
      {showCartButton ? (
        <Link
          to={`/loja/${slug}/carrinho`}
          className={`absolute right-4 top-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[var(--cat-primary)] shadow-md ${
            cartPulse ? 'cart-bump' : ''
          }`}
          aria-label="Abrir carrinho"
        >
          <ShoppingBag className="h-5 w-5" />
          {cartCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--cat-accent)] px-1 text-[10px] font-bold text-white">
              {cartCount}
            </span>
          ) : null}
        </Link>
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-4 text-center">
        {store.logo_url ? <img src={store.logo_url} alt="" className="h-16 w-16 rounded-2xl object-cover md:h-20 md:w-20" /> : null}
        <p className="mt-3 font-display text-2xl font-semibold text-white md:text-3xl">{store.trade_name}</p>
        {store.city ? <p className="mt-1 text-sm text-white/90">{store.city}</p> : null}
      </div>
    </div>
  )
}

