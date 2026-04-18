import { onlyDigits } from '@/lib/format'

/** Celular BR: DDD + 9 dígitos (com 9 na frente) ou fixo 8 dígitos após DDD */
export function validateBrazilPhone(raw: string): { ok: boolean; message?: string } {
  const d = onlyDigits(raw)
  if (d.length < 10 || d.length > 11) {
    return { ok: false, message: 'Telefone deve ter DDD + número (10 ou 11 dígitos).' }
  }
  const ddd = Number.parseInt(d.slice(0, 2), 10)
  if (ddd < 11 || ddd > 99) {
    return { ok: false, message: 'DDD inválido.' }
  }
  if (d.length === 11 && d[2] !== '9') {
    return { ok: false, message: 'Celular deve começar com 9 após o DDD.' }
  }
  return { ok: true }
}

export function normalizeBrazilPhone(raw: string) {
  return onlyDigits(raw)
}
