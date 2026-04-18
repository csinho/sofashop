import autoTable from 'jspdf-autotable'
import { jsPDF } from 'jspdf'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { ORDER_STATUS_LABEL } from '@/constants/orderStatus'
import { PAYMENT_LABEL } from '@/constants/payments'
import type { OrderStatus, PaymentKind, PaymentDetails, StoreRow } from '@/types/database'

type ItemRow = {
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  line_total: number
  options_snapshot: Record<string, unknown> | null
}

function paymentLine(kind: PaymentKind, details: PaymentDetails) {
  const b = PAYMENT_LABEL[kind]
  if (kind === 'parcelado' && details.installments) return `${b} — ${details.installments}x`
  if (kind === 'entrada_parcelado') {
    const d = details.down_payment != null ? formatCurrency(details.down_payment) : '-'
    const n = details.installments ?? '-'
    return `${b} — entrada ${d} + ${n}x`
  }
  return b
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return blobToDataUrl(blob)
  } catch {
    return null
  }
}

/** Dimensões reais da imagem (px) para calcular proporção sem distorção (tipo object-fit: contain). */
function getImageNaturalSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth || 1
      const h = img.naturalHeight || 1
      resolve({ w, h })
    }
    img.onerror = () => reject(new Error('image load'))
    img.src = dataUrl
  })
}

/** Encaixa retângulo w×h dentro de maxW×maxH mantendo proporção. */
function fitContainMm(naturalW: number, naturalH: number, maxW: number, maxH: number): { drawW: number; drawH: number } {
  const iw = naturalW > 0 ? naturalW : 1
  const ih = naturalH > 0 ? naturalH : 1
  const ir = iw / ih
  const br = maxW / maxH
  if (ir > br) {
    return { drawW: maxW, drawH: maxW / ir }
  }
  return { drawW: maxH * ir, drawH: maxH }
}

export async function generateOrderPdf(opts: {
  store: StoreRow
  orderNumber: string
  createdAt: string
  status: OrderStatus
  customer: Record<string, unknown>
  shipping: Record<string, unknown>
  items: ItemRow[]
  total: number
  paymentKind: PaymentKind
  paymentDetails: PaymentDetails
  notes: string
}) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 16
  let y = margin

  const LOGO_MAX_W_MM = 36
  const LOGO_MAX_H_MM = 18

  if (opts.store.logo_url) {
    const dataUrl = await fetchImageDataUrl(opts.store.logo_url)
    if (dataUrl) {
      try {
        const fmt: 'PNG' | 'JPEG' | 'WEBP' | 'GIF' = dataUrl.includes('image/png')
          ? 'PNG'
          : dataUrl.includes('image/webp')
            ? 'WEBP'
            : dataUrl.includes('image/gif')
              ? 'GIF'
              : 'JPEG'
        const { w: nw, h: nh } = await getImageNaturalSize(dataUrl)
        const { drawW, drawH } = fitContainMm(nw, nh, LOGO_MAX_W_MM, LOGO_MAX_H_MM)
        doc.addImage(dataUrl, fmt, margin, y, drawW, drawH)
        y += Math.max(drawH, 12) + 4
      } catch {
        /* ignore */
      }
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(15, 23, 42)
  doc.text('Ordem de pedido', margin, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(opts.store.trade_name, margin, y)
  y += 5
  doc.text(`${opts.store.legal_name} — ${opts.store.document_kind.toUpperCase()}: ${maskDoc(opts.store.document)}`, margin, y)
  y += 5
  doc.text(
    `Tel: ${opts.store.phone_main} | WhatsApp: ${opts.store.whatsapp_1} ${opts.store.whatsapp_2 ? ' / ' + opts.store.whatsapp_2 : ''}`,
    margin,
    y,
  )
  y += 5
  doc.text(
    `End.: ${opts.store.street}, ${opts.store.number}${opts.store.complement ? ' — ' + opts.store.complement : ''} — ${opts.store.district}, ${opts.store.city}/${opts.store.state} — CEP ${opts.store.cep}`,
    margin,
    y,
    { maxWidth: pageW - margin * 2 },
  )
  y += 12

  doc.setDrawColor(200)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.text(`Pedido ${opts.orderNumber}`, margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDateTime(opts.createdAt), pageW - margin - 45, y)
  y += 6
  doc.text(`Status: ${ORDER_STATUS_LABEL[opts.status]}`, margin, y)
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.text('Cliente', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const c = opts.customer
  doc.text(String(c.full_name ?? ''), margin, y)
  y += 5
  doc.text(`Telefone: ${String(c.phone ?? '')}`, margin, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.text('Entrega / endereço do pedido', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const s = opts.shipping
  const addr = [
    `${s.street ?? ''}, ${s.number ?? ''}${s.complement ? ' — ' + String(s.complement) : ''}`,
    `${s.district ?? ''} — ${s.city ?? ''}/${s.state ?? ''} — CEP ${s.cep ?? ''}`,
  ]
  addr.forEach((line) => {
    doc.text(line, margin, y, { maxWidth: pageW - margin * 2 })
    y += 5
  })
  y += 4

  const body = opts.items.map((it) => {
    const opt = it.options_snapshot ?? {}
    const extra = [opt.color ? `Cor: ${opt.color}` : '', opt.variant ? `Var.: ${opt.variant}` : '']
      .filter(Boolean)
      .join(' | ')
    return [
      it.product_name + (extra ? `\n${extra}` : ''),
      it.sku,
      String(it.quantity),
      formatCurrency(it.unit_price),
      formatCurrency(it.line_total),
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['Produto', 'SKU', 'Qtd', 'Unit.', 'Total']],
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: { 0: { cellWidth: 70 } },
  })

  const d = doc as InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } }
  y = (d.lastAutoTable?.finalY ?? y) + 8

  doc.setFont('helvetica', 'bold')
  doc.text('Pagamento', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(paymentLine(opts.paymentKind, opts.paymentDetails), margin, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`Total geral: ${formatCurrency(opts.total)}`, margin, y)
  y += 10

  if (opts.notes.trim()) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Observações', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(opts.notes, margin, y, { maxWidth: pageW - margin * 2 })
    y += 16
  }

  if (opts.store.pdf_footer) {
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(opts.store.pdf_footer, margin, 270, { maxWidth: pageW - margin * 2 })
    doc.setTextColor(0)
  }

  y = Math.max(y + 10, 215)
  doc.setDrawColor(120)
  doc.setLineDashPattern([2, 2], 0)
  doc.line(margin, y, pageW - margin, y)
  doc.setLineDashPattern([], 0)
  y += 7

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  const canhoto = `${formatDateTime(opts.createdAt)} • ${opts.orderNumber}`
  doc.text('Assinatura do cliente (fica com a loja)', margin, y)
  doc.text(canhoto, pageW - margin, y, { align: 'right' })
  y += 12
  doc.setTextColor(0, 0, 0)
  doc.setDrawColor(100)
  doc.setLineDashPattern([], 0)
  doc.line(margin, y, pageW - margin, y)

  doc.save(`${opts.orderNumber}.pdf`)
}

function maskDoc(d: string) {
  const x = d.replace(/\D/g, '')
  if (x.length === 11) return `***.***.${x.slice(6, 9)}-**`
  if (x.length === 14) return `**.***.***/${x.slice(8, 12)}-**`
  return '***'
}
