import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IntegerField } from '@/components/ui/IntegerField'
import { formatCurrency } from '@/lib/format'
import { PAYMENT_LABEL } from '@/constants/payments'
import { ORDER_STATUS_LABEL } from '@/constants/orderStatus'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { useMyStore } from '@/hooks/useMyStore'
import { defaultCheckoutPaymentConfig, resolveCheckoutConfig } from '@/lib/checkoutConfig'
import { DEFAULT_CREDIT_INSTALLMENT_RATES, formatPercentBr } from '@/lib/creditCardInstallments'
import { parseDecimalPtBr, sanitizeDecimalPtBr } from '@/lib/decimalInput'
import { formatOrderPaymentSummary } from '@/lib/orderPaymentSummary'
import { notifyErr, notifyOk } from '@/lib/notify'
import {
  fetchStoreCreditInstallmentFees,
  restoreStoreCreditInstallmentDefaults,
  replaceStoreCreditInstallmentFees,
} from '@/services/creditInstallmentFeeService'
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

type InstRow = {
  key: string
  installments: string
  fee_percent: string
}

const ALL_METHODS = Object.keys(PAYMENT_LABEL) as PaymentKind[]

function rowsFromRates(rates: { installments: number; fee_percent: number }[]): InstRow[] {
  return rates.map((r) => ({
    key: `inst-${r.installments}`,
    installments: String(r.installments),
    fee_percent: String(r.fee_percent).replace('.', ','),
  }))
}

