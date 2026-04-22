import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { MoneyField } from '@/components/ui/MoneyField'
import { IntegerField } from '@/components/ui/IntegerField'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProductImageGallery } from '@/components/catalog/ProductImageGallery'
import { formatCurrency } from '@/lib/format'
import { parseMoneyBRL } from '@/lib/moneyInput'
import { effectivePrice, fetchCatalogCategories, fetchCatalogModelTypes, fetchCatalogProducts } from '@/services/catalogPublicService'
import type { CatalogOutletCtx } from '@/pages/public/catalogTypes'

export function CatalogPageModern() {
  const { store, slug, setBannerImageUrl } = useOutletContext<CatalogOutletCtx>()
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([])
  const [modelTypes, setModelTypes] = useState<{ name: string }[]>([])
  const [products, setProducts] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [model, setModel] = useState('')
  const [colorHex, setColorHex] = useState('')
  const [minP, setMinP] = useState('')
  const [maxP, setMaxP] = useState('')
  const [minL, setMinL] = useState('')
  const [maxL, setMaxL] = useState('')
  const [minW, setMinW] = useState('')
  const [maxW, setMaxW] = useState('')
  const [minH, setMinH] = useState('')
  const [maxH, setMaxH] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftModel, setDraftModel] = useState('')
  const [draftColorHex, setDraftColorHex] = useState('')
  const [draftMinP, setDraftMinP] = useState('')
  const [draftMaxP, setDraftMaxP] = useState('')
  const [draftMinL, setDraftMinL] = useState('')
  const [draftMaxL, setDraftMaxL] = useState('')
  const [draftMinW, setDraftMinW] = useState('')
  const [draftMaxW, setDraftMaxW] = useState('')
  const [draftMinH, setDraftMinH] = useState('')
  const [draftMaxH, setDraftMaxH] = useState('')

  const toPositiveOrUndefined = (value: string) => {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  const toPositiveMoneyOrUndefined = (value: string) => {
    if (!value.trim()) return undefined
    const n = parseMoneyBRL(value)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [cats, mts] = await Promise.all([fetchCatalogCategories(store.id), fetchCatalogModelTypes(store.id)])
        if (!alive) return
        setCategories(cats as never)
        setModelTypes(mts.map((m) => ({ name: m.name })))
      } catch {
        if (alive) {
          setCategories([])
          setModelTypes([])
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [store.id])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const prods = await fetchCatalogProducts(store.id, {
          categoryId: categoryId || undefined,
          search: search || undefined,
          modelType: model || undefined,
          colorHex: colorHex || undefined,
          minPrice: toPositiveMoneyOrUndefined(minP),
          maxPrice: toPositiveMoneyOrUndefined(maxP),
          minLengthCm: toPositiveOrUndefined(minL),
          maxLengthCm: toPositiveOrUndefined(maxL),
          minWidthCm: toPositiveOrUndefined(minW),
          maxWidthCm: toPositiveOrUndefined(maxW),
          minHeightCm: toPositiveOrUndefined(minH),
          maxHeightCm: toPositiveOrUndefined(maxH),
        })
        if (!alive) return
        setProducts(prods)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [store.id, categoryId, search, model, colorHex, minP, maxP, minL, maxL, minW, maxW, minH, maxH])

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      const categoryName = ((p.categories as { name?: string } | null)?.name ?? '').toLowerCase()
      const matchesCategory = !categoryId || String(p.category_id ?? '') === categoryId
      const matchesSearch =
        !q ||
        String(p.name ?? '')
          .toLowerCase()
          .includes(q) ||
        String(p.sku ?? '')
          .toLowerCase()
          .includes(q) ||
        categoryName.includes(q)
      return matchesCategory && matchesSearch
    })
  }, [products, categoryId, search])

  const colorOptions = useMemo(() => {
    const set = new Map<string, string>()
    for (const p of products) {
      const vars = (p.product_variants as { colors?: { hex?: string; name?: string } | null }[]) ?? []
      for (const v of vars) {
        const h = v.colors?.hex
        const n = v.colors?.name
        if (h) set.set(h.toLowerCase(), n ?? h)
      }
    }
    return [...set.entries()]
  }, [products])

  function openFilters() {
    setDraftModel(model)
    setDraftColorHex(colorHex)
    setDraftMinP(minP)
    setDraftMaxP(maxP)
    setDraftMinL(minL)
    setDraftMaxL(maxL)
    setDraftMinW(minW)
    setDraftMaxW(maxW)
    setDraftMinH(minH)
    setDraftMaxH(maxH)
    setFiltersOpen(true)
  }

  useEffect(() => {
    setBannerImageUrl(null)
  }, [setBannerImageUrl])

  return (
    <div className="pb-24 pt-3 md:pt-5">
      <div className="mx-auto max-w-6xl px-4">
      <section className="rounded-[28px] bg-white/95 p-4 shadow-sm ring-1 ring-ink-200">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cat-primary)]/60" />
          <Input
            className="rounded-full border-0 bg-ink-100 pl-10"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategoryId('')}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
              !categoryId ? 'bg-[var(--cat-primary)] text-white' : 'bg-ink-100 text-ink-700'
            }`}
          >
            Todos
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
                categoryId === c.id ? 'bg-[var(--cat-primary)] text-white' : 'bg-ink-100 text-ink-700'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-ink-500">Carregando produtos…</p>
        ) : visibleProducts.length === 0 ? (
          <p className="mt-8 text-sm text-ink-500">Nenhum produto encontrado.</p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((p) => {
              const imgs =
                (p.product_images as { url: string; sort_order?: number }[] | undefined)
                  ?.slice()
                  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                  .map((i) => i.url) ?? []
              const basePrice = Number(p.base_price ?? 0)
              const promoPrice = p.promo_price != null ? Number(p.promo_price) : null
              const hasPromo = promoPrice != null && promoPrice > 0 && promoPrice < basePrice
              const price = hasPromo ? promoPrice : effectivePrice(p as never)
              const slugProduct = String(p.slug)

              return (
                <Card key={String(p.id)} className="overflow-hidden rounded-3xl p-0">
                  <div className="relative bg-ink-50">
                    <ProductImageGallery
                      urls={imgs}
                      alt={String(p.name)}
                      className="aspect-square rounded-none ring-0"
                      enableLightbox={false}
                      compactArrows
                    />
                    {hasPromo ? (
                      <Badge className="absolute right-2 top-2 bg-[var(--cat-accent)] text-white">
                        -{Math.round(((basePrice - price) / basePrice) * 100)}%
                      </Badge>
                    ) : null}
                  </div>
                  <Link to={`/loja/${slug}/produto/${slugProduct}`} className="block p-3">
                    <p className="truncate text-sm font-medium text-ink-700">{String(p.name)}</p>
                    <div className="mt-1">
                      <p className="text-xl font-bold" style={{ color: '#000000' }}>
                        {formatCurrency(price)}
                      </p>
                      {hasPromo ? (
                        <p className="mt-0.5 text-xs line-through" style={{ color: '#9fa2ad' }}>
                          {formatCurrency(basePrice)}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </Card>
              )
            })}
          </div>
        )}
      </section>
      </div>

      {!filtersOpen ? (
        <button
          type="button"
          className="fixed bottom-5 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--cat-primary)] text-white shadow-xl ring-1 ring-black/10 transition hover:opacity-95 md:bottom-7 md:right-7"
          aria-label="Abrir filtros"
          onClick={openFilters}
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      ) : null}

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 bg-ink-900/35" onClick={() => setFiltersOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl md:bottom-4 md:right-4 md:left-auto md:top-4 md:max-h-none md:w-[420px] md:rounded-3xl md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-ink-200 md:hidden" />
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-xl font-semibold text-[var(--cat-primary)]">Filtros</h3>
              <button
                type="button"
                className="rounded-full bg-ink-100 p-2 text-ink-700 hover:bg-ink-200"
                onClick={() => setFiltersOpen(false)}
                aria-label="Fechar filtros"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-ink-600">Tipo / modelo</label>
                <Select
                  className="mt-1"
                  value={draftModel}
                  onChange={(e) => {
                    const value = e.target.value
                    setDraftModel(value)
                    setModel(value)
                  }}
                >
                  <option value="">Todos</option>
                  {modelTypes.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600">Cor</label>
                <Select
                  className="mt-1"
                  value={draftColorHex}
                  onChange={(e) => {
                    const value = e.target.value
                    setDraftColorHex(value)
                    setColorHex(value)
                  }}
                >
                  <option value="">Todas</option>
                  {colorOptions.map(([hex, label]) => (
                    <option key={hex} value={hex}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-ink-600">Preço mín.</label>
                  <MoneyField
                    className="mt-1"
                    value={draftMinP}
                    onValueChange={(value) => {
                      setDraftMinP(value)
                      setMinP(value)
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-600">Preço máx.</label>
                  <MoneyField
                    className="mt-1"
                    value={draftMaxP}
                    onValueChange={(value) => {
                      setDraftMaxP(value)
                      setMaxP(value)
                    }}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-600">Dimensões (cm)</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-ink-500">Comp. mín</label>
                    <IntegerField
                      className="mt-1 !py-2"
                      value={draftMinL}
                      onValueChange={(value) => {
                        setDraftMinL(value)
                        setMinL(value)
                      }}
                      min={0}
                      placeholder="cm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-ink-500">Comp. máx</label>
                    <IntegerField
                      className="mt-1 !py-2"
                      value={draftMaxL}
                      onValueChange={(value) => {
                        setDraftMaxL(value)
                        setMaxL(value)
                      }}
                      min={0}
                      placeholder="cm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-ink-500">Larg. mín</label>
                    <IntegerField
                      className="mt-1 !py-2"
                      value={draftMinW}
                      onValueChange={(value) => {
                        setDraftMinW(value)
                        setMinW(value)
                      }}
                      min={0}
                      placeholder="cm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-ink-500">Larg. máx</label>
                    <IntegerField
                      className="mt-1 !py-2"
                      value={draftMaxW}
                      onValueChange={(value) => {
                        setDraftMaxW(value)
                        setMaxW(value)
                      }}
                      min={0}
                      placeholder="cm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-ink-500">Alt. mín</label>
                    <IntegerField
                      className="mt-1 !py-2"
                      value={draftMinH}
                      onValueChange={(value) => {
                        setDraftMinH(value)
                        setMinH(value)
                      }}
                      min={0}
                      placeholder="cm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-ink-500">Alt. máx</label>
                    <IntegerField
                      className="mt-1 !py-2"
                      value={draftMaxH}
                      onValueChange={(value) => {
                        setDraftMaxH(value)
                        setMaxH(value)
                      }}
                      min={0}
                      placeholder="cm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700"
                onClick={() => {
                  setDraftModel('')
                  setDraftColorHex('')
                  setDraftMinP('')
                  setDraftMaxP('')
                  setDraftMinL('')
                  setDraftMaxL('')
                  setDraftMinW('')
                  setDraftMaxW('')
                  setDraftMinH('')
                  setDraftMaxH('')
                  setModel('')
                  setColorHex('')
                  setMinP('')
                  setMaxP('')
                  setMinL('')
                  setMaxL('')
                  setMinW('')
                  setMaxW('')
                  setMinH('')
                  setMaxH('')
                }}
              >
                Limpar
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--cat-accent)] px-4 py-2.5 text-sm font-semibold text-white"
                onClick={() => {
                  setFiltersOpen(false)
                }}
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
