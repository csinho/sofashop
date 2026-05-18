/** Extrai mensagem legível de erros do PostgREST / RPC Supabase. */
export function getCheckoutErrorMessage(error: unknown, fallback = 'Não foi possível finalizar o pedido.'): string {
  if (!error || typeof error !== 'object') return fallback
  const e = error as { message?: string; details?: string; hint?: string }
  const msg = (e.message ?? '').trim()
  if (msg && !msg.toLowerCase().includes('non-2xx') && !msg.toLowerCase().includes('failed to fetch')) {
    return msg
  }
  if (e.details?.trim()) return e.details.trim()
  if (e.hint?.trim()) return e.hint.trim()
  return fallback
}
