import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy } from 'lucide-react'
import { StoreLogoAvatar } from '@/components/platform/StoreLogoAvatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ListPaginationBar } from '@/components/ui/ListPaginationBar'
import { useListPagination } from '@/hooks/useListPagination'
import { cn } from '@/lib/cn'
import { formatCurrency } from '@/lib/format'
import { listPlatformStores, setStoreActive, type PlatformStoreSummary } from '@/services/platformService'
import { notifyErr, notifyOk } from '@/lib/notify'
import { StoreToggleConfirmModal, type StoreToggleConfirmState } from './StoreToggleConfirmModal'

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

export function PlatformStoresPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<PlatformStoreSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<StoreToggleConfirmState | null>(null)
  const confirmBusy = confirm != null && busyId === confirm.row.id

  const { pageItems: pageRows, page, setPage, pageCount, showPagination, total } = useListPagination(rows)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listPlatformStores()
      setRows(data)
    } catch (e: unknown) {
      notifyErr(e instanceof Error ? e.message : 'Não foi possível carregar as lojas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function applyToggle(row: PlatformStoreSummary, willActivate: boolean) {
    setBusyId(row.id)
    try {
      await setStoreActive(row.id, willActivate)
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: willActivate } : r)))
      notifyOk(willActivate ? 'Loja ativada.' : 'Loja desativada.')
      setConfirm(null)
    } catch (e: unknown) {
      notifyErr(e instanceof Error ? e.message : 'Falha ao alterar status.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-ink-200" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-ink-200" />
        <div className="h-64 animate-pulse rounded-2xl bg-ink-200" />
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-gradient-to-br from-white via-ink-50/40 to-brand-50/20 p-5 shadow-sm sm:p-7">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Lojas cadastradas</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
          Toque ou clique em uma loja para ver contatos, totais e pedidos. Aqui fica um resumo rápido.
        </p>
      </div>

      {confirm ? (
        <StoreToggleConfirmModal
          state={confirm}
          busy={confirmBusy}
          onClose={() => {
            if (!confirmBusy) setConfirm(null)
          }}
          onConfirm={() => {
            if (confirm) void applyToggle(confirm.row, confirm.willActivate)
          }}
        />
      ) : null}

      <div className="md:hidden">
        {pageRows.map((r) => (
          <Card
            key={r.id}
            className="mb-3 overflow-hidden border-ink-200/80 p-0 shadow-sm transition hover:border-brand-200 hover:shadow-md"
          >
            <div
              className="w-full cursor-pointer border-b border-ink-100 bg-ink-50/40 px-4 py-3 text-left"
              onClick={() => navigate(`/plataforma/lojas/${r.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/plataforma/lojas/${r.id}`)
                }
              }}
              role="link"
              tabIndex={0}
            >
              <div className="flex items-start gap-3">
                <StoreLogoAvatar name={r.trade_name} logoUrl={r.logo_url} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-ink-900">{r.trade_name}</p>
                  <p className="text-xs text-ink-500">{r.slug}</p>
                  <p className="mt-1 line-clamp-1 break-all text-xs text-ink-600">{r.email_contact}</p>
                  <p className="mt-1 text-sm font-medium text-ink-800">{formatCurrency(r.orders_total)}</p>
                </div>
                <span
                  className={cn(
                    'shrink-0 self-start rounded-full px-2.5 py-0.5 text-xs font-medium',
                    r.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-ink-200 text-ink-700',
                  )}
                >
                  {r.is_active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 px-3 py-2.5">
              <Button
                type="button"
                variant="secondary"
                className="!gap-2 !text-xs"
                onClick={() => void copyCatalogPageUrl(r.slug)}
              >
                <Copy className="h-3.5 w-3.5 shrink-0" />
                Copiar link
              </Button>
              <Button
                type="button"
                className="!text-xs"
                variant={r.is_active ? 'secondary' : 'primary'}
                loading={busyId === r.id}
                onClick={() => setConfirm({ row: r, willActivate: !r.is_active })}
              >
                {r.is_active ? 'Desativar' : 'Ativar'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="hidden w-full p-0 md:block">
        <div className="w-full">
          <table className="w-full table-fixed text-left text-sm">
            <caption className="sr-only">Lista de lojas da plataforma</caption>
            <thead>
              <tr className="border-b border-ink-200 bg-gradient-to-r from-ink-100/90 to-ink-50/80 text-xs font-semibold uppercase tracking-wide text-ink-600">
                <th className="w-14 pl-3 pr-1 py-3.5" />
                <th className="min-w-0 py-3.5 pl-0 pr-2 [width:32%]">Loja</th>
                <th className="min-w-0 py-3.5 pl-0 pr-2 [width:32%]">Contato</th>
                <th className="w-28 py-3.5 pr-2 text-right [width:14%]">Soma</th>
                <th className="w-24 py-3.5 pr-2 [width:12%]">Status</th>
                <th className="w-44 py-3.5 pr-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {pageRows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer bg-white transition hover:bg-ink-50/40"
                  onClick={() => navigate(`/plataforma/lojas/${r.id}`)}
                >
                  <td className="px-3 py-2.5 align-middle">
                    <StoreLogoAvatar name={r.trade_name} logoUrl={r.logo_url} size={40} />
                  </td>
                  <td className="min-w-0 max-w-0 py-2.5 pl-0 pr-1 align-top">
                    <p className="truncate font-semibold text-ink-900">{r.trade_name}</p>
                    <p className="truncate font-mono text-xs text-ink-500" title={r.slug}>
                      {r.slug}
                    </p>
                  </td>
                  <td className="min-w-0 max-w-0 truncate py-2.5 pl-0 pr-1 text-xs text-ink-600 align-top">
                    {r.email_contact}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pl-0 pr-2 text-right text-sm font-medium tabular-nums text-ink-900 align-top">
                    {formatCurrency(r.orders_total)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pl-0 pr-1 align-top">
                    <span
                      className={cn(
                        'inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-medium',
                        r.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-ink-200 text-ink-700',
                      )}
                    >
                      {r.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td
                    className="whitespace-nowrap py-2.5 pl-0 pr-3 text-right align-top"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <div className="inline-flex flex-col items-stretch justify-end gap-1.5 sm:inline-flex sm:flex-row sm:items-center">
                      <Button
                        type="button"
                        variant="secondary"
                        className="!px-2.5 !py-1.5 !text-xs"
                        onClick={() => void copyCatalogPageUrl(r.slug)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </Button>
                      <Button
                        type="button"
                        variant={r.is_active ? 'secondary' : 'primary'}
                        className="!px-2.5 !py-1.5 !text-xs"
                        loading={busyId === r.id}
                        onClick={() => setConfirm({ row: r, willActivate: !r.is_active })}
                      >
                        {r.is_active ? 'Desativar' : 'Ativar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ListPaginationBar
        show={showPagination}
        page={page}
        pageCount={pageCount}
        total={total}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
        itemSingular="loja"
        itemPlural="lojas"
        ariaLabel="Paginação da lista de lojas"
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 bg-white/60 px-4 py-6 text-center text-sm text-ink-600">
          Nenhuma loja cadastrada ainda.
        </p>
      ) : null}

      <p className="text-sm text-ink-600">
        <Link to="/" className="font-medium text-brand-700 hover:underline">
          Voltar ao início
        </Link>
      </p>
    </div>
  )
}
