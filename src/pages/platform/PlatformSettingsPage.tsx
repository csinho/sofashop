import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { PlatformBillingSettingsTab } from '@/pages/platform/settings/PlatformBillingSettingsTab'
import { PlatformWhatsAppSettingsTab } from '@/pages/platform/settings/PlatformWhatsAppSettingsTab'
import { getPwaBrandName } from '@/lib/documentTitle'

type SettingsTab = 'whatsapp' | 'billing'

export function PlatformSettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('whatsapp')

  useEffect(() => {
    document.title = `${getPwaBrandName()} — Configurações da plataforma`
  }, [])

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Configurações</h1>
        <p className="mt-1 text-sm text-ink-500">Integrações, plano e preferências do administrador da plataforma.</p>
      </div>

      <div className="flex gap-2 border-b border-ink-200">
        {(
          [
            { id: 'whatsapp' as const, label: 'WhatsApp' },
            { id: 'billing' as const, label: 'Plano e cobrança' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition',
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-500 hover:text-ink-800',
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'whatsapp' ? <PlatformWhatsAppSettingsTab /> : <PlatformBillingSettingsTab />}
    </div>
  )
}
