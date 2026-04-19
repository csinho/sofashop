import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/format'
import { PAYMENT_LABEL } from '@/constants/payments'
import { ORDER_STATUS_LABEL } from '@/constants/orderStatus'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { useMyStore } from '@/hooks/useMyStore'
import { defaultCheckoutPaymentConfig, resolveCheckoutConfig } from '@/lib/checkoutConfig'
import { parseDecimalPtBr, sanitizeDecimalPtBr } from '@/lib/decimalInput'
import { formatOrderPaymentSummary } from '@/lib/orderPaymentSummary'
import { notifyErr, notifyOk } from '@/lib/notify'
import type { AdminOutletCtx } from '@/pages/admin/adminOutlet'
import type { OrderStatus, PaymentKind } from '@/types/database'

type O = {
  id: string
  total: number
  status: OrderStatus
  payment_kind: PaymentKind
  payment_details: Record<string, unknown>
  created_at: string
}

const ALL_METHODS = Object.keys(PAYMENT_LABEL) as PaymentKind[]

export function FinancePage() {
  const { store } = useOutletContext<AdminOutletCtx>()
  const { refresh } = useMyStore()
  const [orders, setOrders] = useState<O[]>([])
  const [loading, setLoading] = useState(true)
  const [savingCfg, setSavingCfg] = useState(false)

  const initialCfg = useMemo(() => resolveCheckoutConfig(store), [store])
  const [accepted, setAccepted] = useState<Set<PaymentKind>>(
    () => new Set(initialCfg.accepted_methods.length ? initialCfg.accepted_methods : defaultCheckoutPaymentConfig().accepted_methods),
  )
  const [feeCr, setFeeCr] = useState(String(initialCfg.card_fee_credit_percent))
  const [feeDb, setFeeDb] = useState(String(initialCfg.card_fee_debit_percent))

  useEffect(() => {
    const c = resolveCheckoutConfig(store)
    setAccepted(new Set(c.accepted_methods.length ? c.accepted_methods : defaultCheckoutPaymentConfig().accepted_methods))
    setFeeCr(String(c.card_fee_credit_percent))
    setFeeDb(String(c.card_fee_debit_percent))
  }, [store])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const sb = getSupabaseBrowserClient()
      const { data } = await sb
        .from('orders')
        .select('id, total, status, payment_kind, payment_details, created_at')
        .eq('store_id', store.id)
      if (!alive) return
      setOrders((data as O[]) ?? [])
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [store.id])

  async function savePaymentConfig() {
    const methods = ALL_METHODS.filter((k) => accepted.has(k))
    if (methods.length === 0) {
      notifyErr('Selecione ao menos uma forma de pagamento.')
      return
    }
    setSavingCfg(true)
    const sb = getSupabaseBrowserClient()
    const { error } = await sb
      .from('stores')
      .update({
        checkout_payment_config: {
          accepted_methods: methods,
          card_fee_credit_percent: Number(feeCr.replace(',', '.')) || 0,
          card_fee_debit_percent: Number(feeDb.replace(',', '.')) || 0,
        },
      })
      .eq('id', store.id)
    setSavingCfg(false)
    if (error) notifyErr(error.message)
    else {
      notifyOk('Formas de pagamento e taxas atualizadas.')
      await refresh()
    }
  }

  function toggleMethod(k: PaymentKind) {
    setAccepted((prev) => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }

  const paidPipeline: OrderStatus[] = ['aprovado', 'em_producao', 'pronto_entrega', 'entregue']
  const agg = useMemo(() => {
    const totalSold = orders.reduce((s, o) => s + Number(o.total), 0)
    const paid = orders.filter((o) => paidPipeline.includes(o.status))
    const pending = orders.filter((o) => !paidPipeline.includes(o.status) && o.status !== 'cancelado')
    const byPay: Record<string, number> = {}
    for (const o of orders) {
      byPay[o.payment_kind] = (byPay[o.payment_kind] ?? 0) + Number(o.total)
    }
    const installments = orders.filter((o) => o.payment_kind === 'parcelado' || o.payment_kind === 'entrada_parcelado')
    return {
      totalSold,
      paidSum: paid.reduce((s, o) => s + Number(o.total), 0),
      pendingSum: pending.reduce((s, o) => s + Number(o.total), 0),
      byPay,
      installments,
    }
  }, [orders])

  if (loading) return <p className="text-sm text-ink-500">Carregando…</p>

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold text-ink-900">Financeiro</h2>

      <Card className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-ink-900">Pagamento no checkout</h3>
        <p className="text-sm text-ink-600">
          Defina quais formas de pagamento o cliente pode escolher e as taxas médias da maquininha (apenas informativas no checkout).
        </p>
        <div className="flex flex-wrap gap-3">
          {ALL_METHODS.map((k) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm">
              <input type="checkbox" checked={accepted.has(k)} onChange={() => toggleMethod(k)} />
              {PAYMENT_LABEL[k]}
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-ink-600">Taxa cartão crédito / parcelado (%)</label>
            <Input
              className="mt-1 [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-outer-spin-button]:opacity-100"
              type="number"
              min={0}
              max={100}
              step={0.1}
              inputMode="decimal"
              value={feeCr === '' ? '' : parseDecimalPtBr(feeCr)}
              onChange={(e) => {
                const t = e.target.value
                if (t === '') {
                  setFeeCr('')
                  return
                }
                const n = Number(t)
                if (!Number.isFinite(n)) return
                setFeeCr(sanitizeDecimalPtBr(String(n).replace('.', ','), 2))
              }}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Taxa cartão débito (%)</label>
            <Input
              className="mt-1 [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-outer-spin-button]:opacity-100"
              type="number"
              min={0}
              max={100}
              step={0.1}
              inputMode="decimal"
              value={feeDb === '' ? '' : parseDecimalPtBr(feeDb)}
              onChange={(e) => {
                const t = e.target.value
                if (t === '') {
                  setFeeDb('')
                  return
                }
                const n = Number(t)
                if (!Number.isFinite(n)) return
                setFeeDb(sanitizeDecimalPtBr(String(n).replace('.', ','), 2))
              }}
              placeholder="0"
            />
          </div>
        </div>
        <Button type="button" loading={savingCfg} onClick={() => void savePaymentConfig()}>
          Salvar configuração de pagamento
        </Button>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase text-ink-500">Total vendido (todos)</p>
          <p className="mt-2 text-2xl font-bold text-ink-900">{formatCurrency(agg.totalSold)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-ink-500">Pedidos em pipeline pago / produção</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(agg.paidSum)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-ink-500">Pendentes (novo, análise, etc.)</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{formatCurrency(agg.pendingSum)}</p>
        </Card>
      </div>

      <Card>
        <h3 className="font-display text-lg font-semibold text-ink-900">Total por forma de pagamento</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {Object.entries(agg.byPay).map(([k, v]) => (
            <li key={k} className="flex justify-between border-b border-ink-100 py-2">
              <span>{PAYMENT_LABEL[k as PaymentKind]}</span>
              <span className="font-semibold">{formatCurrency(v)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="font-display text-lg font-semibold text-ink-900">Parcelados e entrada + parcelas</h3>
        <p className="mt-2 text-sm text-ink-600">
          {agg.installments.length} pedidos com parcelamento registrado. Detalhes das parcelas ficam em cada pedido e no PDF.
        </p>
        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-xs text-ink-600">
          {agg.installments.map((o) => (
            <li key={o.id}>
              {formatOrderPaymentSummary(o.payment_kind, o.payment_details).join(' ')} — {ORDER_STATUS_LABEL[o.status]}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
