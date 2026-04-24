import autoTable from 'jspdf-autotable'
import { jsPDF } from 'jspdf'
import { formatCurrency, formatDate } from '@/lib/format'
import { ORDER_STATUS_LABEL } from '@/constants/orderStatus'
import { PAYMENT_LABEL } from '@/constants/payments'
import { BRAND_ASSETS, brandAssetAbsoluteUrl } from '@/lib/brandAssets'
import type { OrderStatus, PaymentKind, PaymentDetails, StoreRow } from '@/types/database'

type ItemRow = {
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  line_total: number
  options_snapshot: Record<string, unknown> | null
}

const MM_MARGIN = 12
const TABLE_HEAD_RGB: [number, number, number] = [214, 226, 241]
const BORDER_RGB: [number, number, number] = [100, 116, 139]
const INK_RGB: [number, number, number] = [15, 23, 42]
const STUB_H_MM = 46

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

function maskDoc(d: string) {
  const x = d.replace(/\D/g, '')
  if (x.length === 11) return `***.***.${x.slice(6, 9)}-**`
  if (x.length === 14) return `**.***.***/${x.slice(8, 12)}-**`
  return '***'
}

function hLine(doc: jsPDF, y: number, margin: number, pageW: number, color: [number, number, number] = BORDER_RGB) {
  doc.setDrawColor(...color)
  doc.setLineWidth(0.25)
  doc.line(margin, y, pageW - margin, y)
}

function sectionHeading(doc: jsPDF, margin: number, pageW: number, y: number, title: string): number {
  hLine(doc, y, margin, pageW)
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...INK_RGB)
  doc.text(title, margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  return y
}

function destinatarioLine(
  customer: Record<string, unknown>,
  shipping: Record<string, unknown>,
): string {
  const name = String(customer.full_name ?? '').trim()
  const parts = [
    `${shipping.street ?? ''}, ${shipping.number ?? ''}`.trim().replace(/^,\s*|,\s*$/g, ''),
    String(shipping.district ?? ''),
    String(shipping.city ?? ''),
    String(shipping.state ?? ''),
    shipping.cep ? `CEP ${shipping.cep}` : '',
  ].filter(Boolean)
  return `${name} — ${parts.join(', ')}`
}

