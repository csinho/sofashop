const TZ = 'America/Sao_Paulo'

export function formatDateBrt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatDateTimeBrt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Dias até a data (BRT, arredondado para cima). */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const target = new Date(iso)
  const now = new Date()
  const diffMs = target.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export function todayBrtDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

export function monthStartBrt(): string {
  const d = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${y}-${m}-01`
}

export function monthEndBrt(): string {
  const d = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d)
  const y = Number(parts.find((p) => p.type === 'year')?.value ?? 2026)
  const m = Number(parts.find((p) => p.type === 'month')?.value ?? 1)
  const last = new Date(y, m, 0)
  return last.toISOString().slice(0, 10)
}
