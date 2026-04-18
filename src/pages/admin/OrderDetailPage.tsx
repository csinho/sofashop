import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { ORDER_STATUS_LABEL } from '@/constants/orderStatus'
import { formatOrderPaymentSummary } from '@/lib/orderPaymentSummary'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { generateOrderPdf } from '@/services/orderPdf'
import { notifyErr, notifyOk } from '@/lib/notify'
import type { AdminOutletCtx } from '@/pages/admin/adminOutlet'
import type { OrderStatus, PaymentDetails, PaymentKind } from '@/types/database'

type OrderFull = {
  id: string
  order_number: string
  created_at: string
  status: OrderStatus
  subtotal: number
  total: number
  payment_kind: PaymentKind
  payment_details: PaymentDetails
  customer_snapshot: Record<string, unknown>
  shipping_snapshot: Record<string, unknown>
  notes: string
  customers:
    | { full_name: string; phone: string; email: string | null }
    | { full_name: string; phone: string; email: string | null }[]
    | null
  order_items: {
    id: string
    product_name: string
    sku: string
    quantity: number
    unit_price: number
    line_total: number
    options_snapshot: Record<string, unknown> | null
  }[]
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { store } = useOutletContext<AdminOutletCtx>()
  const { user } = useAuth()
  const [order, setOrder] = useState<OrderFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<OrderStatus>('novo')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const sb = getSupabaseBrowserClient()
      const { data } = await sb
        .from('orders')
        .select(
          `
          id, order_number, created_at, status, subtotal, total, payment_kind, payment_details,
          customer_snapshot, shipping_snapshot, notes,
          customers ( full_name, phone, email ),
          order_items ( id, product_name, sku, quantity, unit_price, line_total, options_snapshot )
        `,
        )
        .eq('id', id!)
        .eq('store_id', store.id)
        .single()
      if (!alive) return
      const o = data as unknown as OrderFull | null
      setOrder(o)
      if (o) setStatus(o.status)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [id, store.id])

  async function saveStatus() {
    if (!order || !user) return
    const sb = getSupabaseBrowserClient()
    const { error } = await sb.from('orders').update({ status }).eq('id', order.id).eq('store_id', store.id)
    if (error) {
      notifyErr(error.message)
      return
    }
    await sb.from('order_status_history').insert({
      order_id: order.id,
      status,
      changed_by: user.id,
      note: 'Atualizado pelo painel',
    })
    setOrder({ ...order, status })
    notifyOk('Status do pedido atualizado.')
  }

  async function onPdf() {
    if (!order) return
    try {
      await generateOrderPdf({
        store,
        orderNumber: order.order_number,
        createdAt: order.created_at,
        status: order.status,
        customer: (order.customer_snapshot as Record<string, unknown>) ?? {},
        shipping: order.shipping_snapshot,
        items: order.order_items.map((i) => ({
          product_name: i.product_name,
          sku: i.sku,
          quantity: i.quantity,
          unit_price: Number(i.unit_price),
          line_total: Number(i.line_total),
          options_snapshot: i.options_snapshot,
        })),
        total: Number(order.total),
        paymentKind: order.payment_kind,
        paymentDetails: order.payment_details ?? {},
        notes: order.notes,
      })
      notifyOk('PDF gerado e baixado.')
    } catch {
      notifyErr('Não foi possível gerar o PDF.')
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Carregando…</p>
  if (!order) return <p>Pedido não encontrado.</p>

  return (
    <div className="w-full max-w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/admin/pedidos" className="text-sm font-medium text-brand-700 hover:underline">
            ← Pedidos
          </Link>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink-900 lg:text-3xl">{order.order_number}</h2>
          <p className="text-sm text-ink-600">{formatDateTime(order.created_at)}</p>
        </div>
        <Button variant="secondary" onClick={onPdf}>
          Gerar PDF
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <Card className="flex flex-wrap items-end gap-3 lg:col-span-4">
          <div className="min-w-0 flex-1">
            <label className="text-xs font-medium text-ink-600">Status</label>
            <Select className="mt-1 min-w-[200px] w-full max-w-full" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
              {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={saveStatus}>Salvar status</Button>
        </Card>

        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-8">
          <Card>
            <h3 className="font-display text-lg font-semibold text-ink-900">Cliente</h3>
            <p className="mt-2 text-sm text-ink-700">
              {String((order.customer_snapshot as Record<string, unknown> | undefined)?.full_name ?? '')}
            </p>
            <p className="text-sm text-ink-600">
              {String((order.customer_snapshot as Record<string, unknown> | undefined)?.phone ?? '')}
            </p>
          </Card>
          <Card>
            <h3 className="font-display text-lg font-semibold text-ink-900">Entrega</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">
              {String(order.shipping_snapshot.street ?? '')}, {String(order.shipping_snapshot.number ?? '')}
              {'\n'}
              {String(order.shipping_snapshot.district ?? '')} — {String(order.shipping_snapshot.city ?? '')}/
              {String(order.shipping_snapshot.state ?? '')}
              {'\n'}CEP {String(order.shipping_snapshot.cep ?? '')}
            </p>
          </Card>
        </div>
      </div>

      <Card className="w-full">
        <h3 className="font-display text-lg font-semibold text-ink-900">Pagamento</h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-700">
          {formatOrderPaymentSummary(order.payment_kind, order.payment_details).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </Card>

      <Card className="w-full overflow-x-auto">
        <h3 className="font-display text-lg font-semibold text-ink-900">Itens</h3>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-ink-500">
              <th className="py-2">Produto</th>
              <th className="py-2">SKU</th>
              <th className="py-2">Qtd</th>
              <th className="py-2">Unit.</th>
              <th className="py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((i) => (
              <tr key={i.id} className="border-b border-ink-100">
                <td className="py-2">
                  {i.product_name}
                  <div className="text-xs text-ink-500">
                    {i.options_snapshot?.color ? `Cor: ${String(i.options_snapshot.color)}` : ''}{' '}
                    {i.options_snapshot?.variant ? `Var.: ${String(i.options_snapshot.variant)}` : ''}
                  </div>
                </td>
                <td className="py-2">{i.sku}</td>
                <td className="py-2">{i.quantity}</td>
                <td className="py-2">{formatCurrency(Number(i.unit_price))}</td>
                <td className="py-2 font-semibold">{formatCurrency(Number(i.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-right text-lg font-bold text-ink-900">Total {formatCurrency(Number(order.total))}</p>
      </Card>

      {order.notes ? (
        <Card className="w-full">
          <h3 className="font-display text-lg font-semibold text-ink-900">Observações</h3>
          <p className="mt-2 text-sm text-ink-700">{order.notes}</p>
        </Card>
      ) : null}
    </div>
  )
}
