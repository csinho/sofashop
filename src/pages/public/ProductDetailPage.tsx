import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/format'
import { IntegerField } from '@/components/ui/IntegerField'
import { ProductImageGallery } from '@/components/catalog/ProductImageGallery'
import { catalogAvailableQty } from '@/lib/productStock'
import { fetchCatalogProductBySlug } from '@/services/catalogPublicService'
import { productListPrice, variantPriceOverrideValue, variantUnitPrice } from '@/lib/productPricing'
import { notifyInfo, notifyOk } from '@/lib/notify'
import { useCart } from '@/contexts/CartContext'
import type { CatalogOutletCtx } from '@/pages/public/catalogTypes'
import { useProductCatalogRealtime } from '@/hooks/useStoreCatalogRealtime'

type Variant = {
  id: string
  name: string
  sku_suffix: string
  price_override: number | null
  stock: number | null
  is_active: boolean
  is_default?: boolean
  colors: { name: string; hex: string } | null
  variant_images: { url: string; sort_order: number }[]
}

const VARIANT_PICK_MSG = 'Selecione uma cor ou variação antes de adicionar ao carrinho.'

export function ProductDetailPage() {
  const { store, slug, setBannerImageUrl } = useOutletContext<CatalogOutletCtx>()
  const { productSlug } = useParams<{ productSlug: string }>()
  const nav = useNavigate()
  const { addLine } = useCart()
  const [product, setProduct] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [variantId, setVariantId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)

  const reloadProduct = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!productSlug) return
      if (!opts?.silent) setLoading(true)
      try {
        const p = await fetchCatalogProductBySlug(store.id, productSlug)
        setProduct(p as Record<string, unknown> | null)
        if (!opts?.silent) {
          setVariantId(null)
          setQty(1)
        }
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [store.id, productSlug],
  )

  useEffect(() => {
    void reloadProduct()
  }, [reloadProduct])

  const productId = product?.id != null ? String(product.id) : null
  useProductCatalogRealtime(productId, () => {
    void reloadProduct({ silent: true })
  })

  const variants = (product?.product_variants as Variant[] | undefined) ?? []
  const activeVariants = variants.filter((v) => v.is_active)
  const hasVariants = activeVariants.length > 0

  const selected = activeVariants.find((v) => v.id === variantId) ?? null

  const productStock =
    product?.stock != null && product.stock !== '' ? Number(product.stock) : null

  const stockControlled = productStock != null && !Number.isNaN(productStock)

  const availableQty = useMemo(
    () =>
      catalogAvailableQty({
        productStock: stockControlled ? productStock : null,
        hasVariants,
        variantStock: selected?.stock,
      }),
    [stockControlled, productStock, hasVariants, selected?.stock],
  )

  const variantRequired = hasVariants && variantId == null
  const isOutOfStock =
    stockControlled &&
    !variantRequired &&
    availableQty != null &&
    availableQty < 1
  const addDisabled = variantRequired || isOutOfStock

  const productPricing = useMemo(() => {
    if (!product) return { list: 0, base: 0, promo: null as number | null }
    const base = Number(product.base_price ?? 0)
    const promo = product.promo_price != null ? Number(product.promo_price) : null
    return { list: productListPrice({ base_price: base, promo_price: promo }), base, promo }
  }, [product])

  const unitPrice = useMemo(() => {
    if (!product) return 0
    return variantUnitPrice(
      { base_price: productPricing.base, promo_price: productPricing.promo },
      selected,
    )
  }, [product, productPricing, selected])

  const productBasePrice = productPricing.base
  const productPromoPrice = productPricing.promo
  const usesProductListPrice = selected == null || variantPriceOverrideValue(selected) == null
  const hasProductPromo =
    usesProductListPrice && productPromoPrice != null && productPromoPrice > 0 && productPromoPrice < productBasePrice

  const images = useMemo(() => {
    const fromVariant = selected?.variant_images?.slice().sort((a, b) => a.sort_order - b.sort_order) ?? []
    if (fromVariant.length) return fromVariant.map((i) => i.url)
    const pis =
      (product?.product_images as { url: string; sort_order: number }[] | undefined)?.slice().sort((a, b) => a.sort_order - b.sort_order) ?? []
    return pis.map((i) => i.url)
  }, [product, selected])

  useEffect(() => {
    const next = images[0] || null
    setBannerImageUrl(next)
    return () => {
      setBannerImageUrl(null)
    }
  }, [images, setBannerImageUrl])

  useEffect(() => {
    if (availableQty == null) return
    setQty((q) => Math.min(Math.max(1, q), availableQty))
  }, [availableQty, variantId])

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
    if (variantRequired) {
      notifyInfo(VARIANT_PICK_MSG)
      return
    }
    if (isOutOfStock) {
      notifyInfo('Produto esgotado no momento.')
      return
    }
    if (stockControlled && availableQty != null && qty > availableQty) {
      notifyInfo(`Quantidade máxima disponível: ${availableQty}.`)
      return
    }
    const warrantyTerm = String((product.sofa_spec as { warranty?: string } | null | undefined)?.warranty ?? '').trim()
    const deliveryDays = Number(product.delivery_days)
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
      warranty: warrantyTerm || undefined,
      deliveryDays: Number.isFinite(deliveryDays) && deliveryDays > 0 ? deliveryDays : undefined,
      maxQty: availableQty ?? undefined,
    })
    notifyOk('Produto adicionado ao carrinho.')
    nav(`/loja/${slug}`)
  }

  const qtyMax = availableQty ?? undefined

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28 md:pb-8">
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
          <p className="mt-4 text-3xl font-bold" style={{ color: '#000000' }}>
            {formatCurrency(unitPrice)}
          </p>
          {hasProductPromo ? (
            <p className="text-sm line-through" style={{ color: '#9fa2ad' }}>
              {formatCurrency(productBasePrice)}
            </p>
          ) : null}

          {stockControlled && availableQty != null ? (
            <p className={`mt-2 text-sm font-medium ${availableQty < 1 ? 'text-red-600' : 'text-ink-600'}`}>
              {availableQty < 1 ? 'Esgotado' : `${availableQty} unidade(s) em estoque`}
            </p>
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

          {hasVariants ? (
            <div className="mt-6">
              <p className="text-xs font-medium text-ink-600">Cor / variação *</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeVariants.map((v) => {
                  const active = v.id === variantId
                  const variantOut =
                    stockControlled && v.stock != null && v.stock < 1
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={variantOut}
                      title={
                        variantOut
                          ? 'Variação sem estoque.'
                          : `Selecionar ${v.name} e atualizar o preço exibido.`
                      }
                      onClick={() => {
                        setVariantId(v.id)
                        notifyInfo('Variação selecionada.')
                      }}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        active
                          ? 'border-[var(--cat-accent)] bg-[var(--cat-accent)]/10 text-ink-900'
                          : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300'
                      }`}
                    >
                      {v.colors ? (
                        <span className="h-4 w-4 rounded-full ring-1 ring-ink-200" style={{ background: v.colors.hex }} />
                      ) : null}
                      {v.name}
                      {variantOut ? ' (esgotado)' : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-6 hidden items-center gap-3 md:flex">
            <label className="text-xs font-medium text-ink-600">Qtd</label>
            <IntegerField
              className="w-20"
              min={1}
              max={qtyMax}
              value={String(qty)}
              onValueChange={(d) => {
                const n = Math.max(1, Number(d) || 1)
                setQty(qtyMax != null ? Math.min(n, qtyMax) : n)
              }}
              disabled={isOutOfStock}
            />
          </div>

          {variantRequired ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" role="alert">
              {VARIANT_PICK_MSG}
            </p>
          ) : null}

          {isOutOfStock && !variantRequired ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">
              Produto esgotado no momento.
            </p>
          ) : null}

          <Button
            variant="catalog"
            disabled={addDisabled}
            tooltip="Incluir este produto no carrinho com a variação e quantidade escolhidas."
            className="mt-4 hidden w-full max-w-sm bg-[var(--cat-primary)] py-3 text-base hover:opacity-95 focus-visible:outline-[var(--cat-primary)] disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex"
            onClick={handleAdd}
          >
            Adicionar ao carrinho
          </Button>

          <Card className="mt-8 space-y-2 text-sm text-ink-700">
            <h3 className="font-display text-lg font-semibold text-ink-900">Detalhes</h3>
            <p className="whitespace-pre-wrap">{String(product.description ?? '')}</p>
            <p className="text-xs text-ink-500">Prazo estimado: {String(product.delivery_days)} dias úteis</p>
          </Card>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-200 bg-white/95 p-3 backdrop-blur md:hidden">
        {variantRequired ? (
          <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-900">
            {VARIANT_PICK_MSG}
          </p>
        ) : null}
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="flex items-center rounded-2xl border border-ink-200 bg-white">
            <button
              type="button"
              className="px-3 py-2 text-lg font-semibold text-ink-700 disabled:opacity-40"
              title="Diminuir a quantidade."
              disabled={isOutOfStock || qty <= 1}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Diminuir quantidade"
            >
              -
            </button>
            <span className="min-w-10 text-center text-base font-semibold text-ink-900">{qty}</span>
            <button
              type="button"
              className="px-3 py-2 text-lg font-semibold text-ink-700 disabled:opacity-40"
              title="Aumentar a quantidade."
              disabled={isOutOfStock || (qtyMax != null && qty >= qtyMax)}
              onClick={() => setQty((q) => (qtyMax != null ? Math.min(q + 1, qtyMax) : q + 1))}
              aria-label="Aumentar quantidade"
            >
              +
            </button>
          </div>
          <Button
            variant="catalog"
            disabled={addDisabled}
            tooltip="Incluir este produto no carrinho."
            className="flex-1 bg-[var(--cat-primary)] py-3 text-base hover:opacity-95 focus-visible:outline-[var(--cat-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleAdd}
          >
            Adicionar ao carrinho
          </Button>
        </div>
      </div>
    </div>
  )
}
