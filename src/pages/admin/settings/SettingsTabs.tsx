import { cn } from '@/lib/cn'

export type SettingsTabId = 'identity' | 'contact' | 'address' | 'catalog' | 'whatsapp'

const TABS: { id: SettingsTabId; label: string }[] = [
  { id: 'identity', label: 'Identidade' },
  { id: 'contact', label: 'Contato' },
  { id: 'address', label: 'Endereço' },
  { id: 'catalog', label: 'PDF e catálogo' },
  { id: 'whatsapp', label: 'WhatsApp' },
]

type Props = {
  active: SettingsTabId
  onChange: (id: SettingsTabId) => void
}

export function SettingsTabs({ active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-ink-200 bg-white p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition',
            active === tab.id
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-ink-600 hover:bg-ink-50',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
