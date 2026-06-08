import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/format'
import { formatDateTimeBrt } from '@/lib/billing/dates'
import { notifyErr } from '@/lib/notify'
import { fetchPlatformStorePayments, type BillingPaymentRow } from '@/services/billingService'

export function PlatformStoreBillingPayments({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<BillingPaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void fetchPlatformStorePayments(storeId)
      .then((r) => {
        if (alive) setRows(r.payments ?? [])
      })
      .catch((e) => notifyErr(e instanceof Error ? e.message : 'Erro ao carregar pagamentos'))
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [storeId])

  if (loading) return <p className="text-sm text-ink-500">Carregando pagamentos…</p>
  if (rows.length === 0) return <p className="text-sm text-ink-500">Nenhum pagamento do plano registrado.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-ink-200 text-left text-xs uppercase text-ink-500">
            <th className="pb-2 pr-3">Data</th>
            <th className="pb-2 pr-3">Valor</th>
            <th className="pb-2 pr-3">Status</th>
            <th className="pb-2 pr-3">End-to-end</th>
            <th className="pb-2">Estorno sugerido</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-ink-100">
              <td className="py-2.5 pr-3">{formatDateTimeBrt(p.paid_at)}</td>
              <td className="py-2.5 pr-3">{formatCurrency(p.value_cents / 100)}</td>
              <td className="py-2.5 pr-3 capitalize">{p.status}</td>
              <td className="py-2.5 pr-3 font-mono text-xs">{p.end_to_end_id ?? '—'}</td>
              <td className="py-2.5">
                {p.suggested_refund_cents != null
                  ? formatCurrency(p.suggested_refund_cents / 100)
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
