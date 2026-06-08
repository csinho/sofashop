import { useEffect, useRef } from 'react'
import QRCodeStyling from 'qr-code-styling'
import { BRAND_ASSETS } from '@/lib/brandAssets'

const PIX_QR_SIZE = 280

type PixQrCodeProps = {
  brCode: string
}

/**
 * QR PIX estilizado a partir do brCode (payload EMV).
 * A imagem da Woovi não é customizável — geramos o nosso com qr-code-styling.
 */
export function PixQrCode({ brCode }: PixQrCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !brCode) return

    el.replaceChildren()

    const qr = new QRCodeStyling({
      width: PIX_QR_SIZE,
      height: PIX_QR_SIZE,
      type: 'svg',
      data: brCode,
      image: BRAND_ASSETS.icon,
      qrOptions: {
        typeNumber: 0,
        mode: 'Byte',
        // Logo no centro exige correção alta para o PIX continuar legível.
        errorCorrectionLevel: 'H',
      },
      dotsOptions: {
        color: '#c2410c',
        type: 'rounded',
      },
      cornersSquareOptions: {
        color: '#9a3412',
        type: 'extra-rounded',
      },
      cornersDotOptions: {
        color: '#ea580c',
      },
      backgroundOptions: {
        color: '#ffffff',
      },
      imageOptions: {
        crossOrigin: 'anonymous',
        margin: 6,
        imageSize: 0.32,
      },
    })

    qr.append(el)

    return () => {
      el.replaceChildren()
    }
  }, [brCode])

  return (
    <div
      ref={containerRef}
      className="mx-auto w-fit rounded-xl bg-white p-3 shadow-sm ring-1 ring-ink-200"
      aria-label="QR Code PIX"
    />
  )
}
