import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { MoneyField } from '@/components/ui/MoneyField'
import { Select } from '@/components/ui/Select'
import { normalizeCityKey } from '@/lib/deliveryFee'
import { formatCurrency } from '@/lib/format'
import { maskMoneyBRL, parseMoneyBRL } from '@/lib/moneyInput'
import { notifyErr, notifyOk } from '@/lib/notify'
import {
  addStoreDeliveryCity,
  fetchStoreDeliveryRates,
  removeStoreDeliveryCity,
  restoreStoreDeliveryDefaults,
  saveStoreDeliveryDefaultFee,
  updateDeliveryFeeForAllCitiesWithFee,
  updateStoreDeliveryCityFee,
  type StoreDeliveryRates,
} from '@/services/deliveryFeeService'

const TIER_PRESETS = [30, 50, 80, 100] as const

type Props = {
  storeId: string
}

export function DeliveryFeeSettingsTab({ storeId }: Props) {
  const [rates, setRates] = useState<StoreDeliveryRates | null>(null)
  const [loading, setLoading] = useState(true)
  const [defaultFeeMasked, setDefaultFeeMasked] = useState('100,00')
  const [savingDefault, setSavingDefault] = useState(false)
  const [newCityName, setNewCityName] = useState('')
  const [newCityTier, setNewCityTier] = useState<string>('50')
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [tierEdits, setTierEdits] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchStoreDeliveryRates(storeId)
      setRates(data)
      setDefaultFeeMasked(maskMoneyBRL(String(Math.round(data.defaultFee * 100))))
      const tiers: Record<string, string> = {}
      for (const fee of new Set(data.cities.map((c) => Number(c.fee)))) {
        tiers[String(fee)] = maskMoneyBRL(String(Math.round(fee * 100)))
      }
      setTierEdits(tiers)
    } catch (e: unknown) {
      notifyErr(e instanceof Error ? e.message : 'Erro ao carregar taxas de entrega.')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    void load()
  }, [load])

  const feeGroups = useMemo(() => {
    if (!rates) return []
    const map = new Map<number, typeof rates.cities>()
    for (const c of rates.cities) {
      const f = Number(c.fee)
      const list = map.get(f) ?? []
      list.push(c)
      map.set(f, list)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [rates])

  async function onSaveDefault() {
    setSavingDefault(true)
    try {
      const fee = parseMoneyBRL(defaultFeeMasked)
      await saveStoreDeliveryDefaultFee(storeId, fee)
      notifyOk('Taxa padrão salva.')
      await load()
    } catch (e: unknown) {
      notifyErr(e instanceof Error ? e.message : 'Erro ao salvar taxa padrão.')
    } finally {
      setSavingDefault(false)
    }
  }

  async function onApplyTier(fee: number) {
    const masked = tierEdits[String(fee)]
    if (!masked) return
    const next = parseMoneyBRL(masked)
    if (next === fee) return
    try {
      await updateDeliveryFeeForAllCitiesWithFee(storeId, fee, next)
      notifyOk(`Taxa atualizada para ${feeGroups.find(([f]) => f === fee)?.[1].length ?? 0} cidade(s).`)
      await load()
    } catch (e: unknown) {
      notifyErr(e instanceof Error ? e.message : 'Erro ao atualizar faixa.')
    }
  }

  async function onAddCity() {
    const name = newCityName.trim()
    if (!name) {
      notifyErr('Informe o nome da cidade.')
      return
    }
    const key = normalizeCityKey(name)
    if (!key) {
      notifyErr('Nome de cidade inválido.')
      return
    }
    const fee = Number(newCityTier)
    try {
      await addStoreDeliveryCity(storeId, name, key, fee)
      notifyOk('Cidade adicionada.')
      setNewCityName('')
      await load()
    } catch (e: unknown) {
      notifyErr(e instanceof Error ? e.message : 'Erro ao adicionar cidade (verifique se já existe).')
    }
  }

  async function onRemoveCity(id: string) {
    try {
      await removeStoreDeliveryCity(id)
      notifyOk('Cidade removida.')
      await load()
    } catch (e: unknown) {
      notifyErr(e instanceof Error ? e.message : 'Erro ao remover cidade.')
    }
  }

  async function onRestore() {
    setRestoring(true)
    try {
      await restoreStoreDeliveryDefaults(storeId)
      notifyOk('Tabela padrão da Bahia restaurada.')
      setRestoreOpen(false)
      await load()
    } catch (e: unknown) {
      notifyErr(e instanceof Error ? e.message : 'Erro ao restaurar tabela.')
    } finally {
      setRestoring(false)
    }
  }

  if (loading && !rates) {
    return <p className="text-sm text-ink-500">Carregando taxas de entrega…</p>
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-ink-900">Taxa padrão</h3>
        <p className="text-sm text-ink-600">
          Aplicada quando a cidade do cliente não estiver na lista abaixo.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1">
            <label className="text-xs font-medium text-ink-600">Valor (R$)</label>
            <MoneyField className="mt-1" value={defaultFeeMasked} onValueChange={(m) => setDefaultFeeMasked(m)} />
          </div>
          <Button
            type="button"
            variant="secondary"
            loading={savingDefault}
            tooltip="Salvar a taxa usada para cidades não cadastradas."
            onClick={() => void onSaveDefault()}
          >
            Salvar padrão
          </Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink-900">Faixas por região</h3>
            <p className="mt-1 text-sm text-ink-600">
              Altere o valor de uma faixa para atualizar todas as cidades com o mesmo valor atual.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="text-sm"
            tooltip="Recarregar a tabela inicial da Bahia (Salvador, RMS, etc.)."
            onClick={() => setRestoreOpen(true)}
          >
            Restaurar tabela padrão BA
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {feeGroups.map(([fee, cities]) => (
            <div key={fee} className="rounded-xl border border-ink-200 bg-ink-50/50 p-3">
              <p className="text-xs font-medium text-ink-500">
                {cities.length} cidade{cities.length === 1 ? '' : 's'} · hoje {formatCurrency(fee)}
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div className="min-w-[8rem] flex-1">
                  <label className="text-xs text-ink-600">Novo valor da faixa</label>
                  <MoneyField
                    className="mt-1"
                    value={tierEdits[String(fee)] ?? maskMoneyBRL(String(Math.round(fee * 100)))}
                    onValueChange={(m) => setTierEdits((prev) => ({ ...prev, [String(fee)]: m }))}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  tooltip={`Atualizar todas as cidades que custam ${formatCurrency(fee)} hoje.`}
                  onClick={() => void onApplyTier(fee)}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-ink-900">Adicionar cidade</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-ink-600">Nome da cidade</label>
            <Input className="mt-1" value={newCityName} onChange={(e) => setNewCityName(e.target.value)} />
            {newCityName.trim() ? (
              <p className="mt-1 text-xs text-ink-500">Chave: {normalizeCityKey(newCityName) || '—'}</p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Taxa (faixa)</label>
            <Select className="mt-1" value={newCityTier} onChange={(e) => setNewCityTier(e.target.value)}>
              {TIER_PRESETS.map((t) => (
                <option key={t} value={String(t)}>
                  {formatCurrency(t)}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button type="button" tooltip="Incluir cidade na tabela de frete." onClick={() => void onAddCity()}>
          Adicionar cidade
        </Button>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-ink-900">Cidades cadastradas</h3>
        <div className="max-h-[28rem] space-y-2 overflow-y-auto">
          {rates?.cities.map((c) => (
            <CityRow
              key={c.id}
              city={c}
              onSaveFee={async (fee) => {
                await updateStoreDeliveryCityFee(c.id, fee)
                await load()
              }}
              onRemove={() => void onRemoveCity(c.id)}
            />
          ))}
        </div>
      </Card>

      <ConfirmDialog
        open={restoreOpen}
        title="Restaurar tabela padrão?"
        description="Todas as cidades atuais serão substituídas pela lista padrão da Bahia. A taxa padrão (cidade não cadastrada) não é alterada."
        confirmLabel="Restaurar"
        confirmVariant="danger"
        busy={restoring}
        onClose={() => setRestoreOpen(false)}
        onConfirm={() => void onRestore()}
      />
    </div>
  )
}

function CityRow({
  city,
  onSaveFee,
  onRemove,
}: {
  city: StoreDeliveryRates['cities'][number]
  onSaveFee: (fee: number) => Promise<void>
  onRemove: () => void
}) {
  const [feeMasked, setFeeMasked] = useState(() => maskMoneyBRL(String(Math.round(Number(city.fee) * 100))))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFeeMasked(maskMoneyBRL(String(Math.round(Number(city.fee) * 100))))
  }, [city.fee])

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ink-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900">{city.display_name}</p>
        <p className="text-xs text-ink-500">{city.city_key}</p>
      </div>
      <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
      <div className="min-w-[11.5rem] flex-1 sm:w-48 sm:flex-none">
        <MoneyField
          className="pr-11 text-base tabular-nums"
          value={feeMasked}
          onValueChange={(m) => setFeeMasked(m)}
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        className="text-xs"
        loading={saving}
        tooltip="Salvar o valor de frete desta cidade."
        onClick={() => {
          setSaving(true)
          void onSaveFee(parseMoneyBRL(feeMasked)).finally(() => setSaving(false))
        }}
      >
        Salvar
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="text-xs text-red-600"
        tooltip="Remover esta cidade da tabela."
        onClick={onRemove}
      >
        Remover
      </Button>
      </div>
    </div>
  )
}
