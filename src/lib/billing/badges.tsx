import type { BillingStatus } from '@/lib/billing/constants'
import { BILLING_STATUS_LABELS } from '@/lib/billing/constants'
import { cn } from '@/lib/cn'

export function billingStatusLabel(status: BillingStatus | string | undefined): string {
  if (!status) return '—'
  return BILLING_STATUS_LABELS[status as BillingStatus] ?? status
}

export function billingStatusBadgeClass(status: BillingStatus | string | undefined): string {
  switch (status) {
    case 'ativo':
      return 'bg-emerald-100 text-emerald-800'
    case 'trial':
      return 'bg-sky-100 text-sky-800'
    case 'pendente':
      return 'bg-amber-100 text-amber-900'
    case 'inadimplente':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-ink-100 text-ink-600'
  }
}

export function BillingStatusBadge({
  status,
  className,
}: {
  status: BillingStatus | string | undefined
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
        billingStatusBadgeClass(status),
        className,
      )}
    >
      {billingStatusLabel(status)}
    </span>
  )
}
