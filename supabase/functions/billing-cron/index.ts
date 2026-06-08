import { corsHeaders, jsonResponse, optionsResponse } from '../_shared/cors.ts'
import {
  daysUntilDateBrt,
  formatDateBrt,
  getPlanValueCentsForCharge,
  pauseStoreCatalogForBilling,
  todayDateBrt,
} from '../_shared/billingLogic.ts'
import { sendPlatformBillingWhatsApp } from '../_shared/billingNotify.ts'
import { getServiceClient } from '../_shared/supabase.ts'

const REMINDER_DAYS = [
  { days: 5, event: 'payment_due_5d' },
  { days: 3, event: 'payment_due_3d' },
  { days: 1, event: 'payment_due_1d' },
] as const

function cronSecret(): string | null {
  return (Deno.env.get('BILLING_CRON_SECRET') ?? Deno.env.get('BILLING_CRON_SEC'))?.trim() || null
}

function serviceRoleKey(): string | null {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() || null
}

function bearerToken(req: Request): string {
  const auth = req.headers.get('Authorization') ?? ''
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim()
  return auth.trim()
}

function matchesSecret(req: Request, secret: string): boolean {
  const url = new URL(req.url)
  const querySecret = url.searchParams.get('secret')?.trim()
  if (querySecret && querySecret === secret) return true

  const token = bearerToken(req)
  return token === secret
}

function validateCronAuthSync(req: Request): boolean {
  const secret = cronSecret()
  if (secret && matchesSecret(req, secret)) return true

  const serviceRole = serviceRoleKey()
  if (serviceRole && matchesSecret(req, serviceRole)) return true

  const apikey = req.headers.get('apikey')?.trim()
  if (serviceRole && apikey === serviceRole) return true

  return false
}

async function validateCronAuthInternal(
  req: Request,
  sb: ReturnType<typeof getServiceClient>,
): Promise<boolean> {
  const { data } = await sb
    .from('system_settings')
    .select('value')
    .eq('key', 'billing_cron_internal')
    .maybeSingle()

  const token = (data?.value as { token?: string } | null)?.token?.trim()
  if (!token) return false

  return matchesSecret(req, token)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  const sb = getServiceClient()
  if (!validateCronAuthSync(req) && !(await validateCronAuthInternal(req, sb))) {
    return jsonResponse({ error: 'Não autorizado' }, 401)
  }

  try {
    const today = todayDateBrt()
    const planCents = await getPlanValueCentsForCharge(sb)
    const planLabel = (planCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    const { data: stores } = await sb
      .from('stores')
      .select(
        'id, trade_name, whatsapp_1, billing_status, trial_ends_at, next_billing_at, catalog_published',
      )
      .in('billing_status', ['trial', 'ativo', 'pendente'])

    let remindersSent = 0
    let expired = 0
    let inadimplente = 0

    for (const store of stores ?? []) {
      const dueIso =
        store.billing_status === 'trial' ? store.trial_ends_at : store.next_billing_at
      if (!dueIso) continue

      const daysLeft = daysUntilDateBrt(dueIso)

      for (const r of REMINDER_DAYS) {
        if (daysLeft !== r.days) continue
        if (!['trial', 'ativo'].includes(store.billing_status)) continue

        const dueDate = new Date(dueIso).toLocaleDateString('en-CA', {
          timeZone: 'America/Sao_Paulo',
        })

        const { error: logErr } = await sb.from('billing_reminder_log').insert({
          store_id: store.id,
          event_type: r.event,
          due_date: dueDate,
        })
        if (logErr) continue

        await sendPlatformBillingWhatsApp(sb, {
          storeId: store.id,
          storeName: store.trade_name,
          recipientPhone: store.whatsapp_1,
          eventType: r.event,
          extraVars: {
            DATA_VENCIMENTO: formatDateBrt(dueIso),
            VALOR_PLANO: planLabel,
          },
        })
        remindersSent++
      }

      if (daysLeft < 0 && ['trial', 'ativo'].includes(store.billing_status)) {
        await pauseStoreCatalogForBilling(sb, store.id)
        expired++
      }

      if (store.billing_status === 'pendente' && daysLeft <= -3) {
        await sb.from('stores').update({ billing_status: 'inadimplente' }).eq('id', store.id)
        inadimplente++
      }
    }

    return jsonResponse({
      ok: true,
      date: today,
      remindersSent,
      expired,
      inadimplente,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return jsonResponse({ error: msg }, 500)
  }
})
