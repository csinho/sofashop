/** Trial, ciclo e fallback do plano SaaS (espelha SQL e spec billing). */
export const BILLING_TRIAL_DAYS = 7
export const BILLING_CYCLE_DAYS = 30
export const BILLING_PLAN_VALUE_CENTS = 3990
/** Janela em dias antes do vencimento em que o botão Gerar PIX aparece */
export const BILLING_PIX_WINDOW_DAYS = 5

export type BillingStatus = 'trial' | 'ativo' | 'pendente' | 'inadimplente'

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  trial: 'Período de teste',
  ativo: 'Plano em dia',
  pendente: 'Pagamento pendente',
  inadimplente: 'Inadimplente',
}
