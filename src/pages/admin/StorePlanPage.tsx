import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { PixQrCode } from '@/components/billing/PixQrCode'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BILLING_STATUS_LABELS } from '@/lib/billing/constants'
import { formatDateBrt, formatDateTimeBrt } from '@/lib/billing/dates'
import { canShowPixButton, dueDateForBilling } from '@/lib/billing/state'
import { formatCurrency } from '@/lib/format'
import { notifyErr, notifyOk } from '@/lib/notify'
import { getPwaBrandName } from '@/lib/documentTitle'
import { formatPlanLabel } from '@/hooks/usePublicPlan'
import { useStoreBilling } from '@/hooks/useStoreBilling'
import type { AdminOutletCtx } from '@/pages/admin/adminOutlet'
import {
  createPixCharge,
  listStoreBillingPayments,
  type BillingPaymentRow,
  type PixChargeResult,
} from '@/services/billingService'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'

/** Mesmo TTL da cobrança na Woovi (expiresIn 3 dias). */
const PIX_CHARGE_TTL_MS = 3 * 24 * 60 * 60 * 1000

type StoredPixCharge = PixChargeResult & { expiresAt: number }

function pixStorageKey(storeId: string) {
  return `sofashop:pending-pix:${storeId}`
}

function loadStoredPix(storeId: string): PixChargeResult | null {
  try {
    const raw = sessionStorage.getItem(pixStorageKey(storeId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredPixCharge
    if (Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(pixStorageKey(storeId))
      return null
    }
    const { expiresAt: _expiresAt, ...pix } = parsed
    return pix
  } catch {
    return null
  }
}

function saveStoredPix(storeId: string, pix: PixChargeResult) {
  const stored: StoredPixCharge = { ...pix, expiresAt: Date.now() + PIX_CHARGE_TTL_MS }
  sessionStorage.setItem(pixStorageKey(storeId), JSON.stringify(stored))
}

function clearStoredPix(storeId: string) {
  sessionStorage.removeItem(pixStorageKey(storeId))
}

async function downloadReceiptPdf(storeId: string, endToEndId: string) {
  const sb = getSupabaseBrowserClient()
  const { data: session } = await sb.auth.getSession()
  const token = session.session?.access_token
  if (!token) throw new Error('Sessão inválida')

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/billing`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'downloadReceipt', storeId, endToEndId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Erro ao baixar recibo')
  }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `recibo-${endToEndId}.pdf`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function StorePlanPage() {
  const { store } = useOutletContext<AdminOutletCtx>()
  const { billing, loading, error, refresh } = useStoreBilling(store?.id)
  const [payments, setPayments] = useState<BillingPaymentRow[]>([])
  const [pix, setPix] = useState<PixChargeResult | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loadingPayments, setLoadingPayments] = useState(true)

  useEffect(() => {
    document.title = `${getPwaBrandName()} — Plano`
  }, [])

  useEffect(() => {
    if (!store?.id) return
    const stored = loadStoredPix(store.id)
    if (stored) setPix(stored)
  }, [store?.id])

  useEffect(() => {
    if (!store?.id || billing?.billing_status === 'ativo') {
      if (store?.id) clearStoredPix(store.id)
      setPix(null)
    }
  }, [store?.id, billing?.billing_status])

  useEffect(() => {
    if (!store?.id) return undefined
    let alive = true
    void listStoreBillingPayments(store.id)
      .then((rows) => {
        if (alive) setPayments(rows)
      })
      .catch((e) => notifyErr(e instanceof Error ? e.message : 'Erro ao carregar pagamentos'))
      .finally(() => {
        if (alive) setLoadingPayments(false)
      })
    return () => {
      alive = false
    }
  }, [store?.id])

  const snapshot = useMemo(() => {
    if (!billing) return null
    return {
      billing_status: billing.billing_status,
      next_billing_at: billing.next_billing_at,
      trial_ends_at: billing.trial_ends_at,
      plan_value_cents: billing.plan_value_cents,
    }
  }, [billing])

  const showPix = snapshot ? canShowPixButton(snapshot) : false
  const due = snapshot ? dueDateForBilling(snapshot) : null

  async function handleGeneratePix() {
    setGenerating(true)
    setPix(null)
    try {
      const result = await createPixCharge(store.id)
      setPix(result)
      saveStoredPix(store.id, result)
      notifyOk('PIX gerado. Escaneie o QR Code ou copie o código.')
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : 'Erro ao gerar PIX')
    } finally {
      setGenerating(false)
    }
  }

  async function copyBrCode() {
    if (!pix?.brCode) return
    await navigator.clipboard.writeText(pix.brCode)
    notifyOk('Código PIX copiado.')
  }

  if (!store?.id) {
    return <p className="text-sm text-ink-500">Carregando loja…</p>
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-ink-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-ink-200" />
      </div>
    )
  }

  if (!billing) {
    return (
      <Card className="space-y-3">
        <h1 className="font-display text-xl font-semibold text-ink-900">Plano da loja</h1>
        <p className="text-sm text-red-700">{error ?? 'Não foi possível carregar os dados do plano.'}</p>
        <Button type="button" variant="secondary" onClick={() => void refresh()}>
          Tentar novamente
        </Button>
      </Card>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Plano da loja</h1>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-3xl font-semibold tracking-tight text-brand-700">
            {formatPlanLabel(billing.plan_value_cents)}
          </span>
          <span className="text-base font-medium text-ink-500">/mês</span>
        </div>
        <p className="mt-1 text-sm text-ink-500">Assinatura mensal do {getPwaBrandName()}</p>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{BILLING_STATUS_LABELS[billing.billing_status]}</Badge>
          {due && (
            <span className="text-sm text-ink-600">
              {billing.billing_status === 'trial' ? 'Fim do trial' : 'Próxima cobrança'}:{' '}
              <strong>{formatDateBrt(due)}</strong>
            </span>
          )}
        </div>
        {billing.last_payment_at && (
          <p className="text-sm text-ink-500">Último pagamento: {formatDateTimeBrt(billing.last_payment_at)}</p>
        )}
        {billing.catalog_paused_by_billing && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Seu catálogo está pausado por falta de pagamento. Após confirmar o PIX, o acesso é restabelecido
            automaticamente.
          </p>
        )}

        {showPix && !pix && (
          <div className="border-t border-ink-100 pt-4">
            <Button onClick={() => void handleGeneratePix()} disabled={generating}>
              {generating ? 'Gerando…' : 'Gerar PIX'}
            </Button>
          </div>
        )}

        {pix && (
          <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-ink-800">
                Valor: {formatCurrency(pix.valueCents / 100)}
              </p>
              <p className="mt-1 text-sm text-ink-500">
                Escaneie o QR Code no app do banco ou copie o código PIX. O pagamento é confirmado
                automaticamente nesta página.
              </p>
            </div>
            {pix.brCode && <PixQrCode brCode={pix.brCode} />}
            {pix.brCode && (
              <Button type="button" onClick={() => void copyBrCode()}>
                Copiar código PIX
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-ink-900">Histórico de pagamentos</h2>
          <Link to="/admin/plano/politica-reembolso" className="text-sm text-brand-700 hover:underline">
            Política de reembolso
          </Link>
        </div>
        {loadingPayments ? (
          <p className="mt-4 text-sm text-ink-500">Carregando…</p>
        ) : payments.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">Nenhum pagamento registrado ainda.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase text-ink-500">
                  <th className="pb-2 pr-4">Data</th>
                  <th className="pb-2 pr-4">Valor</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Recibo</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(payments) ? payments : []).map((p) => (
                  <tr key={p.id} className="border-b border-ink-100">
                    <td className="py-3 pr-4">{formatDateTimeBrt(p.paid_at)}</td>
                    <td className="py-3 pr-4">{formatCurrency(p.value_cents / 100)}</td>
                    <td className="py-3 pr-4 capitalize">{p.status}</td>
                    <td className="py-3">
                      {p.end_to_end_id && p.status === 'pago' ? (
                        <button
                          type="button"
                          className="text-brand-700 hover:underline"
                          onClick={() =>
                            void downloadReceiptPdf(store.id, p.end_to_end_id!).catch((e) =>
                              notifyErr(e instanceof Error ? e.message : 'Erro'),
                            )
                          }
                        >
                          PDF
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-ink-400">
        Após o pagamento, a confirmação pode levar alguns instantes. Esta página atualiza automaticamente.
      </p>
      <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => void refresh()}>
        Atualizar status
      </button>
    </div>
  )
}
