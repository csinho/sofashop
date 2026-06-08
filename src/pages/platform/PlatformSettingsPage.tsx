import { useEffect } from 'react'
import { PlatformWhatsAppSettingsTab } from '@/pages/platform/settings/PlatformWhatsAppSettingsTab'
import { getPwaBrandName } from '@/lib/documentTitle'

export function PlatformSettingsPage() {
  useEffect(() => {
    document.title = `${getPwaBrandName()} — Configurações da plataforma`
  }, [])

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Configurações</h1>
        <p className="mt-1 text-sm text-ink-500">Integrações e preferências do administrador da plataforma.</p>
      </div>
      <PlatformWhatsAppSettingsTab />
    </div>
  )
}
