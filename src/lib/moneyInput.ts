import { onlyDigits } from '@/lib/format'

/** Máscara BRL enquanto digita (centavos). */
export function maskMoneyBRL(raw: string): string {
  const d = onlyDigits(raw)
  if (!d) return ''
  const cents = Number(d)
  const v = cents / 100
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function parseMoneyBRL(masked: string): number {
  const d = onlyDigits(masked)
  if (!d) return 0
  return Number(d) / 100
}

/** Formata número já decimal para exibição R$ */
export function formatMoneyFromDecimal(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}
