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

function buildWooviAppIdFromClientCredentials(clientId: string, clientSecret: string): string {
  return btoa(`${clientId}:${clientSecret}`)
}

/**
 * Prioridade Woovi/OpenPix:
 * 1) WOOVI_CLIENT_ID + WOOVI_CLIENT_SECRET → Base64(clientId:clientSecret)
 * 2) WOOVI_APP_ID → valor bruto do painel (sem Bearer)
 */
function resolveWooviAuthorization(): string | null {
  const clientId = Deno.env.get('WOOVI_CLIENT_ID')?.trim()
  const clientSecret = Deno.env.get('WOOVI_CLIENT_SECRET')?.trim()
  if (clientId && clientSecret) {
    return buildWooviAppIdFromClientCredentials(
      normalizeWooviAppId(clientId),
      normalizeWooviAppId(clientSecret),
    )
  }

  const appId = Deno.env.get('WOOVI_APP_ID')?.trim()
  if (!appId) return null
  return normalizeWooviAppId(appId)
}

function authHeader(): string {
  const auth = resolveWooviAuthorization()
  if (!auth) {
    throw new Error(
      'Configure WOOVI_APP_ID (AppID do painel Woovi → Api/Plugins) ou WOOVI_CLIENT_ID + WOOVI_CLIENT_SECRET nos Secrets da Edge Function.',
    )
  }
  return auth
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
    const authHint =
      res.status === 401 && /appid|app id/i.test(msg)
        ? ' Verifique WOOVI_APP_ID nos Secrets do Supabase.'
        : ''
    throw new Error(`Woovi: ${msg}${authHint}`)
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

function wooviCustomerName(name: string): string {
  const n = sanitizeAsciiComment(name)
  return n || 'Loja'
}

function wooviCustomerPhone(stored: string): string | null {
  const d = stored.replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('55') && d.length >= 12) return d
  if (d.length >= 10 && d.length <= 11) return `55${d}`
  return null
}

function wooviCustomerTaxId(document: string, kind: string): string | null {
  const d = document.replace(/\D/g, '')
  if (kind === 'cpf' && d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  if (kind === 'cnpj' && d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  }
  return d.length >= 11 ? d : null
}

export async function createWooviPlanCharge(opts: {
  correlationID: string
  valueCents: number
  comment: string
  customer: {
    name: string
    phone?: string | null
    email?: string | null
    document?: string | null
    documentKind?: string | null
  }
}): Promise<WooviChargeResult> {
  const customer: Record<string, string> = {
    name: wooviCustomerName(opts.customer.name).slice(0, 120),
  }

  const phone = opts.customer.phone ? wooviCustomerPhone(opts.customer.phone) : null
  const email = opts.customer.email?.trim()
  const taxID = opts.customer.document
    ? wooviCustomerTaxId(opts.customer.document, opts.customer.documentKind ?? 'cnpj')
    : null

  if (phone) customer.phone = phone
  if (email) customer.email = email
  if (taxID) customer.taxID = taxID

  if (!phone && !email && !taxID) {
    throw new Error(
      'Dados da loja incompletos para PIX: cadastre WhatsApp, e-mail ou CPF/CNPJ em Configurações.',
    )
  }

  const body = {
    correlationID: opts.correlationID,
    value: opts.valueCents,
    comment: sanitizeAsciiComment(opts.comment),
    expiresIn: 3 * 24 * 60 * 60,
    customer,
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
