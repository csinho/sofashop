import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Copy } from 'lucide-react'
import { StoreLogoAvatar } from '@/components/platform/StoreLogoAvatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { formatCurrency, formatDateTime } from '@/lib/format'
import {
  getPlatformStore,
  setStoreActive,
  type PlatformStoreSummary,
} from '@/services/platformService'
import { notifyErr, notifyOk } from '@/lib/notify'
import { StoreToggleConfirmModal } from './StoreToggleConfirmModal'

function catalogPageUrl(slug: string) {
  return `${window.location.origin}/loja/${encodeURIComponent(slug)}`
}

async function copyCatalogPageUrl(slug: string) {
  const url = catalogPageUrl(slug)
  try {
    await navigator.clipboard.writeText(url)
    notifyOk('Link do catálogo copiado para a área de transferência.')
  } catch {
    notifyErr('Não foi possível copiar. Cole manualmente: ' + url)
  }
}

function DetailField({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <div className="mt-1 text-sm text-ink-900">{value}</div>
    </div>
  )
}

export function PlatformStoreDetailPage() {
  const { storeId = '' } = useParams()
  const [row, setRow] = useState<PlatformStoreSummary | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<
    { row: PlatformStoreSummary; willActivate: boolean } | null
  >(null)

  const load = useCallback(async () => {
    if (!storeId) {
      setRow(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const r = await getPlatformStore(storeId)
      setRow(r)
    } catch (e: unknown) {
      setRow(null)
      notifyErr(e instanceof Error ? e.message : 'Não foi possível carregar a loja.')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    void load()
  }, [load])

  async function applyToggle(willActivate: boolean) {
    if (!row) return
    setBusy(true)
    try {
      await setStoreActive(row.id, willActivate)
      setRow((p) => (p ? { ...p, is_active: willActivate } : p))
      notifyOk(willActivate ? 'Loja ativada.' : 'Loja desativada.')
      setConfirm(null)
    } catch (e: unknown) {
      notifyErr(e instanceof Error ? e.message : 'Falha ao alterar status.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-ink-200" />
        <div className="h-64 animate-pulse rounded-2xl bg-ink-200" />
      </div>
    )
  }

  if (!row) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-ink-900">Loja não encontrada</h2>
        <p className="text-sm text-ink-600">Essa loja não existe ou você não tem acesso.</p>
        <Link
          to="/plataforma/lojas"
          className="inline-block text-sm font-medium text-brand-700 hover:underline"
        >
          ← Voltar para a lista
        </Link>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      {confirm ? (
        <StoreToggleConfirmModal
          state={confirm}
          busy={busy}
          onClose={() => {
            if (!busy) setConfirm(null)
          }}
          onConfirm={() => {
            if (confirm) void applyToggle(confirm.willActivate)
          }}
        />
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-ink-500">
            <Link
              to="/plataforma/lojas"
              className="font-medium text-brand-700 hover:underline"
            >
              Lojas cadastradas
            </Link>
            <span className="text-ink-300"> / </span>
            <span>Detalhes</span>
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink-900">{row.trade_name}</h2>
          <p className="mt-1 font-mono text-sm text-ink-500">{row.slug}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void copyCatalogPageUrl(row.slug)}>
            <Copy className="h-4 w-4" />
            Copiar link do catálogo
          </Button>
          <Button
            type="button"
            variant={row.is_active ? 'secondary' : 'primary'}
            loading={busy}
            onClick={() => setConfirm({ row, willActivate: !row.is_active })}
          >
            {row.is_active ? 'Desativar' : 'Ativar'}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-gradient-to-br from-white to-ink-50/40 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <StoreLogoAvatar name={row.trade_name} logoUrl={row.logo_url} size={96} className="!rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
                  row.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-ink-200 text-ink-700',
                )}
              >
                {row.is_active ? 'Loja ativa' : 'Loja inativa'}
              </span>
              <span
                className={cn(
                  'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
                  row.catalog_published
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-ink-100 text-ink-600',
                )}
              >
                {row.catalog_published ? 'Catálogo publicado' : 'Catálogo não publicado'}
              </span>
            </div>
            <p className="mt-3 break-words text-sm text-ink-700">Razão social: {row.legal_name}</p>
            <p className="mt-1 break-all text-sm text-ink-700">Contato: {row.email_contact}</p>
            <p className="mt-1 text-sm text-ink-600">Cadastrada em {formatDateTime(row.created_at)}</p>
            <p className="mt-2 text-xs text-ink-500">URL: {catalogPageUrl(row.slug)}</p>
          </div>
        </div>
      </div>

      <h3 className="font-display text-lg font-semibold text-ink-900">Números e pedidos</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="!p-4">
          <DetailField label="Clientes" value={String(row.customer_count)} />
        </Card>
        <Card className="!p-4">
          <DetailField label="Pedidos (total)" value={String(row.order_count)} />
        </Card>
        <Card className="!p-4">
          <DetailField label="Soma de todos os pedidos" value={formatCurrency(row.orders_total)} />
        </Card>
        <Card className="!p-4">
          <DetailField
            label="Pedidos entregues (valor)"
            value={
              <span>
                {formatCurrency(row.orders_sum_delivered)}
                {row.orders_count_delivered > 0 ? (
                  <span className="text-ink-500"> — {row.orders_count_delivered} pedido(s)</span>
                ) : null}
              </span>
            }
          />
        </Card>
        <Card className="!p-4">
          <DetailField
            label="Em aberto, não entregue (excl. cancelado)"
            value={
              <span>
                {formatCurrency(row.orders_sum_not_delivered)}
                {row.orders_count_not_delivered > 0 ? (
                  <span className="text-ink-500"> — {row.orders_count_not_delivered} pedido(s)</span>
                ) : null}
              </span>
            }
          />
        </Card>
      </div>
    </div>
  )
}
