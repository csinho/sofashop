import type { CSSProperties, ReactNode } from 'react'
import styles from './CurvedHeaderSvg.module.css'

type CurvedHeaderSvgProps = {
  title: string
  leftSlot?: ReactNode
  rightSlot?: ReactNode
  backgroundImageUrl?: string
  backgroundAlt?: string
  height?: number
  overlayOpacity?: number
  curveSurface?: string
}

export function CurvedHeaderSvg({
  title,
  leftSlot,
  rightSlot,
  backgroundImageUrl,
  backgroundAlt = '',
  height,
  overlayOpacity = 0.22,
  curveSurface = '#fff',
}: CurvedHeaderSvgProps) {
  const cssVars: CSSProperties = {
    ...(height ? ({ '--header-height': `${height}px` } as CSSProperties) : {}),
    '--header-overlay': `rgba(0, 0, 0, ${Math.max(0, Math.min(overlayOpacity, 1))})`,
  } as CSSProperties

  return (
    <section className={styles.root} style={cssVars}>
      <div className={styles.bg}>{backgroundImageUrl ? <img src={backgroundImageUrl} alt={backgroundAlt} className={styles.img} /> : null}</div>
      <div className={styles.overlay} />
      <div className={styles.content}>
        <div>{leftSlot}</div>
        <h1 className={styles.title}>{title}</h1>
        <div style={{ justifySelf: 'end' }}>{rightSlot}</div>
      </div>
      <svg className={styles.curveSvg} viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,0 L100,0 L100,9 C75,20 25,20 0,9 Z" fill={curveSurface} />
      </svg>
    </section>
  )
}

