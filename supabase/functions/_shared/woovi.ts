import { sanitizeAsciiComment } from './billingLogic.ts'

const WOOVI_BASE = 'https://api.openpix.com.br/api/v1'

function authHeader(): string {
  const appId = Deno.env.get('WOOVI_APP_ID')
  if (!appId) throw new Error('WOOVI_APP_ID não configurado')
  return appId
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
    const msg =
      typeof json === 'object' && json && 'error' in json
        ? String((json as { error: string }).error)
        : text || res.statusText
    throw new Error(`Woovi: ${msg}`)
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
