import { getSupabaseCatalogClient } from '@/integrations/supabase/client'
import type { Json } from '@/types/database'
import type { PaymentDetails, PaymentKind } from '@/types/database'
import type { CartLine } from '@/contexts/CartContext'

export type ResolvedCatalogCustomer = {
  id: string
  full_name: string
  phone: string
  phone_secondary: string
  cep: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
}

function parseResolvedCustomer(data: unknown): ResolvedCatalogCustomer | null {
  if (data == null || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  if (row.id == null) return null
  return {
    id: String(row.id),
    full_name: String(row.full_name ?? ''),
    phone: String(row.phone ?? ''),
    phone_secondary: String(row.phone_secondary ?? ''),
    cep: String(row.cep ?? ''),
    street: String(row.street ?? ''),
    number: String(row.number ?? ''),
    complement: String(row.complement ?? ''),
    district: String(row.district ?? ''),
    city: String(row.city ?? ''),
    state: String(row.state ?? 'SP'),
  }
}

/** Pré-preenche dados do cliente no checkout (loja publicada). Por `customer_id` ou telefone normalizado. */
export async function resolveCatalogCustomer(
  storeId: string,
  opts: { customerId?: string | null; phone?: string | null },
): Promise<ResolvedCatalogCustomer | null> {
  const sb = getSupabaseCatalogClient()
  const { data, error } = await sb.rpc('resolve_catalog_customer', {
    p_store_id: storeId,
    p_customer_id: opts.customerId ?? null,
    p_phone: opts.phone ?? null,
  })
  if (error) throw error
  return parseResolvedCustomer(data)
}

export type CheckoutPayload = {
  storeId: string
  customer: {
    full_name: string
    phone: string
    phone_secondary?: string
    email?: string
  }
  shipping: {
    cep: string
    street: string
    number: string
    complement: string
    district: string
    city: string
    state: string
  }
  paymentKind: PaymentKind
  paymentDetails: PaymentDetails
  notes: string
  lines: CartLine[]
}

export async function submitCheckout(payload: CheckoutPayload) {
  const sb = getSupabaseCatalogClient()
  const items = payload.lines.map((l) => ({
    product_id: l.productId,
    variant_id: l.variantId,
    product_name: l.name,
    sku: l.sku,
    quantity: l.qty,
    unit_price: l.unitPrice,
    line_total: l.unitPrice * l.qty,
    options_snapshot: {
      color: l.colorName ?? null,
      variant: l.variantLabel ?? null,
      image: l.imageUrl ?? null,
    } as Json,
  }))

  const { data, error } = await sb.rpc('checkout_catalog_order', {
    p_store_id: payload.storeId,
    p_customer: payload.customer as Json,
    p_shipping: payload.shipping as Json,
    p_items: items as unknown as Json,
    p_payment: payload.paymentDetails as Json,
    p_notes: payload.notes,
    p_payment_kind: payload.paymentKind,
  })

  if (error) throw error
  const row = data as { order_id?: string; order_number?: string; customer_id?: string }
  return {
    order_id: String(row.order_id ?? ''),
    order_number: String(row.order_number ?? ''),
    customer_id: String(row.customer_id ?? ''),
  }
}
