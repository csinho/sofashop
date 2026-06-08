import { useCallback, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { notifyErr, notifyOk } from '@/lib/notify'
import type { ConnectPayload } from '@/services/whatsappAdminService'

type ConnectionStateResult = {
  state: string | null
  status: string
}

type UseWhatsAppConnectionOptions = {
  onConnected: () => void | Promise<void>
  pollConnectionState: () => Promise<ConnectionStateResult>
  syncProfile: () => Promise<void>
}

export function useWhatsAppConnection({
  onConnected,
  pollConnectionState,
  syncProfile,
}: UseWhatsAppConnectionOptions) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  const applyConnectResult = useCallback(
    async (res: ConnectPayload): Promise<string | null> => {
      if (res.qrBase64) return res.qrBase64

      if (res.qrPayload) {
        try {
          return await QRCode.toDataURL(res.qrPayload, { width: 280, margin: 2, errorCorrectionLevel: 'M' })
        } catch {
          notifyErr('Não foi possível gerar o QR Code. Tente atualizar.')
          return null
        }
      }

      return null
    },
    [],
  )

  const startPolling = useCallback(
    (onPollTick?: () => void) => {
      stopPolling()
      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const res = await pollConnectionState()
            onPollTick?.()
            if (res.status === 'connected') {
              stopPolling()
              await syncProfile()
              await onConnected()
              notifyOk('WhatsApp conectado com sucesso!')
            }
          } catch {
            /* continua polling */
          }
        })()
      }, 3000)
    },
    [onConnected, pollConnectionState, stopPolling, syncProfile],
  )

  return {
    stopPolling,
    applyConnectResult,
    startPolling,
  }
}
