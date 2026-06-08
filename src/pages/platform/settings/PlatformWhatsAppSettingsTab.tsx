import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { useWhatsAppConnection } from '@/hooks/useWhatsAppConnection'
import { formatBrazilPhoneDisplay, stripBrazilCountryCode, toBrazilStorageDigits } from '@/lib/phoneBr'
import { notifyErr, notifyOk } from '@/lib/notify'
import { WhatsAppInstanceCard } from '@/components/whatsapp/WhatsAppInstanceCard'
import {
  fetchPlatformWhatsAppInstance,
  platformWhatsAppAdminConnect,
  platformWhatsAppAdminConnectionState,
  platformWhatsAppAdminCreate,
  platformWhatsAppAdminDelete,
  platformWhatsAppAdminPause,
  platformWhatsAppAdminResume,
  platformWhatsAppAdminSyncProfile,
  platformWhatsAppAdminVerifyConnectPhone,
  platformWhatsAppAdminUpdateNotifySettings,
  type PlatformWhatsAppInstanceSafe,
  type PlatformWhatsAppNotifySettings,
} from '@/services/platformWhatsAppAdminService'

const FUTURE_EVENTS = [
  { id: 'store_registered', label: 'Loja cadastrada', desc: 'Enviar mensagem à loja quando ela se registrar.' },
  { id: 'payment_due_5d', label: 'Vencimento em 5 dias', desc: 'Lembrete PIX 5 dias antes do vencimento do plano.' },
  { id: 'payment_due_3d', label: 'Vencimento em 3 dias', desc: 'Lembrete PIX 3 dias antes do vencimento do plano.' },
  { id: 'payment_due_1d', label: 'Vencimento em 1 dia', desc: 'Lembrete PIX 1 dia antes do vencimento do plano.' },
  { id: 'payment_confirmed', label: 'Pagamento confirmado', desc: 'Confirmação após pagamento do plano via PIX.' },
  { id: 'plan_price_changed', label: 'Valor do plano alterado', desc: 'Aviso quando o admin altera o preço mensal.' },
] as const

type ConnectMode = 'qr' | 'pairing'

