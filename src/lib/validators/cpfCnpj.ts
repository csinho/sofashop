/** Validação de dígitos verificadores — CPF (11) e CNPJ (14), apenas dígitos. */

function cpfCheckDigits(d: number[]): boolean {
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d.join(''))) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += d[i]! * (10 - i)
  let mod = (sum * 10) % 11
  if (mod === 10) mod = 0
  if (mod !== d[9]) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += d[i]! * (11 - i)
  mod = (sum * 10) % 11
  if (mod === 10) mod = 0
  return mod === d[10]
}

function cnpjCheckDigits(d: number[]): boolean {
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d.join(''))) return false

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  let sum = 0
  for (let i = 0; i < 12; i++) sum += d[i]! * w1[i]!
  let mod = sum % 11
  const dv1 = mod < 2 ? 0 : 11 - mod
  if (dv1 !== d[12]) return false

  sum = 0
  for (let i = 0; i < 13; i++) sum += d[i]! * w2[i]!
  mod = sum % 11
  const dv2 = mod < 2 ? 0 : 11 - mod
  return dv2 === d[13]
}

export function validateCpfCnpj(raw: string): { ok: boolean; kind: 'cpf' | 'cnpj' | null; message?: string } {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) {
    const arr = digits.split('').map(Number)
    return cpfCheckDigits(arr)
      ? { ok: true, kind: 'cpf' }
      : { ok: false, kind: 'cpf', message: 'CPF inválido. Verifique os dígitos.' }
  }
  if (digits.length === 14) {
    const arr = digits.split('').map(Number)
    return cnpjCheckDigits(arr)
      ? { ok: true, kind: 'cnpj' }
      : { ok: false, kind: 'cnpj', message: 'CNPJ inválido. Verifique os dígitos.' }
  }
  return {
    ok: false,
    kind: null,
    message: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.',
  }
}
