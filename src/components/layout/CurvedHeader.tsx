import type { CSSProperties, ReactNode } from 'react'
import styles from './CurvedHeader.module.css'

type CurvedHeaderProps = {
  title: string
  leftSlot?: ReactNode
  rightSlot?: ReactNode
  backgroundImageUrl?: string
  backgroundAlt?: string
  backgroundNode?: ReactNode
  className?: string
  height?: number
  overlayOpacity?: number
  curveSurface?: string
}

export function CurvedHeader({
  title,
  leftSlot,
  rightSlot,
  backgroundImageUrl,
  backgroundAlt = '',
  backgroundNode,
  className,
  height,
  overlayOpacity = 0.22,
  curveSurface = '#fff',
}: CurvedHeaderProps) {
  const merged: CSSProperties = {
    ...(height ? ({ '--header-height': `${height}px` } as CSSProperties) : {}),
    '--header-overlay': `rgba(0, 0, 0, ${Math.max(0, Math.min(overlayOpacity, 1))})`,
    '--curve-surface': curveSurface,
  } as CSSProperties

  return (
    <section className={[styles.root, className].filter(Boolean).join(' ')} style={merged}>
      <div className={styles.background} aria-hidden="true">
        {backgroundNode ? backgroundNode : null}
        {backgroundImageUrl ? <img src={backgroundImageUrl} alt={backgroundAlt} className={styles.backgroundImage} /> : null}
      </div>

      <div className={styles.overlay} aria-hidden="true" />

      <div className={styles.content}>
        <div>{leftSlot}</div>
        <h1 className={styles.title}>{title}</h1>
        <div style={{ justifySelf: 'end' }}>{rightSlot}</div>
      </div>
    </section>
  )
}

