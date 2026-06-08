import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { readEdgeFunctionError } from '@/services/whatsappInvokeError'
import type { WhatsAppNotifySettingItem } from '@/types/database'

export type PlatformWhatsAppInstanceStatus = 'disconnected' | 'connecting' | 'connected' | 'paused'

export type PlatformWhatsAppEvent =
  | 'store_registered'
  | 'payment_due_5d'
  | 'payment_due_3d'
  | 'payment_confirmed'

export type PlatformWhatsAppNotifySettings = Partial<
  Record<PlatformWhatsAppEvent, WhatsAppNotifySettingItem>
>

export type PlatformWhatsAppInstanceSafe = {
  singleton_key: string
  instance_name: string
  instance_id: string | null
  status: PlatformWhatsAppInstanceStatus
  connection_state: string | null
  profile_name: string | null
  profile_picture_url: string | null
  owner_number: string | null
  owner_jid: string | null
  connect_phone: string | null
  notify_settings: PlatformWhatsAppNotifySettings
  connected_at: string | null
  paused_at: string | null
  created_at: string
  updated_at: string
}

export type ConnectPayload = {
  pairingCode: string | null
  qrBase64: string | null
  qrPayload: string | null
  phone?: string
  count?: number
}

export type VerifyConnectPhoneResult = {
  phone: string
  exists: boolean | null
  jid?: string | null
  number?: string
  needsInstance?: boolean
  missingPhone?: boolean
}

const TIMEOUT_MS = 90_000

async function invokePlatformAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabaseBrowserClient()
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          'A integração WhatsApp da plataforma demorou demais para responder. Tente novamente em instantes.',
        ),
      )
    }, TIMEOUT_MS)
  })

  const { data, error } = await Promise.race([
    sb.functions.invoke('whatsapp-admin', { body: { scope: 'platform', ...body } }),
    timeout,
  ])
  if (error) throw new Error(await readEdgeFunctionError(error))
  const payload = data as { error?: string } & T
  if (payload?.error) throw new Error(payload.error)
  return payload as T
}

export async function fetchPlatformWhatsAppInstance(): Promise<PlatformWhatsAppInstanceSafe | null> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.rpc('get_platform_whatsapp_instance_safe')
  if (error) throw new Error(error.message)
  if (!data) return null
  return data as PlatformWhatsAppInstanceSafe
}

export function platformWhatsAppAdminCreate(connectPhone: string) {
  return invokePlatformAdmin<{ instance: PlatformWhatsAppInstanceSafe }>({
    action: 'create',
    connectPhone,
  })
}

export function platformWhatsAppAdminVerifyConnectPhone(connectPhone: string) {
  return invokePlatformAdmin<VerifyConnectPhoneResult>({
    action: 'verifyConnectPhone',
    connectPhone,
  })
}

export function platformWhatsAppAdminConnect(connectPhone?: string) {
  return invokePlatformAdmin<ConnectPayload>({
    action: 'connect',
    ...(connectPhone ? { connectPhone } : {}),
  })
}

export function platformWhatsAppAdminConnectionState() {
  return invokePlatformAdmin<{
    state: string | null
    status: PlatformWhatsAppInstanceStatus
    connection_state: string | null
    profile_name: string | null
    profile_picture_url: string | null
    owner_number: string | null
  }>({ action: 'connectionState' })
}

export function platformWhatsAppAdminSyncProfile() {
  return invokePlatformAdmin<{ instance: PlatformWhatsAppInstanceSafe }>({ action: 'syncProfile' })
}

export function platformWhatsAppAdminPause() {
  return invokePlatformAdmin<{ ok: boolean }>({ action: 'pause' })
}

export function platformWhatsAppAdminResume(connectPhone?: string) {
  return invokePlatformAdmin<ConnectPayload>({
    action: 'resume',
    ...(connectPhone ? { connectPhone } : {}),
  })
}

export function platformWhatsAppAdminDelete() {
  return invokePlatformAdmin<{ ok: boolean }>({ action: 'delete' })
}

export async function platformWhatsAppAdminUpdateNotifySettings(
  notifySettings: PlatformWhatsAppNotifySettings,
) {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.rpc('update_platform_whatsapp_notify_settings', {
    p_settings: notifySettings as Record<string, unknown>,
  })
  if (error) throw new Error(error.message)
  const payload = data as { ok?: boolean; error?: string } | null
  if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
    throw new Error(String(payload.error))
  }
  return { ok: true }
}
