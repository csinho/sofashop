import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/format'
import { IntegerField } from '@/components/ui/IntegerField'
import { ProductImageGallery } from '@/components/catalog/ProductImageGallery'
import { effectivePrice, fetchCatalogProductBySlug } from '@/services/catalogPublicService'
import { notifyInfo, notifyOk } from '@/lib/notify'
import { useCart } from '@/contexts/CartContext'
import type { CatalogOutletCtx } from '@/pages/public/catalogTypes'

type Variant = {
  id: string
  name: string
  sku_suffix: string
  price_override: number | null
  stock: number | null
  is_active: boolean
  colors: { name: string; hex: string } | null
  variant_images: { url: string; sort_order: number }[]
}

export function ProductDetailPage() {
  const { store, slug } = useOutletContext<CatalogOutletCtx>()
  const { productSlug } = useParams<{ productSlug: string }>()
  const nav = useNavigate()
  const { addLine } = useCart()
  const [product, setProduct] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [variantId, setVariantId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!productSlug) return
      setLoading(true)
      try {
        const p = await fetchCatalogProductBySlug(store.id, productSlug)
        if (!alive) return
        setProduct(p as Record<string, unknown> | null)
        const vars = ((p as Record<string, unknown> | null)?.product_variants as Variant[] | undefined) ?? []
        const first = vars.find((v) => v.is_active)
        setVariantId(first?.id ?? null)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [store.id, productSlug])

  const variants = (product?.product_variants as Variant[] | undefined) ?? []
  const activeVariants = variants.filter((v) => v.is_active)

  const selected = activeVariants.find((v) => v.id === variantId) ?? activeVariants[0]

  const basePrice = useMemo(() => {
    if (!product) return 0
    return effectivePrice(product as never)
  }, [product])

  const unitPrice = useMemo(() => {
    if (selected?.price_override != null) return Math.min(basePrice, selected.price_override)
    return basePrice
  }, [basePrice, selected])

  const images = useMemo(() => {
    const fromVariant = selected?.variant_images?.slice().sort((a, b) => a.sort_order - b.sort_order) ?? []
    if (fromVariant.length) return fromVariant.map((i) => i.url)
    const pis =
      (product?.product_images as { url: string; sort_order: number }[] | undefined)?.slice().sort((a, b) => a.sort_order - b.sort_order) ?? []
    return pis.map((i) => i.url)
  }, [product, selected])

  if (loading) return <div className="p-10 text-center text-ink-500">Carregando…</div>
  if (!product) {
    return (
      <div className="p-10 text-center">
        <p className="text-ink-600">Produto não encontrado.</p>
        <Link className="mt-4 inline-block text-[var(--cat-primary)]" to={`/loja/${slug}`}>
          Voltar ao catálogo
        </Link>
      </div>
    )
  }

  const sku = `${String(product.sku)}${selected?.sku_suffix ? '-' + selected.sku_suffix : ''}`

  const lenCm = product.dimension_length_cm
  const widCm = product.dimension_width_cm
  const hCm = product.dimension_height_cm
  const hasDims = [lenCm, widCm, hCm].some((v) => v != null && v !== '')

  function fmtCm(v: unknown): string {
    if (v == null || v === '') return '—'
    const n = Number(v)
    if (Number.isNaN(n)) return String(v)
    return Number.isInteger(n) ? `${n}` : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  }

  function handleAdd() {
    if (!product) return
    addLine({
      storeId: store.id,
      productId: String(product.id),
      variantId: selected?.id ?? null,
      name: String(product.name),
      sku,
      qty,
      unitPrice,
      imageUrl: images[0],
      colorName: selected?.colors?.name,
      variantLabel: selected?.name,
    })
    notifyOk('Produto adicionado ao carrinho.')
    nav(`/loja/${slug}/carrinho`)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
        <Link to={`/loja/${slug}`} className="text-sm font-medium text-[var(--cat-primary)] hover:underline">
          ← Catálogo
        </Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <ProductImageGallery urls={images} alt={String(product.name)} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            {(product.categories as { name?: string } | null)?.name}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-[var(--cat-primary)]">{String(product.name)}</h1>
          <p className="mt-2 text-sm text-ink-600">{String(product.short_description ?? '')}</p>
          <p className="mt-4 text-3xl font-bold text-[var(--cat-accent)]">{formatCurrency(unitPrice)}</p>
          {product.promo_price != null ? (
            <p className="text-sm text-ink-400 line-through">{formatCurrency(Number(product.base_price))}</p>
          ) : null}

          {hasDims ? (
            <div className="mt-6 rounded-2xl border border-ink-200 bg-ink-50/80 px-4 py-3 text-sm text-ink-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Dimensões do produto</p>
              <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-ink-500">Comprimento</dt>
                  <dd className="font-medium text-ink-900">{fmtCm(lenCm)} cm</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Largura</dt>
                  <dd className="font-medium text-ink-900">{fmtCm(widCm)} cm</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Altura</dt>
                  <dd className="font-medium text-ink-900">{fmtCm(hCm)} cm</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-ink-500">Medidas aproximadas em centímetros; podem variar conforme montagem ou estoque.</p>
            </div>
          ) : null}

          {activeVariants.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs font-medium text-ink-600">Cor / variação</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeVariants.map((v) => {
                  const active = v.id === (selected?.id ?? variantId)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setVariantId(v.id)
                        notifyInfo('Variação selecionada.')
                      }}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        active
                          ? 'border-[var(--cat-accent)] bg-[var(--cat-accent)]/10 text-ink-900'
                          : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300'
                      }`}
                    >
                      {v.colors ? (
                        <span className="h-4 w-4 rounded-full ring-1 ring-ink-200" style={{ background: v.colors.hex }} />
                      ) : null}
                      {v.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <label className="text-xs font-medium text-ink-600">Qtd</label>
            <IntegerField
              className="w-20"
              value={String(qty)}
              onValueChange={(d) => setQty(Math.max(1, Number(d) || 1))}
            />
          </div>

          <Button variant="catalog" className="mt-8 w-full max-w-sm py-3 text-base" onClick={handleAdd}>
            Adicionar ao carrinho
          </Button>

          <Card className="mt-8 space-y-2 text-sm text-ink-700">
            <h3 className="font-display text-lg font-semibold text-ink-900">Detalhes</h3>
            <p className="whitespace-pre-wrap">{String(product.description ?? '')}</p>
            <p className="text-xs text-ink-500">Prazo estimado: {String(product.delivery_days)} dias úteis</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
