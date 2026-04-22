import { useEffect, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL } from '@/constants/orderStatus'
import { PAYMENT_LABEL } from '@/constants/payments'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { notifyErr, notifyOk } from '@/lib/notify'
import type { AdminOutletCtx } from '@/pages/admin/adminOutlet'
import type { OrderStatus, PaymentKind } from '@/types/database'
import { cn } from '@/lib/cn'

type Row = {
  id: string
  order_number: string
  created_at: string
  status: OrderStatus
  total: number
  payment_kind: PaymentKind
  customers:
    | { full_name: string; phone: string; phone_secondary?: string | null }
    | { full_name: string; phone: string; phone_secondary?: string | null }[]
    | null
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  novo: 'border-sky-200 bg-sky-50/90 text-sky-950',
  em_analise: 'border-violet-200 bg-violet-50/90 text-violet-950',
  aprovado: 'border-emerald-200 bg-emerald-50/90 text-emerald-950',
  em_producao: 'border-amber-200 bg-amber-50/90 text-amber-950',
  pronto_entrega: 'border-cyan-200 bg-cyan-50/90 text-cyan-950',
  entregue: 'border-slate-200 bg-slate-100/90 text-slate-900',
  cancelado: 'border-red-200 bg-red-50/90 text-red-950',
}

const KANBAN_STATUSES: OrderStatus[] = ORDER_STATUS_FLOW

