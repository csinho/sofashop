import { useEffect, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/format'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import type { AdminOutletCtx } from '@/pages/admin/adminOutlet'

type Row = {
  id: string
  full_name: string
  phone: string
  orders: { id: string; total: number }[] | null
}

export function CustomersPage() {
  const { store } = useOutletContext<AdminOutletCtx>()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const sb = getSupabaseBrowserClient()
      const { data } = await sb
        .from('customers')
        .select('id, full_name, phone, orders(id, total)')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
      if (!alive) return
      let list = (data as Row[]) ?? []
      if (q.trim()) {
        const t = q.trim().toLowerCase()
        list = list.filter((r) => r.full_name.toLowerCase().includes(t) || r.phone.toLowerCase().includes(t))
      }
      setRows(list)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [store.id, q])

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold text-ink-900">Clientes</h2>
      <Card className="flex flex-col gap-2">
        <label className="block text-xs font-medium text-ink-600">Buscar por nome ou telefone</label>
        <Input
          className="max-w-md"
          value={q}
          onChange={(e) => {
            const v = e.target.value
            const next = new URLSearchParams(params)
            v ? next.set('q', v) : next.delete('q')
            setParams(next)
          }}
          placeholder="Digite para filtrar…"
        />
      </Card>
      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-sm text-ink-500">Carregando…</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/80 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Pedidos</th>
                <th className="px-4 py-3">Total gasto</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((r) => {
                const ords = r.orders ?? []
                const spent = ords.reduce((s, o) => s + Number(o.total), 0)
                const recurring = ords.length > 1
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-ink-900">
                      {r.full_name}
                      {recurring ? (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                          Recorrente
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-ink-600">{r.phone}</td>
                    <td className="px-4 py-3">{ords.length}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(spent)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link className="font-medium text-brand-700 hover:underline" to={`/admin/clientes/${r.id}`}>
                        Ver
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
