import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { notifyErr, notifyOk } from '@/lib/notify'
import { fetchPlatformBillingSettings, savePlatformBillingPlan } from '@/services/billingService'

function centsToReaisInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function reaisInputToCents(raw: string): number | null {
  const normalized = raw.replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 1) return null
  return Math.round(n * 100)
}

export function PlatformBillingSettingsTab() {
  const [value, setValue] = useState('39,90')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    void fetchPlatformBillingSettings()
      .then((s) => {
        if (alive) setValue(centsToReaisInput(s.plan_value_cents))
      })
      .catch((e) => notifyErr(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const cents = reaisInputToCents(value)
    if (cents === null) {
      notifyErr('Informe um valor válido (ex.: 49,90)')
      return
    }
    setSaving(true)
    try {
      const result = await savePlatformBillingPlan(cents / 100)
      notifyOk(`Plano salvo: ${result.planLabel}`)
    } catch (err) {
      notifyErr(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-ink-900">Valor do plano</h2>
      <p className="mt-1 text-sm text-ink-500">
        Define o valor mensal cobrado das lojas via PIX. Pagamentos já confirmados não são alterados — o novo valor vale
        na próxima cobrança.
      </p>
      <form onSubmit={(e) => void handleSave(e)} className="mt-6 max-w-sm space-y-4">
        <div>
          <label className="text-sm font-medium text-ink-700">Valor do plano (R$/mês)</label>
          <Input
            className="mt-1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="39,90"
            disabled={loading || saving}
          />
        </div>
        <Button type="submit" disabled={loading || saving}>
          {saving ? 'Salvando…' : 'Salvar plano'}
        </Button>
      </form>
    </Card>
  )
}
