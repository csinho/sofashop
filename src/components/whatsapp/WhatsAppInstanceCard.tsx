import { Pause, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { formatBrazilPhoneDisplay } from '@/lib/phoneBr'
import type { WhatsAppInstanceSafe } from '@/services/whatsappAdminService'

type InstanceCardData = Pick<
  WhatsAppInstanceSafe,
  'status' | 'profile_name' | 'profile_picture_url' | 'owner_number'
>

type Props = {
  instance: InstanceCardData
  onPause: () => void | Promise<void>
  onResume: () => void | Promise<void>
  onDelete: () => void | Promise<void>
  pausing?: boolean
  deleting?: boolean
}

function statusBadge(status: InstanceCardData['status']) {
  if (status === 'connected') return { label: 'Conectado', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
  if (status === 'paused') return { label: 'Pausado', className: 'bg-amber-50 text-amber-800 border-amber-200' }
  if (status === 'connecting') return { label: 'Conectando…', className: 'bg-sky-50 text-sky-800 border-sky-200' }
  return { label: 'Desconectado', className: 'bg-ink-50 text-ink-600 border-ink-200' }
}

export function WhatsAppInstanceCard({ instance, onPause, onResume, onDelete, pausing, deleting }: Props) {
  const badge = statusBadge(instance.status)
  const displayName = instance.profile_name?.trim() || 'WhatsApp conectado'
  const phone = instance.owner_number ? formatBrazilPhoneDisplay(instance.owner_number) : null

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-4">
        {instance.profile_picture_url ? (
          <img
            src={instance.profile_picture_url}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-ink-100"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl font-semibold text-brand-700 ring-2 ring-brand-100">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold text-ink-900">{displayName}</p>
          {phone ? <p className="mt-0.5 text-sm text-ink-600">{phone}</p> : null}
        </div>
        <span
          className={cn(
            'hidden shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium sm:inline-flex',
            badge.className,
          )}
        >
          {badge.label}
        </span>
      </div>

      <div className="flex flex-col gap-3 border-t border-ink-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className={cn('inline-flex w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium sm:hidden', badge.className)}>
          {badge.label}
        </span>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {instance.status === 'paused' ? (
            <Button type="button" variant="secondary" onClick={() => void onResume()}>
              <Play className="mr-1.5 inline h-4 w-4" />
              Retomar
            </Button>
          ) : instance.status === 'connected' ? (
            <Button type="button" variant="secondary" loading={pausing} onClick={() => void onPause()}>
              <Pause className="mr-1.5 inline h-4 w-4" />
              Pausar
            </Button>
          ) : null}
          <Button type="button" variant="danger" loading={deleting} onClick={() => void onDelete()}>
            <Trash2 className="mr-1.5 inline h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>
    </Card>
  )
}
