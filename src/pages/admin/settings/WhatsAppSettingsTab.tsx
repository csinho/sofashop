import { useCallback, useEffect, useRef, useState } from 'react'

import QRCode from 'qrcode'

import { Button } from '@/components/ui/Button'

import { Card } from '@/components/ui/Card'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

import { Textarea } from '@/components/ui/Textarea'

import { cn } from '@/lib/cn'

import { formatBrazilPhoneDisplay, stripBrazilCountryCode } from '@/lib/phoneBr'

import {

  DEFAULT_STATUS_TEMPLATES,

  findUnknownTemplateVariables,

  mergeNotifySettings,

  TEMPLATE_VARIABLES,

  type NotifySettingItem,

} from '@/lib/messageTemplate'

import { ORDER_STATUS_FLOW, ORDER_STATUS_LABEL } from '@/constants/orderStatus'

import { notifyErr, notifyOk } from '@/lib/notify'

import { WhatsAppInstanceCard } from '@/components/whatsapp/WhatsAppInstanceCard'


import {

  fetchWhatsAppInstance,

  whatsappAdminConnect,

  whatsappAdminConnectionState,

  whatsappAdminCreate,

  whatsappAdminDelete,

  whatsappAdminPause,

  whatsappAdminResume,

  whatsappAdminSyncProfile,

  whatsappAdminUpdateNotifySettings,

  whatsappAdminVerifyOrdersPhone,

  type WhatsAppInstanceSafe,

} from '@/services/whatsappAdminService'



type Props = {

  storeId: string

  ordersPhoneDigits: string

  onGoToContact: () => void

}



type ConnectMode = 'qr' | 'pairing'



