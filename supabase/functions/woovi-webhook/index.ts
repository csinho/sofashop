import { corsHeaders, jsonResponse, optionsResponse } from '../_shared/cors.ts'
import {
  formatDateBrt,
  getRefundQuote,
  nextBillingAfterPayment,
  pauseStoreCatalogForBilling,
  resumeStoreCatalogAfterBilling,
} from '../_shared/billingLogic.ts'
import { sendPlatformBillingWhatsApp } from '../_shared/billingNotify.ts'
import { validateWooviWebhookAuth } from '../_shared/woovi.ts'
import { getServiceClient } from '../_shared/supabase.ts'

function extractStoreIdFromCorrelation(correlationId: string): string | null {
  const m = correlationId.match(/^sofashop-([a-f0-9]{32})-/i)
  if (!m) return null
  const c = m[1]
  return `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  if (!validateWooviWebhookAuth(req)) {
    return jsonResponse({ error: 'Não autorizado' }, 401)
  }

  try {
    const body = await req.json()

    if (body?.evento === 'teste_webhook' || body?.event === 'teste_webhook') {
      return jsonResponse({ ok: true })
    }

    const event = String(body?.event ?? body?.evento ?? '')
    const sb = getServiceClient()

    if (event === 'OPENPIX:CHARGE_COMPLETED' || event === 'CHARGE_COMPLETED') {
      const charge = body.charge ?? body.pix ?? body
      const correlationId = String(charge?.correlationID ?? charge?.correlationId ?? '')
      const eventKey = String(body?.eventId ?? body?.id ?? `${correlationId}-${Date.now()}`)
      const endToEndId = charge?.transactionID ?? charge?.endToEndId ?? charge?.end_to_end_id ?? null
      const paidAtRaw = charge?.paidAt ?? charge?.paid_at ?? new Date().toISOString()
      const valueCents = Number(charge?.value ?? charge?.valueCents ?? 0)

      let storeId = extractStoreIdFromCorrelation(correlationId)
      if (!storeId && charge?.customer?.correlationID) {
        storeId = extractStoreIdFromCorrelation(String(charge.customer.correlationID))
      }

      if (!storeId) {
        const { data: byCorr } = await sb
          .from('billing_payments')
          .select('store_id')
          .eq('correlation_id', correlationId)
          .maybeSingle()
        storeId = byCorr?.store_id ?? null
      }

      if (!storeId) {
        return jsonResponse({ ok: false, error: 'Loja não identificada' }, 200)
      }

      const { data: existing } = await sb
        .from('billing_payments')
        .select('id')
        .eq('woovi_event_key', eventKey)
        .maybeSingle()
      if (existing) return jsonResponse({ ok: true, duplicate: true })

      const { data: store } = await sb
        .from('stores')
        .select('id, trade_name, whatsapp_1, next_billing_at, trial_ends_at, billing_status')
        .eq('id', storeId)
        .maybeSingle()
      if (!store) return jsonResponse({ ok: false, error: 'Loja não encontrada' }, 200)

      const paidAt = new Date(paidAtRaw)
      const dueAt = store.billing_status === 'trial'
        ? store.trial_ends_at
          ? new Date(store.trial_ends_at)
          : null
        : store.next_billing_at
          ? new Date(store.next_billing_at)
          : null
      const nextBilling = nextBillingAfterPayment(paidAt, dueAt)

      await sb.from('billing_payments').insert({
        store_id: storeId,
        paid_at: paidAt.toISOString(),
        value_cents: valueCents || 0,
        correlation_id: correlationId,
        end_to_end_id: endToEndId,
        woovi_event_key: eventKey,
        status: 'pago',
      })

      await sb
        .from('stores')
        .update({
          billing_status: 'ativo',
          last_payment_at: paidAt.toISOString(),
          next_billing_at: nextBilling.toISOString(),
          billing_period_ends_at: nextBilling.toISOString(),
        })
        .eq('id', storeId)

      await resumeStoreCatalogAfterBilling(sb, storeId)

      await sendPlatformBillingWhatsApp(sb, {
        storeId,
        storeName: store.trade_name,
        recipientPhone: store.whatsapp_1,
        eventType: 'payment_confirmed',
        extraVars: { DATA_VENCIMENTO: formatDateBrt(nextBilling) },
      }).catch(() => {})

      return jsonResponse({ ok: true })
    }

    if (
      event === 'PIX_TRANSACTION_REFUND_SENT_CONFIRMED' ||
      event === 'OPENPIX:PIX_TRANSACTION_REFUND_SENT_CONFIRMED'
    ) {
      const pix = body.pix ?? body.charge ?? body
      const endToEndId = String(pix?.endToEndId ?? pix?.end_to_end_id ?? '')
      const eventKey = String(body?.eventId ?? body?.id ?? `refund-${endToEndId}`)
      const refundValue = Number(pix?.value ?? pix?.refundValue ?? 0)

      const { data: payment } = await sb
        .from('billing_payments')
        .select('*')
        .eq('end_to_end_id', endToEndId)
        .maybeSingle()

      if (!payment) return jsonResponse({ ok: true, skipped: 'payment not found' })

      const { data: dup } = await sb
        .from('billing_payments')
        .select('id')
        .eq('refund_woovi_event_key', eventKey)
        .maybeSingle()
      if (dup) return jsonResponse({ ok: true, duplicate: true })

      const quote = getRefundQuote(new Date(payment.paid_at), payment.value_cents)

      await sb
        .from('billing_payments')
        .update({
          status: 'reembolsado',
          refunded_at: new Date().toISOString(),
          refund_value_cents: refundValue || quote.suggested_refund_cents,
          refund_woovi_event_key: eventKey,
          refund_type: quote.refund_type,
          days_used_at_refund: quote.days_used,
          suggested_refund_cents: quote.suggested_refund_cents,
        })
        .eq('id', payment.id)

      await pauseStoreCatalogForBilling(sb, payment.store_id)

      return jsonResponse({ ok: true })
    }

    // Cobrança PIX expirou sem pagamento — loja pode gerar outro PIX em /admin/plano
    if (event === 'OPENPIX:CHARGE_EXPIRED' || event === 'CHARGE_EXPIRED') {
      return jsonResponse({ ok: true, action: 'charge_expired_ignored' })
    }

    // Estorno rejeitado pelo banco — pagamento permanece como estava
    if (
      event === 'PIX_TRANSACTION_REFUND_SENT_REJECTED' ||
      event === 'OPENPIX:PIX_TRANSACTION_REFUND_SENT_REJECTED'
    ) {
      return jsonResponse({ ok: true, action: 'refund_rejected_ignored' })
    }

    // PIX Automático (cobrança recorrente Woovi) — não usado no plano manual; aceita sem efeito
    if (event === 'PIX_AUTOMATIC_COBR_APPROVED' || event === 'OPENPIX:PIX_AUTOMATIC_COBR_APPROVED') {
      return jsonResponse({ ok: true, action: 'pix_automatic_ignored' })
    }

    return jsonResponse({ ok: true, ignored: event })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return jsonResponse({ error: msg }, 500)
  }
})
