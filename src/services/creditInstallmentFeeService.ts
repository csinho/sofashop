import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import {
  DEFAULT_CREDIT_INSTALLMENT_RATES,
  type CreditInstallmentRate,
} from '@/lib/creditCardInstallments'
import type { StoreCreditInstallmentFeeRow } from '@/types/database'

export type StoreCreditInstallmentFees = {
  rows: Pick<StoreCreditInstallmentFeeRow, 'id' | 'installments' | 'fee_percent' | 'sort_order'>[]
  rates: CreditInstallmentRate[]
}

export async function fetchStoreCreditInstallmentFees(storeId: string): Promise<StoreCreditInstallmentFees> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('store_credit_installment_fees')
    .select('id, installments, fee_percent, sort_order')
    .eq('store_id', storeId)
    .order('installments', { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as StoreCreditInstallmentFees['rows']
  const rates: CreditInstallmentRate[] =
    rows.length > 0
      ? rows.map((r) => ({ installments: r.installments, fee_percent: Number(r.fee_percent) }))
      : [...DEFAULT_CREDIT_INSTALLMENT_RATES]

  return { rows, rates }
}

export async function replaceStoreCreditInstallmentFees(
  storeId: string,
  rates: CreditInstallmentRate[],
): Promise<void> {
  const sb = getSupabaseBrowserClient()
  const normalized = rates.map((r, i) => ({
    store_id: storeId,
    installments: Math.max(1, Math.round(r.installments)),
    fee_percent: Number(r.fee_percent) || 0,
    sort_order: i + 1,
  }))

  const keys = new Set(normalized.map((r) => r.installments))
  if (keys.size !== normalized.length) {
    throw new Error('Cada quantidade de parcelas deve ser única.')
  }
  if (normalized.length === 0) {
    throw new Error('Cadastre ao menos uma parcela com taxa.')
  }

  const { error: delErr } = await sb.from('store_credit_installment_fees').delete().eq('store_id', storeId)
  if (delErr) throw delErr

  const { error: insErr } = await sb.from('store_credit_installment_fees').insert(normalized)
  if (insErr) throw insErr
}

export async function restoreStoreCreditInstallmentDefaults(storeId: string): Promise<void> {
  const sb = getSupabaseBrowserClient()
  const { error: delErr } = await sb.from('store_credit_installment_fees').delete().eq('store_id', storeId)
  if (delErr) throw delErr
  const { error } = await sb.rpc('seed_store_credit_installment_fees', { p_store_id: storeId })
  if (error) throw error
}
