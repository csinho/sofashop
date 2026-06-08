import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { evolutionRequest } from './evolution.ts'
import { DEFAULT_PLATFORM_EVENT_TEMPLATES, type NotifySettingItem } from './messageTemplate.ts'
import { phoneToEvolutionNumber } from './templates.ts'

type PlatformInstance = {
  instance_name: string
  instance_token: string
  status: string
  notify_settings: Record<string, NotifySettingItem>
}

function applyPlatformTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`)
}

async function getPlatformInstance(sb: SupabaseClient): Promise<PlatformInstance | null> {
  const { data } = await sb
    .from('platform_whatsapp_instance')
    .select('instance_name, instance_token, status, notify_settings')
    .eq('singleton_key', 'platform')
    .maybeSingle()
  return data as PlatformInstance | null
}

export async function sendPlatformBillingWhatsApp(
  sb: SupabaseClient,
  opts: {
    storeId: string
    storeName: string
    recipientPhone: string
    eventType: string
    extraVars?: Record<string, string>
  },
): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  const inst = await getPlatformInstance(sb)
  if (!inst || inst.status !== 'connected') {
    return { sent: false, skipped: 'WhatsApp da plataforma não conectado' }
  }

  const setting = inst.notify_settings?.[opts.eventType]
  const enabled = Boolean(setting?.enabled)
  const template =
    (setting?.template ?? '').trim() ||
    DEFAULT_PLATFORM_EVENT_TEMPLATES[opts.eventType] ||
    ''
  if (!enabled || !template) {
    return { sent: false, skipped: `Evento ${opts.eventType} desabilitado` }
  }

  const text = applyPlatformTemplate(template, {
    NOME_LOJA: opts.storeName,
    VALOR_PLANO: opts.extraVars?.VALOR_PLANO ?? '',
    DATA_VENCIMENTO: opts.extraVars?.DATA_VENCIMENTO ?? '',
    ...opts.extraVars,
  })

  const number = phoneToEvolutionNumber(opts.recipientPhone)
  const { ok, data } = await evolutionRequest(`/message/sendText/${inst.instance_name}`, {
    method: 'POST',
    apiKey: inst.instance_token,
    body: JSON.stringify({ number, text }),
  })

  const evolutionId =
    typeof data === 'object' && data && 'key' in data
      ? String((data as { key?: { id?: string } }).key?.id ?? '')
      : null

  await sb.from('platform_whatsapp_message_log').insert({
    store_id: opts.storeId,
    event_type: opts.eventType,
    recipient_phone: opts.recipientPhone,
    message_text: text,
    evolution_message_id: evolutionId,
    delivery_status: ok ? 'sent' : 'failed',
    error_message: ok ? null : JSON.stringify(data).slice(0, 500),
  })

  if (!ok) {
    return { sent: false, error: 'Falha ao enviar WhatsApp' }
  }
  return { sent: true }
}

export async function notifyStoresPlanPriceChanged(
  sb: SupabaseClient,
  oldCents: number,
  newCents: number,
) {
  const { data: stores } = await sb
    .from('stores')
    .select('id, trade_name, whatsapp_1, billing_status')
    .in('billing_status', ['trial', 'ativo'])

  const oldLabel = (oldCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const newLabel = (newCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  for (const store of stores ?? []) {
    await sendPlatformBillingWhatsApp(sb, {
      storeId: store.id,
      storeName: store.trade_name,
      recipientPhone: store.whatsapp_1,
      eventType: 'plan_price_changed',
      extraVars: { VALOR_ANTIGO: oldLabel, VALOR_NOVO: newLabel },
    }).catch(() => {})
  }
}
