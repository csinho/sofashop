import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pie, PieChart, Cell, Legend } from 'recharts'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { ORDER_STATUS_LABEL } from '@/constants/orderStatus'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import type { AdminOutletCtx } from '@/pages/admin/adminOutlet'
import type { OrderStatus } from '@/types/database'

type OrderRow = {
  id: string
  created_at: string
  status: OrderStatus
  total: number
  order_number: string
  payment_kind: string
}

const COLORS = ['#ea580c', '#0f172a', '#64748b', '#22c55e', '#a855f7', '#0ea5e9', '#eab308']

export function DashboardPage() {
  const { store } = useOutletContext<AdminOutletCtx>()
  const [products, setProducts] = useState(0)
  const [customers, setCustomers] = useState(0)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const sb = getSupabaseBrowserClient()
      const [p, c, o] = await Promise.all([
        sb.from('products').select('id', { count: 'exact', head: true }).eq('store_id', store.id),
        sb.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', store.id),
        sb.from('orders').select('id, created_at, status, total, order_number, payment_kind').eq('store_id', store.id),
      ])
      if (!alive) return
      setProducts(p.count ?? 0)
      setCustomers(c.count ?? 0)
      setOrders((o.data as OrderRow[]) ?? [])
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [store.id])

  const stats = useMemo(() => {
    const paidStatuses: OrderStatus[] = ['aprovado', 'em_producao', 'pronto_entrega', 'entregue']
    const totalRevenue = orders.filter((o) => paidStatuses.includes(o.status)).reduce((s, o) => s + Number(o.total), 0)
    const ticket = orders.length ? totalRevenue / orders.length : 0
    const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1
      return acc
    }, {})
    const statusData = Object.entries(byStatus).map(([name, value]) => ({
      name: ORDER_STATUS_LABEL[name as OrderStatus] ?? name,
      value,
    }))
    return { totalRevenue, ticket, byStatus, statusData }
  }, [orders])

  const recent = useMemo(() => [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6), [orders])

  const revenueByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of orders) {
      const d = o.created_at.slice(0, 10)
      map.set(d, (map.get(d) ?? 0) + Number(o.total))
    }
    return [...map.entries()]
      .map(([day, total]) => ({ day, total }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-14)
  }, [orders])

  const payMix = useMemo(() => {
    const m: Record<string, number> = {}
    for (const o of orders) {
      m[o.payment_kind] = (m[o.payment_kind] ?? 0) + 1
    }
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  }, [orders])

  if (loading) return <p className="text-sm text-ink-500">Carregando indicadores…</p>

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink-900">Dashboard</h2>
        <p className="text-sm text-ink-600">Visão geral da sua loja — dados isolados por tenant.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Produtos</p>
          <p className="mt-2 text-3xl font-bold text-ink-900">{products}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Clientes</p>
          <p className="mt-2 text-3xl font-bold text-ink-900">{customers}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Pedidos</p>
          <p className="mt-2 text-3xl font-bold text-ink-900">{orders.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Faturamento (status pagos pipeline)</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(stats.totalRevenue)}</p>
          <p className="mt-1 text-xs text-ink-500">Ticket médio {formatCurrency(stats.ticket)}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-80">
          <h3 className="font-display text-lg font-semibold text-ink-900">Pedidos por status</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {stats.statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="h-80">
          <h3 className="font-display text-lg font-semibold text-ink-900">Faturamento por dia</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="total" fill="#ea580c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="font-display text-lg font-semibold text-ink-900">Pedidos recentes</h3>
          <ul className="mt-4 divide-y divide-ink-100 text-sm">
            {recent.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-3">
                <div>
                  <Link className="font-medium text-brand-700 hover:underline" to={`/admin/pedidos/${o.id}`}>
                    {o.order_number}
                  </Link>
                  <p className="text-xs text-ink-500">{formatDateTime(o.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ink-900">{formatCurrency(Number(o.total))}</p>
                  <p className="text-xs text-ink-500">{ORDER_STATUS_LABEL[o.status]}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="font-display text-lg font-semibold text-ink-900">Formas de pagamento</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payMix} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0f172a" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
