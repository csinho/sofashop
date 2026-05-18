import { jsonResponse, optionsResponse } from '../_shared/cors.ts'
import { evolutionRequest } from '../_shared/evolution.ts'
import { getServiceClient } from '../_shared/supabase.ts'
import { phoneToEvolutionNumber } from '../_shared/templates.ts'

const rateMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000

function checkRate(key: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  try {
    const body = await req.json() as { storeSlug?: string; phoneDigits?: string }
    const { storeSlug, phoneDigits } = body

    if (!storeSlug || !phoneDigits) {
      return jsonResponse({ error: 'storeSlug e phoneDigits são obrigatórios' }, 400)
    }

    const digits = phoneDigits.replace(/\D/g, '')
    if (digits.length < 10) {
      return jsonResponse({ error: 'Telefone inválido' }, 400)
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!checkRate(`${ip}:${storeSlug}`)) {
      return jsonResponse({ error: 'Muitas verificações. Aguarde um momento.' }, 429)
    }

    const sb = getServiceClient()

    const { data: store } = await sb
      .from('stores')
      .select('id')
      .eq('slug', storeSlug)
      .maybeSingle()

    if (!store) {
      return jsonResponse({ skipped: true, reason: 'store_not_found' })
    }

    const { data: instance } = await sb
      .from('store_whatsapp_instances')
      .select('instance_name, instance_token, status')
      .eq('store_id', store.id)
      .maybeSingle()

    if (!instance || instance.status !== 'connected') {
      return jsonResponse({ skipped: true, reason: 'whatsapp_not_connected' })
    }

    const number = phoneToEvolutionNumber(digits)
    const { ok, data } = await evolutionRequest(
      `/chat/whatsappNumbers/${encodeURIComponent(instance.instance_name)}`,
      {
        method: 'POST',
        apiKey: instance.instance_token,
        body: JSON.stringify({ numbers: [number] }),
      },
    )

    if (!ok) {
      return jsonResponse({ skipped: true, reason: 'evolution_error', details: data })
    }

    const results = data as { exists?: boolean; jid?: string; number?: string }[]
    const first = Array.isArray(results) ? results[0] : null
    const exists = Boolean(first?.exists)

    return jsonResponse({
      skipped: false,
      exists,
      jid: first?.jid ?? null,
      number: first?.number ?? number,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return jsonResponse({ error: msg }, 500)
  }
})
