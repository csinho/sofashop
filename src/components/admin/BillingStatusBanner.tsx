import { Link } from 'react-router-dom'
import { AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  billingBannerMessage,
  billingBannerVariant,
  type StoreBillingSnapshot,
} from '@/lib/billing/state'

export function BillingStatusBanner({ billing }: { billing: StoreBillingSnapshot }) {
  const message = billingBannerMessage(billing)
  if (!message) return null

  const variant = billingBannerVariant(billing.billing_status)
  const styles =
    variant === 'danger'
      ? 'border-red-200 bg-red-50 text-red-900'
      : variant === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-sky-200 bg-sky-50 text-sky-900'

  const Icon = variant === 'info' ? Info : AlertTriangle

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm', styles)}>
      <div className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{message}</p>
      </div>
      <Link to="/admin/plano" className="shrink-0 font-semibold underline underline-offset-2">
        Ver plano
      </Link>
    </div>
  )
}
