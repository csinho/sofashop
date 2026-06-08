import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'
import { BILLING_CYCLE_DAYS, BILLING_PLAN_VALUE_CENTS } from './billingConstants.ts'

export function sanitizeAsciiComment(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .slice(0, 140)
    .trim()
}

export async function getPlanValueCentsForCharge(sb: SupabaseClient): Promise<number> {
  const { data } = await sb.from('system_settings').select('value').eq('key', 'billing').maybeSingle()
  const cents = (data?.value as { plan_value_cents?: number } | null)?.plan_value_cents
  if (typeof cents === 'number' && cents >= 100) return cents
  return BILLING_PLAN_VALUE_CENTS
}

/** Próximo vencimento após pagamento: +30d + crédito se pagou antes do vencimento. */
export function nextBillingAfterPayment(paidAt: Date, dueAt: Date | null): Date {
  const base = new Date(paidAt)
  base.setUTCDate(base.getUTCDate() + BILLING_CYCLE_DAYS)
  if (dueAt && paidAt < dueAt) {
    const creditMs = dueAt.getTime() - paidAt.getTime()
    return new Date(base.getTime() + creditMs)
  }
  return base
}

export type RefundQuote = {
  refund_type: 'integral' | 'parcial' | 'none'
  suggested_refund_cents: number
  days_used: number
}

/** Política: até 10º dia integral; depois pro-rata dias restantes. */
export function getRefundQuote(paidAt: Date, valueCents: number, now = new Date()): RefundQuote {
  const msPerDay = 1000 * 60 * 60 * 24
  const daysUsed = Math.floor((now.getTime() - paidAt.getTime()) / msPerDay) + 1
  if (daysUsed <= 10) {
    return { refund_type: 'integral', suggested_refund_cents: valueCents, days_used: daysUsed }
  }
  const daysRemaining = Math.max(0, BILLING_CYCLE_DAYS - daysUsed)
  const partial = Math.round((valueCents * daysRemaining) / BILLING_CYCLE_DAYS)
  if (partial <= 0) {
    return { refund_type: 'none', suggested_refund_cents: 0, days_used: daysUsed }
  }
  return { refund_type: 'parcial', suggested_refund_cents: partial, days_used: daysUsed }
}

export function formatDateBrt(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export async function pauseStoreCatalogForBilling(sb: SupabaseClient, storeId: string) {
  const { data: store } = await sb
    .from('stores')
    .select('catalog_published')
    .eq('id', storeId)
    .maybeSingle()
  if (!store) return
  await sb
    .from('stores')
    .update({
      billing_status: 'pendente',
      catalog_paused_by_billing: true,
      catalog_published: false,
    })
    .eq('id', storeId)
}

export async function resumeStoreCatalogAfterBilling(sb: SupabaseClient, storeId: string) {
  const { data: store } = await sb
    .from('stores')
    .select('catalog_paused_by_billing')
    .eq('id', storeId)
    .maybeSingle()
  if (!store?.catalog_paused_by_billing) {
    await sb.from('stores').update({ billing_status: 'ativo' }).eq('id', storeId)
    return
  }
  await sb
    .from('stores')
    .update({
      billing_status: 'ativo',
      catalog_paused_by_billing: false,
      catalog_published: true,
    })
    .eq('id', storeId)
}

export function daysUntilDateBrt(targetIso: string, now = new Date()): number {
  const tz = 'America/Sao_Paulo'
  const targetDate = new Date(targetIso).toLocaleDateString('en-CA', { timeZone: tz })
  const nowDate = now.toLocaleDateString('en-CA', { timeZone: tz })
  const t = new Date(`${targetDate}T12:00:00Z`).getTime()
  const n = new Date(`${nowDate}T12:00:00Z`).getTime()
  return Math.round((t - n) / (1000 * 60 * 60 * 24))
}

export function todayDateBrt(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}
