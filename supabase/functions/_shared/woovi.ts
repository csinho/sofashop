import { sanitizeAsciiComment } from './billingLogic.ts'

const WOOVI_BASE = 'https://api.openpix.com.br/api/v1'

function normalizeWooviAppId(raw: string): string {
  let value = raw.trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim()
  }
  return value.replace(/^Bearer\s+/i, '').trim()
}

/** AppID bruto no header Authorization — sem prefixo Bearer (doc Woovi/OpenPix). */
function authHeader(): string {
  const rawAppId = Deno.env.get('WOOVI_APP_ID')
  if (rawAppId?.trim()) {
    return normalizeWooviAppId(rawAppId)
  }

  const clientId = Deno.env.get('WOOVI_CLIENT_ID')?.trim()
  const clientSecret = Deno.env.get('WOOVI_CLIENT_SECRET')?.trim()
  if (clientId && clientSecret) {
    return btoa(`${clientId}:${clientSecret}`)
  }

  throw new Error(
    'Configure WOOVI_APP_ID (AppID do painel Woovi → Api/Plugins) ou WOOVI_CLIENT_ID + WOOVI_CLIENT_SECRET nos Secrets da Edge Function.',
  )
}

function formatWooviError(json: unknown, fallback: string): string {
  if (typeof json === 'object' && json !== null) {
    const errors = (json as { errors?: Array<{ message?: string }> }).errors
    if (Array.isArray(errors) && errors.length > 0) {
      return errors.map((e) => e.message ?? 'erro').join('; ')
    }
    if ('error' in json && (json as { error?: unknown }).error) {
      return String((json as { error: unknown }).error)
    }
  }
  return fallback
}

async function wooviFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${WOOVI_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const msg = formatWooviError(json, text || res.statusText)
    const hint =
      res.status === 401 || /appid|app id|inválido|invalid/i.test(msg)
        ? ' Verifique o secret WOOVI_APP_ID: use o AppID exibido em Woovi → Api/Plugins (valor bruto, sem Bearer/aspas), ou WOOVI_CLIENT_ID + WOOVI_CLIENT_SECRET.'
        : ''
    throw new Error(`Woovi: ${msg}.${hint}`)
  }
  return json
}

export type WooviChargeResult = {
  correlationId: string
  brCode: string | null
  qrCodeImage: string | null
  paymentLinkUrl: string | null
  value: number
}

export async function createWooviPlanCharge(opts: {
  correlationID: string
  valueCents: number
  comment: string
  customerName?: string
}): Promise<WooviChargeResult> {
  const body = {
    correlationID: opts.correlationID,
    value: opts.valueCents,
    comment: sanitizeAsciiComment(opts.comment),
    customer: opts.customerName ? { name: opts.customerName.slice(0, 120) } : undefined,
  }
  const data = (await wooviFetch('/charge', {
    method: 'POST',
    body: JSON.stringify(body),
  })) as {
    charge?: {
      correlationID?: string
      brCode?: string
      qrCodeImage?: string
      paymentLinkUrl?: string
      value?: number
    }
  }
  const charge = data.charge ?? (data as { correlationID?: string })
  return {
    correlationId: charge.correlationID ?? opts.correlationID,
    brCode: charge.brCode ?? null,
    qrCodeImage: charge.qrCodeImage ?? null,
    paymentLinkUrl: charge.paymentLinkUrl ?? null,
    value: charge.value ?? opts.valueCents,
  }
}

export async function fetchWooviReceiptPdf(endToEndId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${WOOVI_BASE}/receipt/${encodeURIComponent(endToEndId)}`, {
    headers: { Authorization: authHeader(), Accept: 'application/pdf' },
  })
  if (!res.ok) {
    throw new Error('Recibo não disponível na Woovi')
  }
  return res.arrayBuffer()
}

/** Se WOOVI_WEBHOOK_AUTHORIZATION não estiver definido, aceita o webhook (Woovi sem header customizado). */
export function validateWooviWebhookAuth(req: Request): boolean {
  const expected = Deno.env.get('WOOVI_WEBHOOK_AUTHORIZATION')?.trim()
  if (!expected) return true
  const auth = req.headers.get('Authorization') ?? ''
  return auth === expected || auth === `Bearer ${expected}`
}