export function FinancePage() {
  const { store } = useOutletContext<AdminOutletCtx>()
  const { refresh } = useMyStore()
  const [orders, setOrders] = useState<O[]>([])
  const [loading, setLoading] = useState(true)
  const [savingCfg, setSavingCfg] = useState(false)
  const [section, setSection] = useState<'checkout' | 'cashflow'>('checkout')
  const [instRows, setInstRows] = useState<InstRow[]>(() => rowsFromRates(DEFAULT_CREDIT_INSTALLMENT_RATES))
  const [loadingInst, setLoadingInst] = useState(true)
  const [restoreInstOpen, setRestoreInstOpen] = useState(false)
  const [restoringInst, setRestoringInst] = useState(false)
  const [newInstCount, setNewInstCount] = useState('11')
  const [newInstPct, setNewInstPct] = useState('11')

  const initialCfg = useMemo(() => resolveCheckoutConfig(store), [store])
  const [accepted, setAccepted] = useState<Set<PaymentKind>>(
    () => new Set(initialCfg.accepted_methods.length ? initialCfg.accepted_methods : defaultCheckoutPaymentConfig().accepted_methods),
  )

  useEffect(() => {
    const c = resolveCheckoutConfig(store)
    setAccepted(new Set(c.accepted_methods.length ? c.accepted_methods : defaultCheckoutPaymentConfig().accepted_methods))
  }, [store])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoadingInst(true)
      try {
        const data = await fetchStoreCreditInstallmentFees(store.id)
        if (!alive) return
        setInstRows(rowsFromRates(data.rates))
      } catch (e: unknown) {
        if (alive) notifyErr(e instanceof Error ? e.message : 'Erro ao carregar taxas de cartão.')
      } finally {
        if (alive) setLoadingInst(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [store.id])

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

  function parseInstRows(): { installments: number; fee_percent: number }[] {
    return instRows.map((r) => ({
      installments: Math.max(1, Number(r.installments.replace(/\D/g, '')) || 1),
      fee_percent: parseDecimalPtBr(r.fee_percent) || 0,
    }))
  }

  async function savePaymentConfig() {
    const methods = ALL_METHODS.filter((k) => accepted.has(k))
    if (methods.length === 0) {
      notifyErr('Selecione ao menos uma forma de pagamento.')
      return
    }
    let rates: { installments: number; fee_percent: number }[]
    try {
      rates = parseInstRows()
      const keys = new Set(rates.map((r) => r.installments))
      if (keys.size !== rates.length) {
        notifyErr('Cada linha deve ter uma quantidade de parcelas diferente.')
        return
      }
      if (rates.length === 0) {
        notifyErr('Cadastre ao menos uma taxa de parcela no cartão de crédito.')
        return
      }
    } catch (e: unknown) {
      notifyErr(e instanceof Error ? e.message : 'Taxas inválidas.')
      return
    }

    setSavingCfg(true)
    const sb = getSupabaseBrowserClient()
    const { error } = await sb
      .from('stores')
      .update({
        checkout_payment_config: { accepted_methods: methods },
      })
      .eq('id', store.id)

    if (error) {
      setSavingCfg(false)
      notifyErr(error.message)
      return
    }

    try {
      await replaceStoreCreditInstallmentFees(store.id, rates)
      const data = await fetchStoreCreditInstallmentFees(store.id)
      setInstRows(rowsFromRates(data.rates))
      notifyOk('Formas de pagamento e taxas de cartão de crédito atualizadas.')
      await refresh()
    } catch (e: unknown) {
      notifyErr(e instanceof Error ? e.message : 'Erro ao salvar taxas de parcelas.')
    } finally {
      setSavingCfg(false)
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

  function addInstRow() {
    const n = Math.max(1, Number(newInstCount.replace(/\D/g, '')) || 1)
    const pct = parseDecimalPtBr(newInstPct) || 0
    if (instRows.some((r) => Number(r.installments) === n)) {
      notifyErr('Já existe uma linha com essa quantidade de parcelas.')
      return
    }
    setInstRows((prev) =>
      [...prev, { key: `new-${n}-${Date.now()}`, installments: String(n), fee_percent: String(pct).replace('.', ',') }].sort(
        (a, b) => Number(a.installments) - Number(b.installments),
      ),
    )
  }

  function removeInstRow(key: string) {
    setInstRows((prev) => prev.filter((r) => r.key !== key))
  }

  async function onRestoreInstDefaults() {
    setRestoringInst(true)
    try {
      await restoreStoreCreditInstallmentDefaults(store.id)
      const data = await fetchStoreCreditInstallmentFees(store.id)
      setInstRows(rowsFromRates(data.rates))
      notifyOk('Tabela padrão de parcelas restaurada (1x a 10x).')
      setRestoreInstOpen(false)
    } catch (e: unknown) {
      notifyErr(e instanceof Error ? e.message : 'Erro ao restaurar tabela.')
    } finally {
      setRestoringInst(false)
    }
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

  const cashflow = useMemo(() => {
    const now = new Date()
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const receivedStatuses: OrderStatus[] = ['entregue']
    const receivableStatuses: OrderStatus[] = ['novo', 'em_analise', 'aprovado', 'em_producao', 'pronto_entrega']

    const received = orders.filter((o) => receivedStatuses.includes(o.status))
    const receivables = orders.filter((o) => receivableStatuses.includes(o.status))

    const receivedSum = received.reduce((s, o) => s + Number(o.total), 0)
    const receivableSum = receivables.reduce((s, o) => s + Number(o.total), 0)

    const monthOrders = orders.filter((o) => {
      const d = new Date(o.created_at)
      return d >= startMonth && d < endMonth
    })

    const monthReceived = monthOrders.filter((o) => receivedStatuses.includes(o.status)).reduce((s, o) => s + Number(o.total), 0)
    const monthToReceive = monthOrders.filter((o) => receivableStatuses.includes(o.status)).reduce((s, o) => s + Number(o.total), 0)

    const projectedBalance = receivedSum + receivableSum

    return {
      received,
      receivables,
      receivedSum,
      receivableSum,
      projectedBalance,
      monthReceived,
      monthToReceive,
    }
  }, [orders])

  if (loading) return <p className="text-sm text-ink-500">Carregando…</p>

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold text-ink-900">Financeiro</h2>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={section === 'checkout' ? 'primary' : 'secondary'}
          tooltip="Formas de pagamento e taxas do cartão de crédito no checkout."
          onClick={() => setSection('checkout')}
        >
          Configuração de pagamento
        </Button>
        <Button
          type="button"
          variant={section === 'cashflow' ? 'primary' : 'secondary'}
          tooltip="Resumo de pedidos e valores recebidos por forma de pagamento."
          onClick={() => setSection('cashflow')}
        >
          Fluxo de caixa
        </Button>
      </div>

      {section === 'checkout' ? (
        <Card className="space-y-5">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink-900">Pagamento no checkout</h3>
            <p className="mt-1 text-sm text-ink-600">
              Escolha as formas de pagamento disponíveis e configure a taxa da maquinha para cada parcela no{' '}
              <strong>cartão de crédito</strong> (usada no checkout e no total do pedido).
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {ALL_METHODS.map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm">
                <input type="checkbox" checked={accepted.has(k)} onChange={() => toggleMethod(k)} />
                {PAYMENT_LABEL[k]}
              </label>
            ))}
          </div>

          <div className="space-y-3 border-t border-ink-100 pt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-ink-900">Taxas — cartão de crédito</h4>
                <p className="mt-0.5 text-xs text-ink-500">
                  Percentual cobrado pela maquinha em cada quantidade de parcelas. O cliente vê o total atualizado no checkout.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="text-xs"
                tooltip="Voltar à tabela padrão de 1x a 10x."
                onClick={() => setRestoreInstOpen(true)}
              >
                Restaurar padrão 1x–10x
              </Button>
            </div>

            {loadingInst ? (
              <p className="text-sm text-ink-500">Carregando taxas…</p>
            ) : (
              <div className="space-y-2">
                {instRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex flex-col gap-3 rounded-xl border border-ink-200 bg-white px-3 py-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <div className="w-20 shrink-0">
                        <label className="text-xs text-ink-500">Parcelas</label>
                        <IntegerField
                          className="mt-1"
                          min={1}
                          value={row.installments}
                          onValueChange={(d) =>
                            setInstRows((prev) =>
                              prev.map((r) => (r.key === row.key ? { ...r, installments: d || '1' } : r)),
                            )
                          }
                        />
                      </div>
                      <div className="min-w-[7rem] flex-1 sm:max-w-[8rem]">
                        <label className="text-xs text-ink-500">Taxa (%)</label>
                        <Input
                          className="mt-1 [&::-webkit-inner-spin-button]:opacity-100 [&::-webkit-outer-spin-button]:opacity-100"
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          inputMode="decimal"
                          value={row.fee_percent === '' ? '' : parseDecimalPtBr(row.fee_percent)}
                          onChange={(e) => {
                            const t = e.target.value
                            if (t === '') {
                              setInstRows((prev) =>
                                prev.map((r) => (r.key === row.key ? { ...r, fee_percent: '' } : r)),
                              )
                              return
                            }
                            const n = Number(t)
                            if (!Number.isFinite(n)) return
                            setInstRows((prev) =>
                              prev.map((r) =>
                                r.key === row.key
                                  ? { ...r, fee_percent: sanitizeDecimalPtBr(String(n).replace('.', ','), 2) }
                                  : r,
                              ),
                            )
                          }}
                        />
                      </div>
                      <p className="self-end pb-2 text-xs text-ink-500 sm:pb-2.5">
                        {row.installments ? `${row.installments}x = ${formatPercentBr(parseDecimalPtBr(row.fee_percent) || 0)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs text-red-600"
                        tooltip="Remover esta linha de parcelas."
                        onClick={() => removeInstRow(row.key)}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/50 p-3">
              <p className="text-xs font-medium text-ink-600">Adicionar parcela</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div className="w-24">
                  <label className="text-xs text-ink-500">Parcelas</label>
                  <IntegerField className="mt-1" min={1} value={newInstCount} onValueChange={setNewInstCount} />
                </div>
                <div className="w-28">
                  <label className="text-xs text-ink-500">Taxa (%)</label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    step={0.01}
                    value={newInstPct}
                    onChange={(e) => setNewInstPct(e.target.value)}
                  />
                </div>
                <Button type="button" variant="secondary" className="text-xs" tooltip="Incluir nova opção de parcelas." onClick={addInstRow}>
                  Adicionar
                </Button>
              </div>
            </div>
          </div>

          <Button
            type="button"
            loading={savingCfg}
            tooltip="Salvar formas de pagamento e tabela de taxas do cartão de crédito."
            onClick={() => void savePaymentConfig()}
          >
            Salvar configuração de pagamento
          </Button>

          <ConfirmDialog
            open={restoreInstOpen}
            title="Restaurar taxas padrão?"
            description="Substitui a tabela atual pelos valores padrão de 1x (3,8%) até 10x (10,84%)."
            confirmLabel="Restaurar"
            confirmVariant="danger"
            busy={restoringInst}
            onClose={() => setRestoreInstOpen(false)}
            onConfirm={() => void onRestoreInstDefaults()}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <p className="text-xs font-medium uppercase text-ink-500">Saldo projetado</p>
              <p className="mt-2 text-2xl font-bold text-ink-900">{formatCurrency(cashflow.projectedBalance)}</p>
              <p className="mt-1 text-xs text-ink-500">Recebido + a receber</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-ink-500">Contas a receber</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{formatCurrency(cashflow.receivableSum)}</p>
              <p className="mt-1 text-xs text-ink-500">{cashflow.receivables.length} pedidos em aberto</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-ink-500">Entradas recebidas</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(cashflow.receivedSum)}</p>
              <p className="mt-1 text-xs text-ink-500">{cashflow.received.length} pedidos entregues</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase text-ink-500">Mês atual</p>
              <p className="mt-2 text-sm font-semibold text-ink-900">Recebido: {formatCurrency(cashflow.monthReceived)}</p>
              <p className="mt-1 text-sm font-semibold text-ink-900">A receber: {formatCurrency(cashflow.monthToReceive)}</p>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h3 className="font-display text-lg font-semibold text-ink-900">Contas a receber (pedidos)</h3>
              <p className="mt-1 text-xs text-ink-500">Baseado nos pedidos que ainda não chegaram ao status “Entregue”.</p>
              <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
                {cashflow.receivables.map((o) => (
                  <li key={o.id} className="rounded-lg border border-ink-100 px-3 py-2">
                    <p className="font-medium text-ink-900">{formatCurrency(Number(o.total))}</p>
                    <p className="text-xs text-ink-600">
                      {ORDER_STATUS_LABEL[o.status]} • {PAYMENT_LABEL[o.payment_kind]}
                    </p>
                  </li>
                ))}
                {cashflow.receivables.length === 0 ? <li className="text-sm text-ink-500">Sem valores pendentes no momento.</li> : null}
              </ul>
            </Card>

            <Card>
              <h3 className="font-display text-lg font-semibold text-ink-900">Contas a pagar</h3>
              <p className="mt-1">
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Em breve</span>
              </p>
              <p className="mt-1 text-sm text-ink-600">
                Esta área está preparada para controlar despesas (fornecedores, frete, comissões e custos fixos) e completar o fluxo de caixa da loja.
              </p>
              <div className="mt-4 rounded-xl border border-dashed border-ink-200 bg-ink-50/60 p-3">
                <p className="text-xs text-ink-500">
                  Próximo passo recomendado: incluir lançamentos manuais de despesas com data de vencimento e status (aberto/pago).
                </p>
              </div>
            </Card>
          </div>

          <Card>
            <h3 className="font-display text-lg font-semibold text-ink-900">Totais por forma de pagamento</h3>
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
        </>
      )}
    </div>
  )
}
