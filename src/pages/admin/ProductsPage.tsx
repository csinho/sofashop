import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { ListPaginationBar } from '@/components/ui/ListPaginationBar'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useListPagination } from '@/hooks/useListPagination'
import { formatCurrency } from '@/lib/format'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import type { AdminOutletCtx } from '@/pages/admin/adminOutlet'

type Row = {
  id: string
  name: string
  slug: string
  sku: string
  base_price: number
  promo_price: number | null
  is_active: boolean
  is_featured: boolean
  categories: { name: string } | { name: string }[] | null
  product_images: { url: string; sort_order: number }[] | null
}

export function ProductsPage() {
  const nav = useNavigate()
  const { store } = useOutletContext<AdminOutletCtx>()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [featured, setFeatured] = useState<'all' | 'yes' | 'no'>('all')
  const [category, setCategory] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const sb = getSupabaseBrowserClient()
      const { data } = await sb
        .from('products')
        .select('id, name, slug, sku, base_price, promo_price, is_active, is_featured, categories(name), product_images(url, sort_order)')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
      if (!alive) return
      setRows((data as unknown as Row[]) ?? [])
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [store.id])

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) {
      const name = (Array.isArray(r.categories) ? r.categories[0] : r.categories)?.name
      if (name) map.set(name, name)
    }
    return [...map.values()].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const categoryName = (Array.isArray(r.categories) ? r.categories[0] : r.categories)?.name ?? ''
      const matchesSearch = !q || r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) || categoryName.toLowerCase().includes(q)
      const matchesStatus = status === 'all' || (status === 'active' ? r.is_active : !r.is_active)
      const matchesFeatured = featured === 'all' || (featured === 'yes' ? r.is_featured : !r.is_featured)
      const matchesCategory = !category || categoryName === category
      return matchesSearch && matchesStatus && matchesFeatured && matchesCategory
    })
  }, [rows, search, status, featured, category])

  const listForPagination = !loading ? filteredRows : []
  const { pageItems, page, setPage, pageCount, showPagination, total: listTotal } = useListPagination(
    listForPagination,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink-900">Produtos</h2>
          <p className="text-sm text-ink-600">Cadastre, edite e organize seus produtos com fotos, variações e destaque.</p>
        </div>
        <Button
          type="button"
          className="w-full gap-2 sm:w-auto"
          onClick={() => nav('/admin/produtos/novo')}
          doneToast="Abrindo novo produto."
        >
          <Plus className="h-4 w-4" />
          Novo produto
        </Button>
      </div>

      <Card className="space-y-3 p-3 md:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, SKU ou categoria"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Select value={status} onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'inactive')}>
            <option value="all">Todos status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </Select>
          <Select value={featured} onChange={(e) => setFeatured(e.target.value as 'all' | 'yes' | 'no')}>
            <option value="all">Todos</option>
            <option value="yes">Destaque</option>
            <option value="no">Sem destaque</option>
          </Select>
          <Select className="col-span-2 md:col-span-2" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Todas categorias</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <Card>
          <p className="text-sm text-ink-500">Carregando…</p>
        </Card>
      ) : filteredRows.length === 0 ? (
        <Card className="space-y-3">
          <p className="text-sm text-ink-600">
            {rows.length === 0 ? 'Você ainda não tem produtos cadastrados.' : 'Nenhum produto encontrado com os filtros atuais.'}
          </p>
          {rows.length === 0 ? (
            <Button type="button" className="w-full sm:w-auto" onClick={() => nav('/admin/produtos/novo')}>
              <Plus className="h-4 w-4" />
              Criar primeiro produto
            </Button>
          ) : null}
        </Card>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {pageItems.map((r) => {
              const category = (Array.isArray(r.categories) ? r.categories[0] : r.categories)?.name ?? 'Sem categoria'
              const img = r.product_images?.slice().sort((a, b) => a.sort_order - b.sort_order)?.[0]?.url
              return (
                <Card key={r.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-ink-900">{r.name}</p>
                      <p className="mt-0.5 text-xs text-ink-500">SKU: {r.sku || '—'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {r.is_active ? <Badge>Ativo</Badge> : <Badge className="bg-ink-100 text-ink-500">Inativo</Badge>}
                      {r.is_featured ? <Badge className="bg-amber-50 text-amber-900 ring-amber-600/20">Destaque</Badge> : null}
                    </div>
                  </div>

                  <div className="flex items-end gap-3 rounded-xl bg-ink-50 px-3 py-2">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-100 ring-1 ring-ink-200">
                      {img ? (
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-ink-400">Sem img</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-wide text-ink-500">{category}</p>
                      <p className="text-sm font-semibold text-ink-900">{formatCurrency(r.promo_price ?? r.base_price)}</p>
                      {r.promo_price != null ? (
                        <p className="text-xs text-ink-400 line-through">{formatCurrency(r.base_price)}</p>
                      ) : null}
                    </div>
                    <Link
                      className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-brand-700"
                      to={`/admin/produtos/${r.id}`}
                    >
                      Editar
                    </Link>
                  </div>
                </Card>
              )
            })}
          </div>

          <Card className="hidden overflow-x-auto p-0 md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/80 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Preço</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {pageItems.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-medium text-ink-900">
                      {r.name}
                      {r.is_featured ? <Badge className="ml-2 bg-amber-50 text-amber-900 ring-amber-600/20">Destaque</Badge> : null}
                    </td>
                    <td className="px-4 py-3 text-ink-600">{r.sku}</td>
                    <td className="px-4 py-3 text-ink-600">
                      {(Array.isArray(r.categories) ? r.categories[0] : r.categories)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-ink-900">{formatCurrency(r.promo_price ?? r.base_price)}</span>
                      {r.promo_price != null ? (
                        <span className="ml-2 text-xs text-ink-400 line-through">{formatCurrency(r.base_price)}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{r.is_active ? <Badge>Ativo</Badge> : <span className="text-xs text-ink-400">Inativo</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <Link className="font-medium text-brand-700 hover:underline" to={`/admin/produtos/${r.id}`}>
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ListPaginationBar
            show={showPagination}
            page={page}
            pageCount={pageCount}
            total={listTotal}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
            itemSingular="produto"
            itemPlural="produtos"
            ariaLabel="Paginação da lista de produtos"
          />
        </>
      )}
    </div>
  )
}
