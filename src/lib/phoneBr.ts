import { onlyDigits } from '@/lib/format'

export const BR_COUNTRY_CODE = '55'

/** Remove o código do país 55 para máscara e validação local (DDD + número). */
export function stripBrazilCountryCode(digits: string): string {
  const d = onlyDigits(digits)
  if (d.startsWith(BR_COUNTRY_CODE) && d.length >= 12) {
    return d.slice(BR_COUNTRY_CODE.length)
  }
  return d
}

/** Persistência e APIs: sempre com 55, sem o usuário digitar. */
export function toBrazilStorageDigits(raw: string): string {
  const local = stripBrazilCountryCode(onlyDigits(raw))
  if (!local) return ''
  return `${BR_COUNTRY_CODE}${local}`
}

/** Máscara (XX) XXXXX-XXXX — nunca exibe o 55. */
export function maskBrazilPhone(value: string): string {
  const d = stripBrazilCountryCode(onlyDigits(value)).slice(0, 11)
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{4})$/, '$1-$2')
}

/** Exibe valor do banco (com ou sem 55, mascarado ou só dígitos). */
export function formatBrazilPhoneDisplay(stored: string): string {
  const trimmed = stored.trim()
  if (!trimmed) return ''
  return maskBrazilPhone(trimmed)
}
