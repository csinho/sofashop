import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { readEdgeFunctionError } from '@/services/whatsappInvokeError'
import type { BillingStatus } from '@/lib/billing/constants'

function parseJsonValue<T>(data: unknown): T | null {
  if (data == null) return null
  if (typeof data === 'string') {
    const trimmed = data.trim()
    if (!trimmed) return null
    try {
      return JSON.parse(trimmed) as T
    } catch {
      return null
    }
  }
  return data as T
}

function parseBillingPaymentsList(data: unknown): BillingPaymentRow[] {
  const parsed = parseJsonValue<unknown>(data)
  if (parsed == null) return []
  const arr = Array.isArray(parsed) ? parsed : []
  return arr as BillingPaymentRow[]
}

function parseStoreBillingSafe(data: unknown): StoreBillingSafe | null {
  const parsed = parseJsonValue<Record<string, unknown>>(data)
  if (parsed == null || typeof parsed !== 'object') return null

  const status = parsed.billing_status
  const billingStatus: BillingStatus =
    status === 'trial' || status === 'ativo' || status === 'pendente' || status === 'inadimplente'
      ? status
      : 'trial'

  const planCents = Number(parsed.plan_value_cents)
  return {
    store_id: String(parsed.store_id ?? ''),
    billing_status: billingStatus,
    trial_ends_at: parsed.trial_ends_at ? String(parsed.trial_ends_at) : null,
    next_billing_at: parsed.next_billing_at ? String(parsed.next_billing_at) : null,
    billing_period_ends_at: parsed.billing_period_ends_at ? String(parsed.billing_period_ends_at) : null,
    last_payment_at: parsed.last_payment_at ? String(parsed.last_payment_at) : null,
    catalog_paused_by_billing: Boolean(parsed.catalog_paused_by_billing),
    plan_value_cents: Number.isFinite(planCents) && planCents > 0 ? planCents : 3990,
  }
}

export type StoreBillingSafe = {
  store_id: string
  billing_status: BillingStatus
  trial_ends_at: string | null
  next_billing_at: string | null
  billing_period_ends_at: string | null
  last_payment_at: string | null
  catalog_paused_by_billing: boolean
  plan_value_cents: number
}

export type BillingPaymentRow = {
  id: string
  paid_at: string
  value_cents: number
  correlation_id: string | null
  end_to_end_id: string | null
  status: 'pago' | 'reembolsado'
  refunded_at?: string | null
  refund_value_cents?: number | null
  suggested_refund_cents?: number | null
  refund_type?: string | null
  days_used_at_refund?: number | null
}

export type PixChargeResult = {
  correlationId: string
  brCode: string | null
  qrCodeImage: string | null
  paymentLinkUrl: string | null
  valueCents: number
}

export type PublicBillingPlan = {
  plan_value_cents: number
  trial_days: number
}

export type PlatformBillingDashboard = {
  revenue_cents: number
  active_count: number
  trial_count: number
  pending_count: number
  overdue_count: number
  plan_value_cents: number
}

async function invokeBilling<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.functions.invoke('billing', { body })
  if (error) throw new Error(await readEdgeFunctionError(error))
  const payload = data as { error?: string } & T
  if (payload?.error) throw new Error(payload.error)
  return payload as T
}

export async function fetchPublicBillingPlan(): Promise<PublicBillingPlan> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.rpc('get_public_billing_plan')
  if (error) throw new Error(error.message)
  return data as PublicBillingPlan
}

export async function fetchStoreBilling(storeId: string): Promise<StoreBillingSafe> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.rpc('get_store_billing_safe', { p_store_id: storeId })
  if (error) throw new Error(error.message)
  const billing = parseStoreBillingSafe(data)
  if (!billing) throw new Error('Resposta inválida ao carregar o plano da loja.')
  return billing
}

export async function listStoreBillingPayments(
  storeId: string,
  from?: string,
  to?: string,
): Promise<BillingPaymentRow[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.rpc('list_store_billing_payments', {
    p_store_id: storeId,
    p_from: from ?? null,
    p_to: to ?? null,
  })
  if (error) throw new Error(error.message)
  return parseBillingPaymentsList(data)
}

export async function createPixCharge(storeId: string) {
  return invokeBilling<PixChargeResult>({ action: 'createPixCharge', storeId })
}

export async function fetchPlatformBillingSettings(): Promise<{ plan_value_cents: number }> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.rpc('get_platform_billing_settings')
  if (error) throw new Error(error.message)
  return data as { plan_value_cents: number }
}

export function savePlatformBillingPlan(planValueReais: number) {
  return invokeBilling<{ ok: boolean; plan_value_cents: number; planLabel: string }>({
    action: 'savePlanValue',
    planValueReais,
  })
}

export function fetchPlatformBillingDashboard(from: string, to: string) {
  return invokeBilling<PlatformBillingDashboard>({ action: 'platformDashboard', from, to })
}

export function fetchPlatformStorePayments(storeId: string) {
  return invokeBilling<{ payments: BillingPaymentRow[] }>({
    action: 'platformStorePayments',
    storeId,
  })
}

export function notifyStoreRegistered(storeId: string) {
  return invokeBilling<{ sent: boolean }>({ action: 'notifyStoreRegistered', storeId })
}
