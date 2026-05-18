import { getSupabaseCatalogClient } from '@/integrations/supabase/client'

export type WhatsAppCheckResult =
  | { skipped: true; reason?: string }
  | { skipped: false; exists: boolean; jid?: string | null; number?: string }

export async function checkPhoneHasWhatsApp(storeSlug: string, phoneDigits: string): Promise<WhatsAppCheckResult> {
  const sb = getSupabaseCatalogClient()
  const { data, error } = await sb.functions.invoke('whatsapp-check', {
    body: { storeSlug, phoneDigits: phoneDigits.replace(/\D/g, '') },
  })
  if (error) throw new Error(error.message)
  const payload = data as WhatsAppCheckResult & { error?: string }
  if (payload?.error) throw new Error(payload.error)
  if (payload.skipped) return { skipped: true, reason: (payload as { reason?: string }).reason }
  const checked = payload as { exists?: boolean; jid?: string | null; number?: string }
  return { skipped: false, exists: Boolean(checked.exists), jid: checked.jid, number: checked.number }
}
