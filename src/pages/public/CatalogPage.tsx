import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { MoneyField } from '@/components/ui/MoneyField'
import { IntegerField } from '@/components/ui/IntegerField'
import { formatCurrency } from '@/lib/format'
import { parseMoneyBRL } from '@/lib/moneyInput'
import {
  effectivePrice,
  fetchCatalogCategories,
  fetchCatalogModelTypes,
  fetchCatalogProducts,
} from '@/services/catalogPublicService'
import type { CatalogOutletCtx } from '@/pages/public/catalogTypes'

export function CatalogPage() {
  const { store, slug } = useOutletContext<CatalogOutletCtx>()
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

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [cats, mts] = await Promise.all([
          fetchCatalogCategories(store.id),
          fetchCatalogModelTypes(store.id),
        ])
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
          modelType: model || undefined,
          colorHex: colorHex || undefined,
          minPrice: minP.trim() ? parseMoneyBRL(minP) : undefined,
          maxPrice: maxP.trim() ? parseMoneyBRL(maxP) : undefined,
          search: search || undefined,
          minLengthCm: minL.trim() ? Number(minL) : undefined,
          maxLengthCm: maxL.trim() ? Number(maxL) : undefined,
          minWidthCm: minW.trim() ? Number(minW) : undefined,
          maxWidthCm: maxW.trim() ? Number(maxW) : undefined,
          minHeightCm: minH.trim() ? Number(minH) : undefined,
          maxHeightCm: maxH.trim() ? Number(maxH) : undefined,
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
  }, [
    store.id,
    categoryId,
    model,
    colorHex,
    minP,
    maxP,
    minL,
    maxL,
    minW,
    maxW,
    minH,
    maxH,
    search,
  ])

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {store.banner_url ? (
        <div className="mb-8 overflow-hidden rounded-3xl shadow-lg ring-1 ring-ink-200/60">
          <img src={store.banner_url} alt="" className="h-48 w-full object-cover md:h-64" />
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[var(--cat-primary)] md:text-4xl">{store.trade_name}</h1>
          {store.institutional_text ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600">{store.institutional_text}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink-600">
            <span>📞 {store.phone_main}</span>
            <span>💬 {store.whatsapp_1}</span>
          </div>

          <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cat-primary)] opacity-80" />
              <Input className="pl-10" placeholder="Buscar por nome, SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <p className="mt-10 text-sm text-ink-500">Carregando produtos…</p>
          ) : products.length === 0 ? (
            <p className="mt-10 text-sm text-ink-500">Nenhum produto encontrado com os filtros atuais.</p>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => {
                const imgs = (p.product_images as { url: string }[] | undefined)?.sort(
                  (a, b) => (a as { sort_order?: number }).sort_order! - (b as { sort_order?: number }).sort_order!,
                )
                const img = imgs?.[0]?.url
                const price = effectivePrice(p as never)
                const slugProduct = String(p.slug)
                const feat = Boolean(p.is_featured)
                return (
                  <Link key={String(p.id)} to={`/loja/${slug}/produto/${slugProduct}`}>
                    <Card className="group h-full overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-lg">
                      <div className="relative aspect-[4/3] overflow-hidden bg-ink-100">
                        {img ? (
                          <img src={img} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-ink-400">Sem imagem</div>
                        )}
                        {feat ? (
                          <Badge className="absolute left-3 top-3 bg-amber-100 text-amber-900 ring-amber-600/20">
                            Destaque
                          </Badge>
                        ) : null}
                      </div>
                      <div className="p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                          {(p.categories as { name?: string } | null)?.name}
                        </p>
                        <h2 className="mt-1 font-display text-lg font-semibold text-[var(--cat-primary)]">{String(p.name)}</h2>
                        <p className="mt-1 line-clamp-2 text-xs text-ink-600">{String(p.short_description ?? '')}</p>
                        <p className="mt-3 text-lg font-bold text-[var(--cat-accent)]">{formatCurrency(price)}</p>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-4">
            <h3 className="font-display text-lg font-semibold text-[var(--cat-primary)]">Filtros</h3>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-600">Categoria</label>
              <Select className="mt-0" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-600">Tipo / modelo</label>
              <Select className="mt-0" value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">Todos</option>
                {modelTypes.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-600">Cor</label>
              <Select className="mt-0" value={colorHex} onChange={(e) => setColorHex(e.target.value)}>
                <option value="">Todas</option>
                {colorOptions.map(([hex, label]) => (
                  <option key={hex} value={hex}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ink-600">Preço mín.</label>
                <MoneyField className="mt-0" value={minP} onValueChange={(m) => setMinP(m)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ink-600">Preço máx.</label>
                <MoneyField className="mt-0" value={maxP} onValueChange={(m) => setMaxP(m)} />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-600">Dimensões (cm)</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-ink-500">Comp. mín</label>
                  <IntegerField className="!py-2" value={minL} onValueChange={setMinL} placeholder="cm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-ink-500">Comp. máx</label>
                  <IntegerField className="!py-2" value={maxL} onValueChange={setMaxL} placeholder="cm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-ink-500">Larg. mín</label>
                  <IntegerField className="!py-2" value={minW} onValueChange={setMinW} placeholder="cm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-ink-500">Larg. máx</label>
                  <IntegerField className="!py-2" value={maxW} onValueChange={setMaxW} placeholder="cm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-ink-500">Alt. mín</label>
                  <IntegerField className="!py-2" value={minH} onValueChange={setMinH} placeholder="cm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-ink-500">Alt. máx</label>
                  <IntegerField className="!py-2" value={maxH} onValueChange={setMaxH} placeholder="cm" />
                </div>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      {store.policy_text ? (
        <Card className="mt-12 border border-[color-mix(in_srgb,var(--cat-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--cat-primary)_12%,white)]">
          <h3 className="font-display text-lg font-semibold text-ink-900">Comunicado</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{store.policy_text}</p>
        </Card>
      ) : null}
    </div>
  )
}
