import type { OrderStatus } from '@/types/database'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  novo: 'Novo',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  em_producao: 'Em produção',
  pronto_entrega: 'Pronto para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'novo',
  'em_analise',
  'aprovado',
  'em_producao',
  'pronto_entrega',
  'entregue',
  'cancelado',
]
