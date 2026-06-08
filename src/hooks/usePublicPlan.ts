import { useEffect, useState } from 'react'
import { BILLING_PLAN_VALUE_CENTS, BILLING_TRIAL_DAYS } from '@/lib/billing/constants'
import { fetchPublicBillingPlan, type PublicBillingPlan } from '@/services/billingService'

export function usePublicPlan() {
  const [plan, setPlan] = useState<PublicBillingPlan>({
    plan_value_cents: BILLING_PLAN_VALUE_CENTS,
    trial_days: BILLING_TRIAL_DAYS,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void fetchPublicBillingPlan()
      .then((p) => {
        if (alive) setPlan(p)
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  return { plan, loading }
}

export function formatPlanLabel(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
