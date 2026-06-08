import { corsHeaders, jsonResponse, optionsResponse } from '../_shared/cors.ts'
import { getPlanValueCentsForCharge } from '../_shared/billingLogic.ts'
import { notifyStoresPlanPriceChanged } from '../_shared/billingNotify.ts'
import { createWooviPlanCharge, fetchWooviReceiptPdf } from '../_shared/woovi.ts'
import {
  getServiceClient,
  getUserClient,
  isErrorResponse,
  requirePlatformAdmin,
  requireStoreMember,
} from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = String(body.action ?? '')

    if (action === 'getPlanSettings') {
      const sb = getServiceClient()
      const cents = await getPlanValueCentsForCharge(sb)
      return jsonResponse({ plan_value_cents: cents, trial_days: 7 })
    }

    if (action === 'createPixCharge') {
      const storeId = String(body.storeId ?? '')
      if (!storeId) return jsonResponse({ error: 'storeId obrigatório' }, 400)

      const auth = await requireStoreMember(req, storeId)
      if (isErrorResponse(auth)) {
        return new Response(await auth.text(), {
          status: auth.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const sb = getServiceClient()
      const { data: store } = await sb
        .from('stores')
        .select('id, trade_name, billing_status, next_billing_at, trial_ends_at')
        .eq('id', storeId)
        .maybeSingle()
      if (!store) return jsonResponse({ error: 'Loja não encontrada' }, 404)

      const valueCents = await getPlanValueCentsForCharge(sb)
      const correlationID = `sofashop-${storeId.replace(/-/g, '')}-${Date.now()}`
      const charge = await createWooviPlanCharge({
        correlationID,
        valueCents,
        comment: `Plano SofáShop ${store.trade_name}`.slice(0, 140),
        customerName: store.trade_name,
      })

      return jsonResponse({
        correlationId: charge.correlationId,
        brCode: charge.brCode,
        qrCodeImage: charge.qrCodeImage,
        paymentLinkUrl: charge.paymentLinkUrl,
        valueCents: charge.value,
      })
    }

    if (action === 'listPayments') {
      const storeId = String(body.storeId ?? '')
      if (!storeId) return jsonResponse({ error: 'storeId obrigatório' }, 400)

      const auth = await requireStoreMember(req, storeId)
      if (isErrorResponse(auth)) {
        return new Response(await auth.text(), {
          status: auth.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const sb = getServiceClient()
      const from = body.from ? String(body.from) : null
      const to = body.to ? String(body.to) : null

      let q = sb
        .from('billing_payments')
        .select(
          'id, paid_at, value_cents, correlation_id, end_to_end_id, status, refunded_at, refund_value_cents, suggested_refund_cents',
        )
        .eq('store_id', storeId)
        .order('paid_at', { ascending: false })

      if (from) q = q.gte('paid_at', `${from}T00:00:00Z`)
      if (to) q = q.lte('paid_at', `${to}T23:59:59Z`)

      const { data, error } = await q
      if (error) return jsonResponse({ error: error.message }, 500)
      return jsonResponse({ payments: data ?? [] })
    }

    if (action === 'downloadReceipt') {
      const storeId = String(body.storeId ?? '')
      const endToEndId = String(body.endToEndId ?? '')
      if (!storeId || !endToEndId) return jsonResponse({ error: 'Parâmetros inválidos' }, 400)

      const auth = await requireStoreMember(req, storeId)
      if (isErrorResponse(auth)) {
        return new Response(await auth.text(), {
          status: auth.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const sb = getServiceClient()
      const { data: payment } = await sb
        .from('billing_payments')
        .select('id')
        .eq('store_id', storeId)
        .eq('end_to_end_id', endToEndId)
        .maybeSingle()
      if (!payment) return jsonResponse({ error: 'Pagamento não encontrado' }, 404)

      const pdf = await fetchWooviReceiptPdf(endToEndId)
      return new Response(pdf, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="recibo-${endToEndId}.pdf"`,
        },
      })
    }

    if (action === 'savePlanValue') {
      const auth = await requirePlatformAdmin(req)
      if (isErrorResponse(auth)) {
        return new Response(await auth.text(), {
          status: auth.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401)

      const planValueReais = Number(body.planValueReais)
      if (!Number.isFinite(planValueReais) || planValueReais < 1) {
        return jsonResponse({ error: 'Valor inválido' }, 400)
      }
      const newCents = Math.round(planValueReais * 100)
      const sb = getServiceClient()
      const oldCents = await getPlanValueCentsForCharge(sb)

      const { data, error } = await getUserClient(authHeader).rpc('set_platform_billing_plan', {
        p_cents: newCents,
      })
      if (error) return jsonResponse({ error: error.message }, 500)

      if (oldCents !== newCents) {
        await notifyStoresPlanPriceChanged(sb, oldCents, newCents).catch(() => {})
      }

      const label = (newCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      return jsonResponse({ ok: true, plan_value_cents: newCents, planLabel: `${label}/mês`, rpc: data })
    }

    if (action === 'getPlatformSettings') {
      const auth = await requirePlatformAdmin(req)
      if (isErrorResponse(auth)) {
        return new Response(await auth.text(), {
          status: auth.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const sb = getServiceClient()
      const cents = await getPlanValueCentsForCharge(sb)
      return jsonResponse({ plan_value_cents: cents })
    }

    if (action === 'platformDashboard') {
      const auth = await requirePlatformAdmin(req)
      if (isErrorResponse(auth)) {
        return new Response(await auth.text(), {
          status: auth.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401)

      const from = String(body.from ?? '')
      const to = String(body.to ?? '')
      if (!from || !to) return jsonResponse({ error: 'from e to obrigatórios' }, 400)

      const { data, error } = await getUserClient(authHeader).rpc('platform_billing_dashboard', {
        p_from: from,
        p_to: to,
      })
      if (error) return jsonResponse({ error: error.message }, 500)
      return jsonResponse(data)
    }

    if (action === 'platformStorePayments') {
      const auth = await requirePlatformAdmin(req)
      if (isErrorResponse(auth)) {
        return new Response(await auth.text(), {
          status: auth.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401)

      const storeId = String(body.storeId ?? '')
      if (!storeId) return jsonResponse({ error: 'storeId obrigatório' }, 400)

      const { data, error } = await getUserClient(authHeader).rpc('platform_list_billing_payments', {
        p_store_id: storeId,
      })
      if (error) return jsonResponse({ error: error.message }, 500)
      return jsonResponse({ payments: data ?? [] })
    }

    if (action === 'notifyStoreRegistered') {
      const storeId = String(body.storeId ?? '')
      if (!storeId) return jsonResponse({ error: 'storeId obrigatório' }, 400)

      const sb = getServiceClient()
      const { data: store } = await sb
        .from('stores')
        .select('id, trade_name, whatsapp_1')
        .eq('id', storeId)
        .maybeSingle()
      if (!store) return jsonResponse({ error: 'Loja não encontrada' }, 404)

      const { sendPlatformBillingWhatsApp } = await import('../_shared/billingNotify.ts')
      const result = await sendPlatformBillingWhatsApp(sb, {
        storeId: store.id,
        storeName: store.trade_name,
        recipientPhone: store.whatsapp_1,
        eventType: 'store_registered',
      })
      return jsonResponse(result)
    }

    return jsonResponse({ error: 'Ação desconhecida' }, 400)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return jsonResponse({ error: msg }, 500)
  }
})