function drawCanhoto(
  doc: jsPDF,
  opts: {
    store: StoreRow
    orderNumber: string
    createdAt: string
    total: number
    customer: Record<string, unknown>
    shipping: Record<string, unknown>
  },
  stubTop: number,
  margin: number,
  pageW: number,
) {
  const rightW = 32
  const splitX = pageW - margin - rightW
  const innerLeftW = splitX - margin - 4

  doc.setLineDashPattern([1.2, 2], 0)
  doc.setDrawColor(80)
  doc.setLineWidth(0.3)
  doc.line(margin, stubTop, pageW - margin, stubTop)
  doc.setLineDashPattern([], 0)

  const boxTop = stubTop + 3
  const boxH = STUB_H_MM - 5
  doc.setDrawColor(0)
  doc.setLineWidth(0.35)
  doc.rect(margin, boxTop, pageW - 2 * margin, boxH)

  doc.line(splitX, boxTop, splitX, boxTop + boxH)

  const empresa = (opts.store.legal_name || opts.store.trade_name).toUpperCase()
  const intro = `RECEBEMOS DE ${empresa} OS PRODUTOS E/OU SERVIÇOS CONSTANTES NO PEDIDO DE VENDA INDICADO AO LADO.`
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  doc.setTextColor(0, 0, 0)
  const introLines = doc.splitTextToSize(intro, innerLeftW)
  let ly = boxTop + 3.5
  doc.text(introLines, margin + 2, ly)
  ly += introLines.length * 2.8 + 1.5

  const meta = `EMISSÃO: ${formatDate(opts.createdAt)}     VALOR TOTAL: ${formatCurrency(opts.total)}     DESTINATÁRIO: ${destinatarioLine(opts.customer, opts.shipping)}`
  const metaLines = doc.splitTextToSize(meta, innerLeftW)
  doc.text(metaLines, margin + 2, ly)
  ly += metaLines.length * 2.8 + 2

  const rowH = boxTop + boxH - ly - 1
  const half = (splitX - margin - 6) / 2
  const dateBoxX = margin + 2
  const signBoxX = dateBoxX + half + 2
  const boxY = ly

  doc.setDrawColor(0)
  doc.setLineWidth(0.2)
  doc.rect(dateBoxX, boxY, half - 1, rowH)
  doc.rect(signBoxX, boxY, half - 1, rowH)

  doc.setFontSize(5.5)
  doc.setTextColor(60, 60, 60)
  doc.text('DATA DO RECEBIMENTO', dateBoxX + 1, boxY + 3)
  doc.text('IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', signBoxX + 1, boxY + 3)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 0)
  const cx = splitX + rightW / 2
  doc.text('PEDIDO', cx, boxTop + 9, { align: 'center' })
  doc.setFontSize(7.5)
  const ordLines = doc.splitTextToSize(opts.orderNumber, rightW - 4)
  doc.text(ordLines, cx, boxTop + 14, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('Série 1', cx, boxTop + boxH - 5, { align: 'center' })

  doc.setFontSize(8)
  doc.setTextColor(...INK_RGB)
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
  const pageH = doc.internal.pageSize.getHeight()
  const margin = MM_MARGIN
  let y = margin

  const subtotalItens = opts.items.reduce((s, it) => s + it.line_total, 0)

  const LOGO_MAX_W_MM = 40
  const LOGO_MAX_H_MM = 22
  let logoBottom = y
  let dataUrl: string | null = null
  if (opts.store.logo_url) {
    dataUrl = await fetchImageDataUrl(opts.store.logo_url)
  }
  if (!dataUrl && typeof window !== 'undefined') {
    dataUrl = await fetchImageDataUrl(brandAssetAbsoluteUrl(BRAND_ASSETS.icon))
  }
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
      logoBottom = y + Math.max(drawH, 11)
    } catch {
      /* ignore */
    }
  }

  /** Coluna direita fixa (mm): título do pedido alinhado à direita da página, sem invadir dados da loja. */
  const RIGHT_COL_W = 76
  const HEADER_GUTTER = 5
  const rightX = pageW - margin
  const textX = margin + (logoBottom > margin ? LOGO_MAX_W_MM + 4 : 0)
  const textMaxW = Math.max(
    36,
    rightX - RIGHT_COL_W - HEADER_GUTTER - textX,
  )

  doc.setFont('helvetica', 'normal', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...INK_RGB)
  let ty = y + 2
  doc.text(opts.store.trade_name, textX, ty, { maxWidth: textMaxW })
  ty += 5
  doc.setFontSize(7.5)
  const docLine = `${opts.store.legal_name} — ${opts.store.document_kind.toUpperCase()}: ${maskDoc(opts.store.document)}`
  const docLines = doc.splitTextToSize(docLine, textMaxW)
  doc.text(docLines, textX, ty)
  ty += docLines.length * 3.6 + 1
  const telLine = `Tel: ${opts.store.phone_main}  WhatsApp: ${opts.store.whatsapp_1}${opts.store.whatsapp_2 ? ' / ' + opts.store.whatsapp_2 : ''}`
  const telLines = doc.splitTextToSize(telLine, textMaxW)
  doc.text(telLines, textX, ty)
  ty += telLines.length * 3.6 + 1
  const endLine = `${opts.store.street}, ${opts.store.number}${opts.store.complement ? ' — ' + opts.store.complement : ''} — ${opts.store.district}, ${opts.store.city}/${opts.store.state} — CEP ${opts.store.cep}`
  const endLines = doc.splitTextToSize(endLine, textMaxW)
  doc.text(endLines, textX, ty)
  ty += endLines.length * 3.6

  let hdrY = margin + 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PEDIDO DE VENDA', rightX, hdrY, { align: 'right', maxWidth: RIGHT_COL_W })
  hdrY += 4.5
  doc.setFontSize(11)
  doc.text(opts.orderNumber, rightX, hdrY, { align: 'right', maxWidth: RIGHT_COL_W })
  hdrY += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`${opts.store.city}, ${formatDate(opts.createdAt)}`, rightX, hdrY, { align: 'right', maxWidth: RIGHT_COL_W })
  hdrY += 5
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text(`Status: ${ORDER_STATUS_LABEL[opts.status]}`, rightX, hdrY, { align: 'right', maxWidth: RIGHT_COL_W })
  doc.setTextColor(...INK_RGB)
  hdrY += 5

  y = Math.max(logoBottom, ty + 4, hdrY + 2)
  hLine(doc, y, margin, pageW)
  y += 6

  y = sectionHeading(doc, margin, pageW, y, 'Dados do cliente')
  const yClienteBlock = y
  const c = opts.customer
  const s = opts.shipping
  const colGap = 6
  const colW = (pageW - 2 * margin - colGap) / 2
  const x2 = margin + colW + colGap

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(String(c.full_name ?? ''), margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  let yL = y + 4
  doc.text(`Telefone: ${String(c.phone ?? '')}`, margin, yL)
  yL += 4
  const sec = String(c.phone_secondary ?? '').trim()
  if (sec) {
    doc.text(`Telefone 2: ${sec}`, margin, yL)
    yL += 4
  }
  const addrCliente = [
    `${s.street ?? ''}, ${s.number ?? ''}${s.complement ? ' — ' + String(s.complement) : ''}`,
    `${s.district ?? ''} — ${s.city ?? ''}/${s.state ?? ''} — CEP ${s.cep ?? ''}`,
  ]
  addrCliente.forEach((line) => {
    doc.text(line, margin, yL, { maxWidth: colW - 1 })
    yL += 4
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(String(c.full_name ?? ''), x2, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  let yR = y + 4
  const mail = String(c.email ?? '').trim()
  if (mail) doc.text(`E-mail: ${mail}`, x2, yR)
  else doc.text('E-mail: —', x2, yR)
  yR += 4
  doc.text('Contato principal', x2, yR)
  yR += 4

  doc.setDrawColor(...BORDER_RGB)
  doc.line(margin + colW + colGap / 2, yClienteBlock - 2, margin + colW + colGap / 2, Math.max(yL, yR) + 2)

  y = Math.max(yL, yR) + 6
  hLine(doc, y, margin, pageW)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('Total das mercadorias e serviços', margin, y)
  doc.text('Total dos tributos (referência)', margin + colW + colGap, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const leftFin = [
    ['Produtos / serviços', formatCurrency(subtotalItens)],
    ['Frete', formatCurrency(0)],
    ['Descontos', formatCurrency(0)],
    ['Total do pedido', formatCurrency(opts.total)],
  ]
  let yFin = y
  for (const [k, v] of leftFin) {
    doc.text(k, margin, yFin)
    doc.text(v, margin + colW - 2, yFin, { align: 'right' })
    yFin += 4
  }
  const trib = [
    ['ICMS', formatCurrency(0)],
    ['PIS', formatCurrency(0)],
    ['COFINS', formatCurrency(0)],
    ['IPI', formatCurrency(0)],
  ]
  let yTr = y
  for (const [k, v] of trib) {
    doc.text(k, x2, yTr)
    doc.text(v, pageW - margin - 2, yTr, { align: 'right' })
    yTr += 4
  }
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  doc.text(
    '* Valores tributários meramente indicativos. Discriminação fiscal na NF-e, quando emitida.',
    margin,
    Math.max(yFin, yTr) + 3,
    { maxWidth: pageW - 2 * margin },
  )
  doc.setTextColor(...INK_RGB)
  doc.setFontSize(8)

  y = Math.max(yFin, yTr) + 10
  hLine(doc, y, margin, pageW)
  y += 6

  y = sectionHeading(doc, margin, pageW, y, 'Itens do pedido')

  const body = opts.items.map((it, idx) => {
    const opt = it.options_snapshot ?? {}
    const extra = [opt.color ? `Cor: ${opt.color}` : '', opt.variant ? `Var.: ${opt.variant}` : '']
      .filter(Boolean)
      .join(' | ')
    const desc = extra ? `${it.product_name}\n${extra}` : it.product_name
    const warranty = String(opt.warranty ?? '').trim() || '—'
    return [
      String(idx + 1),
      it.sku,
      desc,
      'UN',
      String(it.quantity),
      formatCurrency(it.unit_price),
      formatCurrency(it.line_total),
      '—',
      warranty,
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['Item', 'Produto', 'Descrição', 'Un.', 'Qtde', 'Preço un.', 'Subtotal', 'Prazo entrega', 'Garantia']],
    body,
    styles: { fontSize: 7, cellPadding: 1.8, textColor: INK_RGB, lineColor: BORDER_RGB, lineWidth: 0.1 },
    headStyles: {
      fillColor: TABLE_HEAD_RGB,
      textColor: INK_RGB,
      fontStyle: 'bold',
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 9 },
      1: { cellWidth: 24 },
      2: { cellWidth: 52 },
      3: { cellWidth: 12 },
      4: { cellWidth: 12 },
      5: { cellWidth: 20 },
      6: { cellWidth: 20 },
      7: { cellWidth: 17 },
      8: { cellWidth: 17 },
    },
    margin: { left: margin, right: margin },
  })

  const d = doc as InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } }
  y = (d.lastAutoTable?.finalY ?? y) + 8

  hLine(doc, y, margin, pageW)
  y += 5
  y = sectionHeading(doc, margin, pageW, y, 'Condições comerciais')

  const pay = paymentLine(opts.paymentKind, opts.paymentDetails)
  const yCond = y
  doc.setFontSize(8)
  let yLeftCond = yCond
  doc.text('• Pagamento:', margin, yLeftCond)
  doc.text(pay, margin + 24, yLeftCond, { maxWidth: colW - 2 })
  yLeftCond += 7
  doc.text('• Frete / entrega: conforme endereço acima (a combinar com a loja).', margin, yLeftCond, {
    maxWidth: colW - 2,
  })
  yLeftCond += 8
  doc.text('• Transportadora: —', margin, yLeftCond)
  yLeftCond += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Parcelas / vencimento', x2, yCond)
  doc.setFont('helvetica', 'normal')
  autoTable(doc, {
    startY: yCond + 4,
    head: [['Data / condição', 'Valor', 'Observação']],
    body: [[`${formatDate(opts.createdAt)} — ${pay}`, formatCurrency(opts.total), 'Pedido catálogo online']],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: TABLE_HEAD_RGB, textColor: INK_RGB, fontStyle: 'bold', fontSize: 7 },
    margin: { left: x2, right: margin },
    tableWidth: colW,
  })

  const d2 = doc as InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } }
  y = Math.max(yLeftCond, (d2.lastAutoTable?.finalY ?? yCond) + 6)

  hLine(doc, y, margin, pageW)
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Observações', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const obsText = opts.notes.trim() || '—'
  const obsLines = doc.splitTextToSize(obsText, pageW - 2 * margin)
  doc.text(obsLines, margin, y)
  y += obsLines.length * 4 + 8

  let lastPage = doc.getNumberOfPages()
  doc.setPage(lastPage)
  let stubTop = pageH - 10 - STUB_H_MM
  if (y + 8 > stubTop - 4) {
    doc.addPage()
    lastPage = doc.getNumberOfPages()
    doc.setPage(lastPage)
    stubTop = pageH - 10 - STUB_H_MM
  }

  if (opts.store.pdf_footer) {
    const footLines = doc.splitTextToSize(opts.store.pdf_footer, pageW - 2 * margin)
    const footH = footLines.length * 3.4
    let footY = stubTop - 3 - footH
    if (footY < y + 2) footY = y + 2
    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    doc.text(footLines, margin, footY)
    doc.setTextColor(...INK_RGB)
    doc.setFontSize(8)
  }

  drawCanhoto(doc, opts, stubTop, margin, pageW)

  doc.save(`${opts.orderNumber}.pdf`)
}
