import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
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
}

export function ProductsPage() {
  const nav = useNavigate()
  const { store } = useOutletContext<AdminOutletCtx>()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const sb = getSupabaseBrowserClient()
      const { data } = await sb
        .from('products')
        .select('id, name, slug, sku, base_price, promo_price, is_active, is_featured, categories(name)')
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink-900">Produtos</h2>
          <p className="text-sm text-ink-600">CRUD completo com imagens, variações e destaque.</p>
        </div>
        <Button type="button" className="gap-2" onClick={() => nav('/admin/produtos/novo')} doneToast="Abrindo novo produto.">
          <Plus className="h-4 w-4" />
          Novo produto
        </Button>
      </div>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-sm text-ink-500">Carregando…</p>
        ) : (
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
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-ink-50/50">
                  <td className="px-4 py-3 font-medium text-ink-900">
                    {r.name}
                    {r.is_featured ? (
                      <Badge className="ml-2 bg-amber-50 text-amber-900 ring-amber-600/20">Destaque</Badge>
                    ) : null}
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
        )}
      </Card>
    </div>
  )
}
