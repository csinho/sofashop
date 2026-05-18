import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { readEdgeFunctionError } from '@/services/whatsappInvokeError'
import type { OrderStatus, WhatsAppNotifySettings } from '@/types/database'

export type WhatsAppInstanceStatus = 'disconnected' | 'connecting' | 'connected' | 'paused'

export type WhatsAppInstanceSafe = {
  id: string
  store_id: string
  instance_name: string
  instance_id: string | null
  status: WhatsAppInstanceStatus
  connection_state: string | null
  profile_name: string | null
  profile_picture_url: string | null
  owner_number: string | null
  owner_jid: string | null
  notify_settings: WhatsAppNotifySettings
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

export type VerifyOrdersPhoneResult = {
  phone: string
  exists: boolean | null
  jid?: string | null
  number?: string
  needsInstance?: boolean
  missingPhone?: boolean
}

const WHATSAPP_ADMIN_TIMEOUT_MS = 90_000

async function invokeAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabaseBrowserClient()
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          'A integração WhatsApp demorou demais para responder. Se o problema continuar, a função whatsapp-admin no Supabase pode estar desatualizada — peça para republicar a Edge Function.',
        ),
      )
    }, WHATSAPP_ADMIN_TIMEOUT_MS)
  })

  const { data, error } = await Promise.race([
    sb.functions.invoke('whatsapp-admin', { body }),
    timeout,
  ])
  if (error) throw new Error(await readEdgeFunctionError(error))
  const payload = data as { error?: string } & T
  if (payload?.error) throw new Error(payload.error)
  return payload as T
}

export async function fetchWhatsAppInstance(storeId: string): Promise<WhatsAppInstanceSafe | null> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.rpc('get_store_whatsapp_instance_safe', { p_store_id: storeId })
  if (error) throw new Error(error.message)
  if (!data) return null
  return data as WhatsAppInstanceSafe
}

export function whatsappAdminCreate(storeId: string) {
  return invokeAdmin<{ instance: WhatsAppInstanceSafe }>({ action: 'create', storeId })
}

export function whatsappAdminVerifyOrdersPhone(storeId: string) {
  return invokeAdmin<VerifyOrdersPhoneResult>({ action: 'verifyOrdersPhone', storeId })
}

export function whatsappAdminConnect(storeId: string) {
  return invokeAdmin<ConnectPayload>({ action: 'connect', storeId })
}

export function whatsappAdminConnectionState(storeId: string) {
  return invokeAdmin<{
    state: string | null
    status: WhatsAppInstanceStatus
    connection_state: string | null
    profile_name: string | null
    profile_picture_url: string | null
    owner_number: string | null
  }>({ action: 'connectionState', storeId })
}

export function whatsappAdminSyncProfile(storeId: string) {
  return invokeAdmin<{ instance: WhatsAppInstanceSafe }>({ action: 'syncProfile', storeId })
}

export function whatsappAdminPause(storeId: string) {
  return invokeAdmin<{ ok: boolean }>({ action: 'pause', storeId })
}

export function whatsappAdminResume(storeId: string) {
  return invokeAdmin<ConnectPayload>({ action: 'resume', storeId })
}

export function whatsappAdminDelete(storeId: string) {
  return invokeAdmin<{ ok: boolean }>({ action: 'delete', storeId })
}

export function whatsappAdminRevealToken(storeId: string) {
  return invokeAdmin<{ token: string }>({ action: 'revealToken', storeId })
}

export async function whatsappAdminUpdateNotifySettings(
  storeId: string,
  notifySettings: WhatsAppNotifySettings,
  appBaseUrl?: string,
) {
  const sb = getSupabaseBrowserClient()
  const origin =
    appBaseUrl ?? (typeof window !== 'undefined' ? window.location.origin : null)
  const { data, error } = await sb.rpc('update_store_whatsapp_notify_settings', {
    p_store_id: storeId,
    p_settings: notifySettings as Record<string, unknown>,
    p_app_base_url: origin,
  })
  if (error) throw new Error(error.message)
  const payload = data as { ok?: boolean; error?: string } | null
  if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
    throw new Error(String(payload.error))
  }
  return { ok: true }
}

/** @deprecated use whatsappAdminUpdateNotifySettings */
export function whatsappAdminUpdateNotifyStatuses(
  storeId: string,
  notifyStatuses: Partial<Record<OrderStatus, boolean>>,
) {
  return invokeAdmin<{ ok: boolean }>({ action: 'updateNotifyStatuses', storeId, notifyStatuses })
}