export function WhatsAppSettingsTab({ storeId, ordersPhoneDigits, onGoToContact }: Props) {

  const [instance, setInstance] = useState<WhatsAppInstanceSafe | null>(null)

  const [loading, setLoading] = useState(true)

  const [creating, setCreating] = useState(false)

  const [connecting, setConnecting] = useState(false)

  const [pausing, setPausing] = useState(false)

  const [deleting, setDeleting] = useState(false)

  const [connectMode, setConnectMode] = useState<ConnectMode>('qr')

  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)

  const [pairingCode, setPairingCode] = useState<string | null>(null)

  const [ordersPhone, setOrdersPhone] = useState<string | null>(null)

  const [notifySettings, setNotifySettings] = useState<Record<string, NotifySettingItem>>(() =>

    mergeNotifySettings(null),

  )

  const [savingNotify, setSavingNotify] = useState(false)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)



  const hasOrdersPhone = stripBrazilCountryCode(ordersPhoneDigits).length >= 10

  const ordersPhoneDisplay = formatBrazilPhoneDisplay(ordersPhoneDigits)



  const load = useCallback(async () => {

    setLoading(true)

    try {

      const row = await fetchWhatsAppInstance(storeId)

      setInstance(row)

      if (row?.notify_settings) {

        setNotifySettings(mergeNotifySettings(row.notify_settings))

      }

    } catch (e) {

      notifyErr(e instanceof Error ? e.message : 'Erro ao carregar WhatsApp')

    } finally {

      setLoading(false)

    }

  }, [storeId])



  useEffect(() => {

    void load()

    return () => {

      if (pollRef.current) clearInterval(pollRef.current)

    }

  }, [load])



  useEffect(() => {

    return () => {

      if (qrImageUrl?.startsWith('blob:')) URL.revokeObjectURL(qrImageUrl)

    }

  }, [qrImageUrl])



  const stopPolling = () => {

    if (pollRef.current) {

      clearInterval(pollRef.current)

      pollRef.current = null

    }

  }



  const applyConnectResult = useCallback(async (res: {

    pairingCode: string | null

    qrBase64: string | null

    qrPayload: string | null

    phone?: string

  }) => {

    setPairingCode(res.pairingCode)

    setOrdersPhone(res.phone ?? null)



    if (res.qrBase64) {

      setQrImageUrl(res.qrBase64)

      return

    }



    if (res.qrPayload) {

      try {

        const url = await QRCode.toDataURL(res.qrPayload, { width: 280, margin: 2, errorCorrectionLevel: 'M' })

        setQrImageUrl(url)

      } catch {

        setQrImageUrl(null)

        notifyErr('Não foi possível gerar o QR Code. Tente atualizar.')

      }

      return

    }



    setQrImageUrl(null)

  }, [])



  const startPolling = useCallback(() => {

    stopPolling()

    pollRef.current = setInterval(() => {

      void (async () => {

        try {

          const res = await whatsappAdminConnectionState(storeId)

          if (res.status === 'connected') {

            stopPolling()

            setQrImageUrl(null)

            setPairingCode(null)

            setConnecting(false)

            await whatsappAdminSyncProfile(storeId)

            await load()

            notifyOk('WhatsApp conectado com sucesso!')

          }

        } catch {

          /* continua polling */

        }

      })()

    }, 3000)

  }, [storeId, load])



  async function handleCreateAndConnect() {

    if (!hasOrdersPhone) {

      notifyErr('Cadastre o WhatsApp principal para pedidos na aba Contato.')

      return

    }



    setCreating(true)

    try {

      if (!instance) {

        await whatsappAdminCreate(storeId)

        await load()

      }

      setConnecting(true)

      const res = await whatsappAdminConnect(storeId)

      await applyConnectResult(res)

      startPolling()

    } catch (e) {

      notifyErr(e instanceof Error ? e.message : 'Falha ao iniciar conexão')

      setConnecting(false)

    } finally {

      setCreating(false)

    }

  }



  async function handlePause() {

    setPausing(true)

    try {

      await whatsappAdminPause(storeId)

      await load()

      notifyOk('Conexão pausada.')

    } catch (e) {

      notifyErr(e instanceof Error ? e.message : 'Falha ao pausar')

    } finally {

      setPausing(false)

    }

  }



  async function handleResume() {

    setConnecting(true)

    try {

      const res = await whatsappAdminResume(storeId)

      await applyConnectResult(res)

      await load()

      startPolling()

    } catch (e) {

      notifyErr(e instanceof Error ? e.message : 'Falha ao retomar')

      setConnecting(false)

    }

  }



  async function confirmDelete() {

    setDeleting(true)

    stopPolling()

    try {

      await whatsappAdminDelete(storeId)

      setInstance(null)

      setQrImageUrl(null)

      setPairingCode(null)

      setConnecting(false)

      setDeleteConfirmOpen(false)

      notifyOk('Instância removida.')

    } catch (e) {

      notifyErr(e instanceof Error ? e.message : 'Falha ao excluir')

    } finally {

      setDeleting(false)

    }

  }



  async function handleSaveNotify() {

    for (const st of ORDER_STATUS_FLOW) {

      const item = notifySettings[st]

      if (!item?.enabled) continue

      const unknown = findUnknownTemplateVariables(item.template)

      if (unknown.length > 0) {

        notifyErr(`Status «${ORDER_STATUS_LABEL[st]}»: variáveis desconhecidas: ${unknown.join(', ')}`)

        return

      }

    }



    setSavingNotify(true)

    try {

      await whatsappAdminUpdateNotifySettings(storeId, notifySettings, window.location.origin)

      notifyOk('Mensagens e notificações salvas.')

      await load()

    } catch (e) {

      notifyErr(e instanceof Error ? e.message : 'Falha ao salvar')

    } finally {

      setSavingNotify(false)

    }

  }



  async function handleVerifyPhone() {

    try {

      const res = await whatsappAdminVerifyOrdersPhone(storeId)

      if (res.exists === true) {

        notifyOk(`O número ${res.phone} possui WhatsApp ativo.`)

      } else if (res.exists === false) {

        notifyErr(`O número ${res.phone} não possui conta WhatsApp ativa.`)

      } else if (res.needsInstance) {

        notifyOk(`Número cadastrado: ${res.phone}. Conecte para validar na Evolution.`)

      }

    } catch (e) {

      notifyErr(e instanceof Error ? e.message : 'Falha ao verificar número')

    }

  }



  if (loading) {

    return <p className="text-sm text-ink-500">Carregando integração WhatsApp…</p>

  }



  const showConnecting =

    connecting ||

    instance?.status === 'connecting' ||

    (instance && instance.status !== 'connected' && instance.status !== 'paused' && (qrImageUrl || pairingCode))



  const showCard = instance && (instance.status === 'connected' || instance.status === 'paused')



  return (

    <div className="space-y-6">

      <Card className="space-y-3">

        <h3 className="font-display text-lg font-semibold">WhatsApp da loja</h3>

        <p className="text-sm text-ink-600">

          Conecte o WhatsApp da sua loja para enviar atualizações automáticas de pedidos aos clientes e receber resumos

          no grupo interno de pedidos. Não sincronizamos contatos nem histórico de mensagens.

        </p>

        {!hasOrdersPhone ? (

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">

            Cadastre o <strong>WhatsApp principal para pedidos</strong> na aba Contato antes de conectar.{' '}

            <button
              type="button"
              className="font-medium underline"
              title="Ir para Configurações → Contato e preencher o WhatsApp de pedidos."
              onClick={onGoToContact}
            >

              Ir para Contato

            </button>

          </div>

        ) : (

          <p className="text-xs text-ink-500">

            Número para conexão: <span className="font-mono">{ordersPhoneDisplay}</span>

            <button
              type="button"
              className="ml-2 text-brand-700 underline"
              title="Verificar se o número informado possui WhatsApp ativo."
              onClick={() => void handleVerifyPhone()}
            >

              Verificar se tem WhatsApp

            </button>

          </p>

        )}

      </Card>



      {!instance && !showConnecting ? (

        <Card className="space-y-4 text-center">

          <p className="text-sm text-ink-600">Nenhuma instância configurada.</p>

          <Button
            type="button"
            loading={creating}
            disabled={!hasOrdersPhone}
            tooltip="Criar a instância e exibir QR ou código para vincular o WhatsApp de pedidos."
            onClick={() => void handleCreateAndConnect()}
          >
            Conectar WhatsApp da loja
          </Button>

        </Card>

      ) : null}



      {showConnecting ? (

        <Card className="space-y-4">

          <h4 className="font-medium text-ink-900">Escaneie o QR ou use o código de pareamento</h4>

          {ordersPhone ? (

            <p className="text-xs text-ink-500">

              Conectando o número <span className="font-mono">{ordersPhone}</span>

            </p>

          ) : null}

          <div className="flex gap-2 rounded-lg border border-ink-200 bg-ink-50 p-1">

            <button

              type="button"

              className={cn(

                'flex-1 rounded-md py-1.5 text-sm font-medium',

                connectMode === 'qr' ? 'bg-white shadow-sm' : 'text-ink-600',

              )}

              title="Conectar escaneando o QR Code no celular."

              onClick={() => setConnectMode('qr')}

            >

              QR Code

            </button>

            <button

              type="button"

              className={cn(

                'flex-1 rounded-md py-1.5 text-sm font-medium',

                connectMode === 'pairing' ? 'bg-white shadow-sm' : 'text-ink-600',

              )}

              title="Conectar digitando o código de pareamento no WhatsApp."

              onClick={() => setConnectMode('pairing')}

            >

              Código

            </button>

          </div>

          {connectMode === 'qr' && qrImageUrl ? (

            <div className="flex justify-center rounded-xl bg-white p-4 ring-1 ring-ink-200">

              <img src={qrImageUrl} alt="QR Code WhatsApp" className="h-64 w-64 object-contain" />

            </div>

          ) : connectMode === 'pairing' && pairingCode ? (

            <div className="rounded-xl bg-ink-900 px-6 py-8 text-center">

              <p className="text-xs uppercase tracking-wide text-ink-400">Código de pareamento</p>

              <p className="mt-2 font-mono text-3xl font-bold tracking-widest text-white">{pairingCode}</p>

            </div>

          ) : (

            <p className="text-sm text-ink-500">Aguardando código…</p>

          )}

          <p className="text-xs text-ink-500">Abra o WhatsApp no celular → Aparelhos conectados → Conectar aparelho.</p>

          <p className="text-xs text-ink-500">

            Após conectar, criamos automaticamente o grupo <strong>Pedidos da loja</strong> para receber resumos dos

            pedidos.

          </p>

          <div className="flex flex-wrap gap-2">

            <Button
              type="button"
              variant="secondary"
              tooltip="Gerar um novo QR ou código de pareamento se o anterior expirou."
              onClick={() => void handleCreateAndConnect()}
            >
              Atualizar QR / código
            </Button>

            <Button
              type="button"
              variant="danger"
              tooltip="Desconectar e remover a instância WhatsApp desta loja."
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Cancelar e excluir
            </Button>

          </div>

        </Card>

      ) : null}



      {showCard && instance ? (

        <WhatsAppInstanceCard

          instance={instance}

          onPause={handlePause}

          onResume={handleResume}

          onDelete={() => setDeleteConfirmOpen(true)}

          pausing={pausing}

          deleting={deleting}

        />

      ) : null}



      {instance ? (

        <Card className="space-y-4">

          <h4 className="font-display text-lg font-semibold">Mensagens ao cliente</h4>

          <p className="text-sm text-ink-600">

            Marque em quais status o cliente recebe WhatsApp e personalize o texto. Use variáveis entre chaves duplas —

            o sistema substitui na hora do envio.

          </p>



          <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-ink-800">

            <p className="font-medium text-brand-900">Variáveis disponíveis</p>

            <ul className="mt-2 list-inside list-disc space-y-1 font-mono text-xs">

              {TEMPLATE_VARIABLES.map((v) => (

                <li key={v}>{`{{${v}}}`}</li>

              ))}

            </ul>

            <p className="mt-2 text-xs text-ink-600">

              Exemplo:{' '}

              <span className="font-mono">

                Olá {'{{NOME_CLIENTE}}'}! Seu pedido {'{{NUMERO_PEDIDO}}'} está: {'{{STATUS_PEDIDO}}'}.

              </span>

            </p>

          </div>



          <ul className="space-y-4">

            {ORDER_STATUS_FLOW.map((st) => {

              const item = notifySettings[st] ?? { enabled: false, template: DEFAULT_STATUS_TEMPLATES[st] ?? '' }

              return (

                <li key={st} className="rounded-lg border border-ink-200 p-3">

                  <label className="flex cursor-pointer items-center gap-2">

                    <input

                      type="checkbox"

                      className="h-4 w-4 rounded border-ink-300 text-brand-600"

                      checked={Boolean(item.enabled)}

                      onChange={(e) =>

                        setNotifySettings((prev) => ({

                          ...prev,

                          [st]: { ...item, enabled: e.target.checked },

                        }))

                      }

                    />

                    <span className="text-sm font-medium text-ink-900">{ORDER_STATUS_LABEL[st]}</span>

                  </label>

                  {item.enabled ? (

                    <div className="mt-3 space-y-1">

                      <Textarea

                        rows={3}

                        value={item.template}

                        placeholder={DEFAULT_STATUS_TEMPLATES[st]}

                        onChange={(e) =>

                          setNotifySettings((prev) => ({

                            ...prev,

                            [st]: { ...item, template: e.target.value },

                          }))

                        }

                      />

                      <p className="text-right text-xs text-ink-400">{item.template.length} caracteres</p>

                    </div>

                  ) : null}

                </li>

              )

            })}

          </ul>

          <Button
            type="button"
            loading={savingNotify}
            tooltip="Salvar quais eventos disparam mensagens automáticas no WhatsApp."
            onClick={() => void handleSaveNotify()}
          >

            Salvar mensagens

          </Button>

        </Card>

      ) : null}



      <ConfirmDialog

        open={deleteConfirmOpen}

        title="Excluir instância WhatsApp"

        description={

          <>

            A instância será removida da Evolution API e desta loja. O grupo de pedidos no WhatsApp será mantido para

            reconexões futuras. Será necessário conectar o WhatsApp novamente para enviar mensagens automáticas.

          </>

        }

        confirmLabel="Sim, excluir"

        cancelLabel="Manter instância"

        busy={deleting}

        onClose={() => {

          if (!deleting) setDeleteConfirmOpen(false)

        }}

        onConfirm={() => void confirmDelete()}

      />

    </div>

  )

}


