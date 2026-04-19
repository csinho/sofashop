import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { ORDER_STATUS_LABEL } from '@/constants/orderStatus'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { notifyErr, notifyOk } from '@/lib/notify'
import type { AdminOutletCtx } from '@/pages/admin/adminOutlet'
import type { OrderStatus } from '@/types/database'

type Cust = {
  id: string
  full_name: string
  phone: string
  phone_secondary: string | null
  email: string | null
  internal_notes: string | null
  orders: { id: string; order_number: string; created_at: string; status: OrderStatus; total: number }[] | null
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { store } = useOutletContext<AdminOutletCtx>()
  const [c, setC] = useState<Cust | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const sb = getSupabaseBrowserClient()
      const { data } = await sb
        .from('customers')
        .select('id, full_name, phone, phone_secondary, email, internal_notes, orders(id, order_number, created_at, status, total)')
        .eq('id', id!)
        .eq('store_id', store.id)
        .single()
      if (!alive) return
      const row = data as Cust | null
      setC(row)
      setNotes(row?.internal_notes ?? '')
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [id, store.id])

  async function saveNotes() {
    if (!c) return
    setSavingNotes(true)
    const sb = getSupabaseBrowserClient()
    const { error } = await sb
      .from('customers')
      .update({ internal_notes: notes.trim() })
      .eq('id', c.id)
      .eq('store_id', store.id)
    setSavingNotes(false)
    if (error) {
      notifyErr(error.message)
      return
    }
    setC({ ...c, internal_notes: notes.trim() })
    notifyOk('Observações salvas.')
  }

  if (loading) return <p className="text-sm text-ink-500">Carregando…</p>
  if (!c) return <p>Cliente não encontrado.</p>

  const orders = [...(c.orders ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const spent = orders.reduce((s, o) => s + Number(o.total), 0)

  return (
    <div className="w-full max-w-full space-y-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8 lg:space-y-0">
      <div className="space-y-4 lg:col-span-4">
        <Link to="/admin/clientes" className="text-sm font-medium text-brand-700 hover:underline">
          ← Clientes
        </Link>
        <Card>
          <h2 className="font-display text-2xl font-semibold text-ink-900 lg:text-3xl">{c.full_name}</h2>
          <p className="mt-1 text-sm text-ink-600">{c.phone}</p>
          {c.phone_secondary?.trim() ? <p className="text-sm text-ink-600">{c.phone_secondary}</p> : null}
          {c.email ? <p className="text-sm text-ink-600">{c.email}</p> : null}
          <p className="mt-4 text-sm font-medium text-ink-900">Total gasto: {formatCurrency(spent)}</p>
        </Card>

        <Card>
          <h3 className="font-display text-lg font-semibold text-ink-900">Observações internas</h3>
          <p className="mt-1 text-xs text-ink-500">
            Visível apenas no painel da loja. O cliente não vê nem edita este campo no catálogo.
          </p>
          <Textarea className="mt-3" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Anotações sobre atendimento, preferências, histórico…" />
          <Button type="button" className="mt-3" loading={savingNotes} onClick={() => void saveNotes()}>
            Salvar observações
          </Button>
        </Card>
      </div>
      <Card className="lg:col-span-8">
        <h3 className="font-display text-lg font-semibold text-ink-900">Histórico de pedidos</h3>
        <ul className="mt-4 divide-y divide-ink-100 text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <Link className="font-medium text-brand-700 hover:underline" to={`/admin/pedidos/${o.id}`}>
                  {o.order_number}
                </Link>
                <p className="text-xs text-ink-500">{formatDateTime(o.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(Number(o.total))}</p>
                <p className="text-xs text-ink-500">{ORDER_STATUS_LABEL[o.status]}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