export function OrdersPage() {
  const { store } = useOutletContext<AdminOutletCtx>()
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [isMobile, setIsMobile] = useState(false)

  const status = params.get('status') ?? ''
  const pay = params.get('pay') ?? ''
  const q = params.get('q') ?? ''

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const onChange = () => setIsMobile(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (isMobile && view === 'kanban') setView('list')
  }, [isMobile, view])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const sb = getSupabaseBrowserClient()
      let query = sb
        .from('orders')
        .select('id, order_number, created_at, status, total, payment_kind, customers(full_name, phone, phone_secondary)')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })

      if (view === 'list') {
        if (status) query = query.eq('status', status as OrderStatus)
        if (pay) query = query.eq('payment_kind', pay as PaymentKind)
      } else {
        if (pay) query = query.eq('payment_kind', pay as PaymentKind)
      }

      const { data, error } = await query
      if (!alive) return
      if (error) {
        notifyErr(error.message)
        setLoading(false)
        return
      }
      let list = (data as unknown as Row[]) ?? []
      if (view === 'kanban' && status) {
        list = list.filter((r) => r.status === (status as OrderStatus))
      }
      if (q.trim()) {
        const t = q.trim().toLowerCase()
        list = list.filter((r) => {
          const c = Array.isArray(r.customers) ? r.customers[0] : r.customers
          const sec = (c?.phone_secondary ?? '').toLowerCase()
          return (
            r.order_number.toLowerCase().includes(t) ||
            (c?.full_name?.toLowerCase().includes(t) ?? false) ||
            (c?.phone?.includes(t) ?? false) ||
            sec.includes(t)
          )
        })
      }
      setRows(list)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [store.id, status, pay, q, view])

  async function moveOrder(orderId: string, newStatus: OrderStatus) {
    const sb = getSupabaseBrowserClient()
    const { error } = await sb.from('orders').update({ status: newStatus }).eq('id', orderId).eq('store_id', store.id)
    if (error) {
      notifyErr(error.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === orderId ? { ...r, status: newStatus } : r)))
    notifyOk(`Pedido movido para “${ORDER_STATUS_LABEL[newStatus]}”.`)
  }

  return (
    <div
      className={cn(
        view === 'kanban' ? 'flex min-h-0 flex-1 flex-col gap-4' : 'space-y-6',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold text-ink-900">Pedidos</h2>
        <div className="flex rounded-xl border border-ink-200 bg-white p-1">
          <Button
            type="button"
            variant="ghost"
            className={cn(
              'rounded-lg px-3 py-1.5',
              view === 'list' ? 'bg-brand-600 text-white shadow-sm hover:bg-brand-700' : 'text-ink-600 hover:bg-ink-50',
            )}
            onClick={() => setView('list')}
            doneToast="Visualização em lista ativa."
          >
            <List className="h-4 w-4" />
            Lista
          </Button>
          {!isMobile ? (
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'rounded-lg px-3 py-1.5',
                view === 'kanban' ? 'bg-brand-600 text-white shadow-sm hover:bg-brand-700' : 'text-ink-600 hover:bg-ink-50',
              )}
              onClick={() => setView('kanban')}
              doneToast="Visualização em quadro ativada."
            >
              <LayoutGrid className="h-4 w-4" />
              Quadro
            </Button>
          ) : null}
        </div>
      </div>

      <Card className={cn('grid shrink-0 gap-3 md:grid-cols-4')}>
        <div>
          <label className="text-xs font-medium text-ink-600">Status</label>
          <Select
            className="mt-1"
            value={status}
            onChange={(e) => {
              const v = e.target.value
              const next = new URLSearchParams(params)
              v ? next.set('status', v) : next.delete('status')
              setParams(next)
            }}
          >
            <option value="">Todos</option>
            {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-ink-600">Pagamento</label>
          <Select
            className="mt-1"
            value={pay}
            onChange={(e) => {
              const v = e.target.value
              const next = new URLSearchParams(params)
              v ? next.set('pay', v) : next.delete('pay')
              setParams(next)
            }}
          >
            <option value="">Todos</option>
            {Object.entries(PAYMENT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-ink-600">Cliente / número / pedido</label>
          <Input
            className="mt-1"
            value={q}
            onChange={(e) => {
              const v = e.target.value
              const next = new URLSearchParams(params)
              v ? next.set('q', v) : next.delete('q')
              setParams(next)
            }}
            placeholder="Buscar…"
          />
        </div>
      </Card>

      {view === 'kanban' && !isMobile ? (
        loading ? (
          <p className="shrink-0 text-sm text-ink-500">Carregando…</p>
        ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-ink-200/80 bg-ink-50/40">
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex h-full min-h-0 gap-3 p-2">
            {KANBAN_STATUSES.map((st) => {
              const col = rows.filter((r) => r.status === st)
              return (
                <div
                  key={st}
                  className={cn(
                    'flex h-full min-h-0 w-64 shrink-0 flex-col rounded-2xl border-2 border-dashed bg-ink-50/50 p-2',
                    STATUS_STYLE[st],
                  )}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = e.dataTransfer.getData('text/orderId')
                    if (id) void moveOrder(id, st)
                  }}
                >
                  <p className="shrink-0 px-1 pb-2 text-xs font-bold uppercase tracking-wide">
                    {ORDER_STATUS_LABEL[st]} ({col.length})
                  </p>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                    {col.map((r) => {
                      const c = Array.isArray(r.customers) ? r.customers[0] : r.customers
                      return (
                        <div
                          key={r.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/orderId', r.id)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          className="cursor-grab rounded-xl border border-ink-200 bg-white p-3 text-xs shadow-sm active:cursor-grabbing"
                        >
                          <p className="font-semibold text-ink-900">{r.order_number}</p>
                          <p className="text-ink-600">{c?.full_name}</p>
                          <p className="mt-1 font-bold text-ink-900">{formatCurrency(Number(r.total))}</p>
                          <p className="text-[10px] text-ink-400">{formatDateTime(r.created_at)}</p>
                          <Link className="mt-2 inline-block text-[11px] font-semibold text-brand-700 hover:underline" to={`/admin/pedidos/${r.id}`}>
                            Abrir
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            </div>
          </div>
        </div>
        )
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {loading ? (
              <Card>
                <p className="text-sm text-ink-500">Carregando…</p>
              </Card>
            ) : rows.length === 0 ? (
              <Card>
                <p className="text-sm text-ink-500">Nenhum pedido encontrado.</p>
              </Card>
            ) : (
              rows.map((r) => {
                const c = Array.isArray(r.customers) ? r.customers[0] : r.customers
                return (
                  <Link key={r.id} to={`/admin/pedidos/${r.id}`} className="block">
                    <Card className="space-y-3 p-4 transition hover:border-brand-200 hover:shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink-900">{r.order_number}</p>
                          <p className="text-xs text-ink-500">{formatDateTime(r.created_at)}</p>
                        </div>
                        <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium', STATUS_STYLE[r.status])}>
                          {ORDER_STATUS_LABEL[r.status]}
                        </span>
                      </div>
                      <div className="space-y-0.5 text-sm text-ink-700">
                        <p className="font-medium text-ink-900">{c?.full_name || 'Sem cliente'}</p>
                        <p>{c?.phone || '—'}</p>
                        {c?.phone_secondary?.trim() ? <p className="text-xs text-ink-500">{c.phone_secondary}</p> : null}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-ink-500">{PAYMENT_LABEL[r.payment_kind]}</p>
                          <p className="text-lg font-bold text-ink-900">{formatCurrency(Number(r.total))}</p>
                        </div>
                        <span className="text-sm font-semibold text-brand-700">Abrir</span>
                      </div>
                    </Card>
                  </Link>
                )
              })
            )}
          </div>

          <Card className="hidden overflow-x-auto p-0 md:block">
          {loading ? (
            <p className="p-6 text-sm text-ink-500">Carregando…</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/80 text-xs uppercase text-ink-500">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => {
                  const c = Array.isArray(r.customers) ? r.customers[0] : r.customers
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-ink-900">{r.order_number}</td>
                      <td className="px-4 py-3 text-ink-600">
                        {c?.full_name}
                        <br />
                        <span className="text-xs">{c?.phone}</span>
                        {c?.phone_secondary?.trim() ? (
                          <>
                            <br />
                            <span className="text-xs text-ink-500">{c.phone_secondary}</span>
                          </>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-ink-600">{formatDateTime(r.created_at)}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(Number(r.total))}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium', STATUS_STYLE[r.status])}>
                          {ORDER_STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link className="font-medium text-brand-700 hover:underline" to={`/admin/pedidos/${r.id}`}>
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          </Card>
        </>
      )}
    </div>
  )
}
