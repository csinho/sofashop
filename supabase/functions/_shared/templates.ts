const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  em_producao: 'Em produção',
  pronto_entrega: 'Pronto para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export function buildOrderStatusMessage(opts: {
  customerName: string
  orderNumber: string
  storeName: string
  status: string
}) {
  const label = STATUS_LABELS[opts.status] ?? opts.status
  return `Olá ${opts.customerName}! Seu pedido #${opts.orderNumber} na ${opts.storeName} foi atualizado para: ${label}.`
}

export function phoneToEvolutionNumber(digits: string) {
  const d = digits.replace(/\D/g, '')
  if (d.startsWith('55')) return d
  return `55${d}`
}
