/** Permite apenas dígitos e uma vírgula decimal (pt-BR), com limite de casas. */
export function sanitizeDecimalPtBr(raw: string, maxDecimals = 2): string {
  let s = raw.replace(/[^\d,]/g, '')
  const firstComma = s.indexOf(',')
  if (firstComma !== -1) {
    const head = s.slice(0, firstComma + 1)
    let tail = s.slice(firstComma + 1).replace(/,/g, '')
    if (tail.length > maxDecimals) tail = tail.slice(0, maxDecimals)
    s = head + tail
  }
  return s
}

export function parseDecimalPtBr(s: string): number {
  if (!s.trim()) return 0
  return Number(s.replace(',', '.')) || 0
}
