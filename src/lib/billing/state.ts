import { BILLING_PIX_WINDOW_DAYS, type BillingStatus } from '@/lib/billing/constants'
import { daysUntil } from '@/lib/billing/dates'

export type StoreBillingSnapshot = {
  billing_status: BillingStatus
  next_billing_at: string | null
  trial_ends_at: string | null
  plan_value_cents: number
}

export function dueDateForBilling(b: StoreBillingSnapshot): string | null {
  if (b.billing_status === 'trial') return b.trial_ends_at
  return b.next_billing_at
}

export function canShowPixButton(b: StoreBillingSnapshot): boolean {
  if (b.billing_status === 'pendente' || b.billing_status === 'inadimplente') return true
  if (b.billing_status === 'trial') return true
  if (b.billing_status === 'ativo') {
    const days = daysUntil(b.next_billing_at)
    if (days === null) return true
    return days <= BILLING_PIX_WINDOW_DAYS
  }
  return false
}

export function billingBannerMessage(b: StoreBillingSnapshot): string | null {
  const due = dueDateForBilling(b)
  const days = daysUntil(due)
  if (b.billing_status === 'trial' && days !== null && days >= 0) {
    return `Período de teste: faltam ${days} dia(s) para o fim do trial.`
  }
  if (b.billing_status === 'pendente' || b.billing_status === 'inadimplente') {
    return 'Seu plano está pendente. O catálogo pode estar indisponível até a confirmação do pagamento PIX.'
  }
  if (b.billing_status === 'ativo' && days !== null && days <= BILLING_PIX_WINDOW_DAYS && days >= 0) {
    return `Seu plano vence em ${days} dia(s). Gere o PIX para renovar.`
  }
  return null
}

export function billingBannerVariant(
  status: BillingStatus,
): 'info' | 'warning' | 'danger' {
  if (status === 'pendente' || status === 'inadimplente') return 'danger'
  if (status === 'trial') return 'info'
  return 'warning'
}
