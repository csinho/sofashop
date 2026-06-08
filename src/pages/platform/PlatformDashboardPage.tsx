import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/format'
import { getPwaBrandName } from '@/lib/documentTitle'
import { listPlatformStores, type PlatformStoreSummary } from '@/services/platformService'

const COLORS = ['#22c55e', '#94a3b8', '#ea580c']

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

export function PlatformDashboardPage() {
  const [rows, setRows] = useState<PlatformStoreSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7))
  const [storeFilter, setStoreFilter] = useState('')

  useEffect(() => {
    document.title = `${getPwaBrandName()} — Dashboard da plataforma`
  }, [])

  useEffect(() => {
    let alive = true
    void listPlatformStores()
      .then((data) => {
        if (alive) setRows(data)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => {
    let list = rows
    if (storeFilter) {
      list = list.filter((r) => r.id === storeFilter)
    } else if (monthFilter) {
      list = list.filter((r) => monthKey(r.created_at) === monthFilter)
    }
    return list
  }, [rows, monthFilter, storeFilter])

  const stats = useMemo(() => {
    const all = rows
    const active = all.filter((r) => r.is_active).length
    const inactive = all.length - active
    const newThisMonth = all.filter((r) => monthKey(r.created_at) === monthFilter).length
    const ordersTotal = filtered.reduce((s, r) => s + r.orders_total, 0)
    const orderCount = filtered.reduce((s, r) => s + r.order_count, 0)
    return { total: all.length, active, inactive, newThisMonth, ordersTotal, orderCount }
  }, [rows, filtered, monthFilter])

  const storesByMonth = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const k = monthKey(r.created_at)
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month: monthLabel(month), count, key: month }))
  }, [rows])

  const statusPie = useMemo(
    () => [
      { name: 'Ativas', value: stats.active },
      { name: 'Inativas', value: stats.inactive },
    ],
    [stats.active, stats.inactive],
  )

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-ink-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-200" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">Visão geral das lojas cadastradas na plataforma.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-xs font-medium text-ink-600">Mês (cadastro)</label>
            <input
              type="month"
              className="mt-1 block rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm"
              value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value)
                setStoreFilter('')
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Loja</label>
            <select
              className="mt-1 block max-w-[220px] rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
            >
              <option value="">Todas (filtro por mês)</option>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.trade_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Lojas cadastradas</p>
          <p className="mt-2 font-display text-3xl font-semibold text-ink-900">{stats.total}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Ativas / inativas</p>
          <p className="mt-2 font-display text-3xl font-semibold text-ink-900">
            {stats.active} <span className="text-lg text-ink-400">/</span> {stats.inactive}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Novas no mês</p>
          <p className="mt-2 font-display text-3xl font-semibold text-ink-900">{stats.newThisMonth}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            {storeFilter ? 'Pedidos da loja' : 'Volume pedidos (filtro)'}
          </p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink-900">{formatCurrency(stats.ordersTotal)}</p>
          <p className="text-xs text-ink-500">{stats.orderCount} pedidos</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-900">Cadastros por mês</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={storesByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#ea580c" radius={[6, 6, 0, 0]} name="Lojas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-900">Status das lojas</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {statusPie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {['Pagamentos recebidos', 'Pagamentos pendentes', 'Lojas em dia / atraso'].map((title) => (
          <Card key={title} className="border-dashed border-ink-200 bg-ink-50/80">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</p>
            <p className="mt-3 text-sm text-ink-600">Disponível após implementação dos planos de assinatura (PIX).</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
