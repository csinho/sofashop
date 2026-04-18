import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'

type Props = {
  label?: string
  value: string
  onChange: (hex: string) => void
  className?: string
  id?: string
}

/** Hex (#RRGGBB) com seletor nativo + campo texto. */
export function ColorField({ label, value, onChange, className, id }: Props) {
  const safe = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#334155'
  return (
    <div className={cn('flex flex-wrap items-end gap-2', className)}>
      {label ? (
        <label className="w-full text-xs font-medium text-ink-600" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <input
        id={id}
        type="color"
        aria-label={label ?? 'Cor'}
        className="h-11 w-14 cursor-pointer rounded-xl border border-ink-200 bg-white p-1 shadow-sm"
        value={safe}
        onChange={(e) => onChange(e.target.value)}
      />
      <Input
        className="max-w-[120px] font-mono text-sm"
        value={value}
        onChange={(e) => {
          let v = e.target.value.trim()
          if (!v.startsWith('#')) v = '#' + v.replace(/^#/, '')
          if (v.length <= 7) onChange(v)
        }}
        placeholder="#334155"
        spellCheck={false}
      />
    </div>
  )
}
