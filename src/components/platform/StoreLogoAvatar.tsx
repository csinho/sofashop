import { useState } from 'react'
import { normalizeStoreLogoUrl } from '@/lib/storeImageUrl'

type Props = { name: string; logoUrl: string | null; size?: number; className?: string }

export function StoreLogoAvatar({ name, logoUrl, size = 40, className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const resolved = normalizeStoreLogoUrl(logoUrl)
  const s = { width: size, height: size, minWidth: size, minHeight: size } as const
  const label = (name || '?').trim().charAt(0).toUpperCase() || '?'

  if (resolved && !failed) {
    return (
      <img
        src={resolved}
        alt=""
        style={s}
        className={`shrink-0 rounded-xl border border-ink-100 object-cover ${className}`.trim()}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        loading="lazy"
        decoding="async"
      />
    )
  }
  return (
    <div
      style={s}
      className={`flex shrink-0 items-center justify-center rounded-xl border border-ink-200 bg-gradient-to-br from-ink-100 to-ink-200 font-display text-sm font-bold text-ink-600 ${className}`.trim()}
      aria-hidden
    >
      {label}
    </div>
  )
}
