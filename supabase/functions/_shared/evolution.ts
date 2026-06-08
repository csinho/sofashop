const baseUrl = () => {
  const url = Deno.env.get('EVOLUTION_API_URL') ?? ''
  return url.replace(/\/$/, '')
}

const globalKey = () => Deno.env.get('EVOLUTION_API_KEY') ?? ''

export function evolutionEnvErrorResponse() {
  const url = Deno.env.get('EVOLUTION_API_URL')
  const key = Deno.env.get('EVOLUTION_API_KEY')
  if (url && key) return null
  return {
    error:
      'Configure os secrets EVOLUTION_API_URL e EVOLUTION_API_KEY no Supabase (Edge Functions → Secrets).',
    missing: {
      EVOLUTION_API_URL: !url,
      EVOLUTION_API_KEY: !key,
    },
  }
}

export async function evolutionRequest(
  path: string,
  init: RequestInit & { apiKey?: string } = {},
) {
  const envErr = evolutionEnvErrorResponse()
  if (envErr) {
    return { ok: false, status: 503, data: envErr }
  }

  const { apiKey, headers: extraHeaders, ...rest } = init
  const key = apiKey ?? globalKey()
  const res = await fetch(`${baseUrl()}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      ...(extraHeaders as Record<string, string> | undefined),
    },
  })
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }
  return { ok: res.ok, status: res.status, data }
}

export function instanceNameForStore(storeId: string) {
  return `sofashop-${storeId.replace(/-/g, '')}`
}

export function webhookUrlForStore(storeId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  return `${supabaseUrl}/functions/v1/whatsapp-webhook?storeId=${storeId}`
}

export function instanceNameForPlatform() {
  return 'sofashop-plataforma'
}

export function webhookUrlForPlatform() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  return `${supabaseUrl}/functions/v1/whatsapp-webhook?scope=platform`
}