export function PlatformWhatsAppSettingsTab() {
  const [instance, setInstance] = useState<PlatformWhatsAppInstanceSafe | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [pausing, setPausing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [connectPhone, setConnectPhone] = useState('')
  const [connectMode, setConnectMode] = useState<ConnectMode>('qr')
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyOk, setVerifyOk] = useState<boolean | null>(null)

  const phoneDigits = toBrazilStorageDigits(connectPhone)
  const hasConnectPhone = stripBrazilCountryCode(phoneDigits).length >= 10

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const row = await fetchPlatformWhatsAppInstance()
      setInstance(row)
      if (row?.connect_phone) {
        setConnectPhone(formatBrazilPhoneDisplay(row.connect_phone))
      }
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : 'Erro ao carregar WhatsApp da plataforma')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => {
      if (qrImageUrl?.startsWith('blob:')) URL.revokeObjectURL(qrImageUrl)
    }
  }, [qrImageUrl])

  const { stopPolling, applyConnectResult, startPolling } = useWhatsAppConnection({
    onConnected: async () => {
      setQrImageUrl(null)
      setPairingCode(null)
      setConnecting(false)
      await load()
    },
    pollConnectionState: platformWhatsAppAdminConnectionState,
    syncProfile: async () => {
      await platformWhatsAppAdminSyncProfile()
    },
  })

  async function handleVerifyPhone() {
    if (!hasConnectPhone) {
      notifyErr('Informe um número com DDD.')
      return
    }
    setVerifying(true)
    setVerifyOk(null)
    try {
      const res = await platformWhatsAppAdminVerifyConnectPhone(phoneDigits)
      setVerifyOk(res.exists === true)
      if (res.exists === false) {
        notifyErr('Este número não possui WhatsApp ativo.')
      } else if (res.exists === true) {
        notifyOk('Número verificado — possui WhatsApp.')
      } else {
        notifyOk('Número registrado. Crie a instância para verificar na Evolution.')
      }
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : 'Falha ao verificar número')
    } finally {
      setVerifying(false)
    }
  }

  async function handleCreateAndConnect() {
    if (!hasConnectPhone) {
      notifyErr('Informe o número de WhatsApp para conexão.')
      return
    }
    setCreating(true)
    try {
      if (!instance) {
        await platformWhatsAppAdminCreate(phoneDigits)
        await load()
      }
      setConnecting(true)
      const res = await platformWhatsAppAdminConnect(phoneDigits)
      setPairingCode(res.pairingCode)
      const qr = await applyConnectResult(res)
      setQrImageUrl(qr)
      startPolling()
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : 'Falha ao iniciar conexão')
      setConnecting(false)
    } finally {
      setCreating(false)
    }
  }

  async function handlePause() {
    setPausing(true)
    try {
      await platformWhatsAppAdminPause()
      stopPolling()
      await load()
      notifyOk('Conexão pausada.')
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : 'Falha ao pausar')
    } finally {
      setPausing(false)
    }
  }

  async function handleResume() {
    setConnecting(true)
    try {
      const res = await platformWhatsAppAdminResume(phoneDigits)
      setPairingCode(res.pairingCode)
      const qr = await applyConnectResult(res)
      setQrImageUrl(qr)
      await load()
      startPolling()
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : 'Falha ao retomar')
      setConnecting(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    stopPolling()
    try {
      await platformWhatsAppAdminDelete()
      setInstance(null)
      setQrImageUrl(null)
      setPairingCode(null)
      setConnecting(false)
      setDeleteConfirmOpen(false)
      notifyOk('Instância removida.')
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : 'Falha ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  const cardInstance = instance
    ? {
        status: instance.status,
        profile_name: instance.profile_name,
        profile_picture_url: instance.profile_picture_url,
        owner_number: instance.owner_number,
      }
    : null

  async function toggleEvent(eventId: string, enabled: boolean) {
    if (!instance?.notify_settings) return
    const next: PlatformWhatsAppNotifySettings = {
      ...instance.notify_settings,
      [eventId]: {
        enabled,
        template:
          instance.notify_settings[eventId as keyof PlatformWhatsAppNotifySettings]?.template ??
          '',
      },
    }
    try {
      await platformWhatsAppAdminUpdateNotifySettings(next)
      setInstance((prev) => (prev ? { ...prev, notify_settings: next } : prev))
      notifyOk(enabled ? 'Notificação ativada.' : 'Notificação desativada.')
    } catch (e) {
      notifyErr(e instanceof Error ? e.message : 'Erro ao salvar')
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-500">Carregando WhatsApp da plataforma…</p>
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-900">WhatsApp da plataforma</h2>
          <p className="mt-1 text-sm text-ink-500">
            Conecte o WhatsApp do administrador do sistema para enviar mensagens automáticas às lojas (cadastro,
            lembretes de plano, confirmação de pagamento). Usa o mesmo servidor Evolution API das lojas, em instância
            separada.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-ink-600">Número para conexão</label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              className="sm:flex-1"
              type="tel"
              value={connectPhone}
              onChange={(e) => {
                setConnectPhone(e.target.value)
                setVerifyOk(null)
              }}
              placeholder="(71) 99999-9999"
              autoComplete="tel"
            />
            <Button type="button" variant="secondary" loading={verifying} onClick={() => void handleVerifyPhone()}>
              Verificar WhatsApp
            </Button>
          </div>
          {verifyOk === true ? (
            <p className="mt-1 text-xs text-emerald-700">Número verificado com WhatsApp ativo.</p>
          ) : verifyOk === false ? (
            <p className="mt-1 text-xs text-red-600">Número sem WhatsApp ativo.</p>
          ) : null}
        </div>
      </Card>

      {cardInstance && (cardInstance.status === 'connected' || cardInstance.status === 'paused') ? (
        <WhatsAppInstanceCard
          instance={cardInstance}
          onPause={() => void handlePause()}
          onResume={() => void handleResume()}
          onDelete={() => setDeleteConfirmOpen(true)}
          pausing={pausing}
          deleting={deleting}
        />
      ) : (
        <Card className="space-y-4">
          {!instance ? (
            <p className="text-sm text-ink-600">Nenhuma instância configurada.</p>
          ) : (
            <p className="text-sm text-ink-600">
              Instância <strong>{instance.instance_name}</strong> — status: {instance.status}
            </p>
          )}

          {(connecting || creating) && (qrImageUrl || pairingCode) ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium',
                    connectMode === 'qr' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700',
                  )}
                  onClick={() => setConnectMode('qr')}
                >
                  QR Code
                </button>
                {pairingCode ? (
                  <button
                    type="button"
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium',
                      connectMode === 'pairing' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700',
                    )}
                    onClick={() => setConnectMode('pairing')}
                  >
                    Código
                  </button>
                ) : null}
              </div>
              {connectMode === 'qr' && qrImageUrl ? (
                <img src={qrImageUrl} alt="QR Code WhatsApp" className="mx-auto w-64 rounded-xl border border-ink-200" />
              ) : null}
              {connectMode === 'pairing' && pairingCode ? (
                <p className="text-center font-mono text-2xl tracking-widest text-ink-900">{pairingCode}</p>
              ) : null}
              <p className="text-center text-sm text-ink-500">Aguardando conexão…</p>
            </div>
          ) : (
            <Button
              type="button"
              className="w-full sm:w-auto"
              loading={creating || connecting}
              onClick={() => void handleCreateAndConnect()}
            >
              {instance ? 'Conectar WhatsApp da plataforma' : 'Criar e conectar WhatsApp'}
            </Button>
          )}
        </Card>
      )}

      <Card className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-900">Mensagens automáticas</h2>
          <p className="mt-1 text-sm text-ink-500">
            Ative os eventos de billing e cadastro. Os disparos usam a instância WhatsApp da plataforma conectada acima.
          </p>
        </div>
        <ul className="space-y-3">
          {FUTURE_EVENTS.map((ev) => {
            const enabled = Boolean(instance?.notify_settings?.[ev.id]?.enabled)
            return (
              <li
                key={ev.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-ink-100 bg-ink-50/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink-800">{ev.label}</p>
                  <p className="text-xs text-ink-500">{ev.desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  className={cn(
                    'relative h-6 w-11 shrink-0 rounded-full transition',
                    enabled ? 'bg-brand-600' : 'bg-ink-300',
                  )}
                  onClick={() => void toggleEvent(ev.id, !enabled)}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
                      enabled ? 'left-[22px]' : 'left-0.5',
                    )}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Excluir instância WhatsApp?"
        description="A instância será removida da Evolution API e do banco. Será necessário criar novamente."
        confirmLabel="Excluir"
        confirmVariant="danger"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteConfirmOpen(false)}
      />
    </div>
  )
}
