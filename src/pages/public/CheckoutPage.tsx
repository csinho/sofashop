import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { maskCep, maskPhone } from '@/lib/masks'
import { onlyDigits } from '@/lib/format'
import { toBrazilStorageDigits } from '@/lib/phoneBr'
import { validateBrazilPhone } from '@/lib/validators/phone'
import { fetchAddressByCep } from '@/integrations/viacep'
import { useCart } from '@/contexts/CartContext'
import { resolveCatalogCustomer, submitCheckout, type ResolvedCatalogCustomer } from '@/services/checkoutService'
import { loadCheckoutIdentity, saveCheckoutIdentity } from '@/lib/catalogCheckoutStorage'
import type { PaymentKind } from '@/types/database'
import type { CatalogOutletCtx } from '@/pages/public/catalogTypes'
import { formatCurrency } from '@/lib/format'
import { resolveCheckoutConfig } from '@/lib/checkoutConfig'
import { MoneyField } from '@/components/ui/MoneyField'
import { parseMoneyBRL } from '@/lib/moneyInput'
import { PAYMENT_LABEL } from '@/constants/payments'
import { IntegerField } from '@/components/ui/IntegerField'
import { notifyOk } from '@/lib/notify'
import { checkPhoneHasWhatsApp } from '@/services/whatsappCheckService'
import { getCheckoutErrorMessage } from '@/lib/checkoutError'
import { notifyCheckoutOrderWhatsApp } from '@/services/whatsappSendService'
import { CreditInstallmentPicker } from '@/components/checkout/CreditInstallmentPicker'
import { creditCardInstallmentQuote, formatPercentBr } from '@/lib/creditCardInstallments'
import { fetchCartPriceChanges, type CartPriceChange } from '@/services/cartPriceValidation'
import { CartPriceChangeDialog } from '@/components/cart/CartPriceChangeDialog'

export function CheckoutPage() {
  const { store, slug } = useOutletContext<CatalogOutletCtx>()
  const nav = useNavigate()
  const { lines, subtotal, clear, updateLinePrices } = useCart()
  const storeLines = lines.filter((l) => l.storeId === store.id)
  const priceAcceptedRef = useRef(false)
  const [priceChanges, setPriceChanges] = useState<CartPriceChange[] | null>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneSecondary, setPhoneSecondary] = useState('')
  const [cep, setCep] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [district, setDistrict] = useState('')
  const [city, setCity] = useState('')
  const [stateUf, setStateUf] = useState('SP')
  const [notes, setNotes] = useState('')

  const [payKind, setPayKind] = useState<PaymentKind>('pix')
  const [creditInstallments, setCreditInstallments] = useState(1)
  const [installments, setInstallments] = useState('6')
  const [down, setDown] = useState('')

  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [phoneWaChecking, setPhoneWaChecking] = useState(false)
  const [phoneWaInvalid, setPhoneWaInvalid] = useState(false)

  const payCfg = useMemo(() => resolveCheckoutConfig(store), [store.id, store.checkout_payment_config])

  const creditQuote = useMemo(() => {
    if (payKind !== 'cartao_credito') return null
    return creditCardInstallmentQuote(subtotal, creditInstallments)
  }, [payKind, subtotal, creditInstallments])

  const checkoutTotal = creditQuote?.total ?? subtotal

  const applyResolved = useCallback((r: ResolvedCatalogCustomer) => {
    setFullName(r.full_name)
    setPhone(maskPhone(r.phone))
    setPhoneSecondary(r.phone_secondary ? maskPhone(r.phone_secondary) : '')
    setCep(maskCep(r.cep))
    setStreet(r.street)
    setNumber(r.number)
    setComplement(r.complement)
    setDistrict(r.district)
    setCity(r.city)
    setStateUf((r.state || 'SP').slice(0, 2).toUpperCase())
  }, [])

  useEffect(() => {
    let cancelled = false
    const saved = loadCheckoutIdentity(store.id)
    if (saved) {
      setFullName(saved.fullName)
      setPhone(maskPhone(saved.phone))
      setPhoneSecondary(saved.phoneSecondary ? maskPhone(saved.phoneSecondary) : '')
      setCep(maskCep(saved.cep))
      setStreet(saved.street)
      setNumber(saved.number)
      setComplement(saved.complement)
      setDistrict(saved.district)
      setCity(saved.city)
      setStateUf((saved.state || 'SP').slice(0, 2).toUpperCase())
    }
    if (saved?.customerId) {
      void (async () => {
        try {
          const r = await resolveCatalogCustomer(store.id, { customerId: saved.customerId })
          if (cancelled || !r) return
          applyResolved(r)
        } catch {
          /* rede indisponível: mantém dados do armazenamento local */
        }
      })()
    }
    return () => {
      cancelled = true
    }
  }, [store.id, applyResolved])

  useEffect(() => {
    if (!payCfg.accepted_methods.includes(payKind)) {
      setPayKind(payCfg.accepted_methods[0] ?? 'pix')
    }
  }, [store.id, payCfg, payKind])

  const tryValidateWhatsApp = useCallback(async () => {
    const pv = validateBrazilPhone(phone)
    if (!pv.ok) {
      setPhoneWaInvalid(false)
      return
    }
    setPhoneWaChecking(true)
    setPhoneWaInvalid(false)
    try {
      const res = await checkPhoneHasWhatsApp(slug, toBrazilStorageDigits(phone))
      if (res.skipped === false && !res.exists) {
        setPhoneWaInvalid(true)
      }
    } catch {
      /* rede/API indisponível: não bloqueia checkout */
    } finally {
      setPhoneWaChecking(false)
    }
  }, [slug, phone])

  const tryResolveByPhone = useCallback(async () => {
    const pv = validateBrazilPhone(phone)
    if (!pv.ok) return
    try {
      const r = await resolveCatalogCustomer(store.id, { phone: toBrazilStorageDigits(phone) })
      if (r) applyResolved(r)
    } catch {
      /* silencioso */
    }
    await tryValidateWhatsApp()
  }, [store.id, phone, applyResolved, tryValidateWhatsApp])

  async function onCepBlur() {
    const c = onlyDigits(cep)
    if (c.length !== 8) return
    try {
      const a = await fetchAddressByCep(c)
      setStreet(a.logradouro || '')
      setDistrict(a.bairro || '')
      setCity(a.localidade || '')
      setStateUf(a.uf || 'SP')
    } catch {
      setErr('CEP inválido ou não encontrado.')
    }
  }

  const executeCheckout = useCallback(async () => {
    const secTrim = phoneSecondary.trim()
    const paymentDetails: Record<string, number> = {}
    if (payKind === 'cartao_credito') {
      const q = creditCardInstallmentQuote(subtotal, creditInstallments)
      paymentDetails.installments = q.installments
      paymentDetails.fee_percent = q.percent
      paymentDetails.fee_amount = q.feeAmount
    }
    if (payKind === 'parcelado') {
      paymentDetails.installments = Math.max(2, Number(installments.replace(/\D/g, '')) || 2)
    }
    if (payKind === 'entrada_parcelado') {
      const dp = parseMoneyBRL(down)
      if (dp <= 0) {
        setErr('Informe o valor da entrada.')
        return
      }
      paymentDetails.down_payment = dp
      paymentDetails.installments = Math.max(2, Number(installments.replace(/\D/g, '')) || 2)
    }

    setLoading(true)
    try {
      const changes = await fetchCartPriceChanges(store.id, storeLines)
      if (changes.length && !priceAcceptedRef.current) {
        setPriceChanges(changes)
        return
      }

      const result = await submitCheckout({
        storeId: store.id,
        customer: {
          full_name: fullName.trim(),
          phone,
          ...(secTrim ? { phone_secondary: phoneSecondary } : {}),
        },
        shipping: {
          cep: onlyDigits(cep),
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          district: district.trim(),
          city: city.trim(),
          state: stateUf,
        },
        paymentKind: payKind,
        paymentDetails,
        notes,
        lines: storeLines,
      })

      notifyOk('Pedido registrado! Você receberá a confirmação no WhatsApp.')
      if (result.order_id) {
        void notifyCheckoutOrderWhatsApp(store.id, result.order_id)
      }
      saveCheckoutIdentity(store.id, {
        customerId: result.customer_id || null,
        fullName: fullName.trim(),
        phone,
        phoneSecondary: secTrim ? phoneSecondary : '',
        cep: onlyDigits(cep),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim(),
        district: district.trim(),
        city: city.trim(),
        state: stateUf,
      })
      clear()
      nav(`/loja/${slug}/obrigado`, {
        state: { orderNumber: result.order_number },
      })
    } catch (e: unknown) {
      setErr(getCheckoutErrorMessage(e))
    } finally {
      setLoading(false)
      priceAcceptedRef.current = false
    }
  }, [
    store.id,
    storeLines,
    subtotal,
    payKind,
    creditInstallments,
    installments,
    down,
    fullName,
    phone,
    phoneSecondary,
    cep,
    street,
    number,
    complement,
    district,
    city,
    stateUf,
    notes,
    slug,
    clear,
    nav,
  ])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    priceAcceptedRef.current = false
    if (storeLines.length === 0) {
      setErr('Seu carrinho está vazio.')
      return
    }
    const pv = validateBrazilPhone(phone)
    if (!pv.ok) {
      setErr(pv.message ?? 'Telefone inválido')
      return
    }
    if (phoneWaInvalid) {
      setErr('Este número não possui WhatsApp ativo. Informe um número válido.')
      return
    }
    const secTrim = phoneSecondary.trim()
    if (secTrim) {
      const pv2 = validateBrazilPhone(phoneSecondary)
      if (!pv2.ok) {
        setErr(pv2.message ?? 'Telefone alternativo inválido')
        return
      }
    }

    await executeCheckout()
  }

  function onAcceptPriceChanges() {
    if (!priceChanges?.length) return
    updateLinePrices(priceChanges.map((c) => ({ key: c.key, unitPrice: c.newPrice })))
    priceAcceptedRef.current = true
    setPriceChanges(null)
    void executeCheckout()
  }

  function onRejectPriceChanges() {
    setPriceChanges(null)
    priceAcceptedRef.current = false
    nav(`/loja/${slug}/carrinho`)
  }

  if (storeLines.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-ink-600">Não há itens no carrinho para esta loja.</p>
        <Link className="mt-4 inline-block text-brand-700" to={`/loja/${slug}`}>
          Voltar ao catálogo
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 lg:max-w-5xl">
      <h1 className="font-display text-3xl font-semibold text-[var(--cat-primary)]">Checkout</h1>
      <p className="mt-1 text-sm text-ink-600">Preencha seus dados e a forma de pagamento. O pedido será salvo e você será direcionado ao WhatsApp.</p>

      <CartPriceChangeDialog
        open={priceChanges != null && priceChanges.length > 0}
        changes={priceChanges ?? []}
        busy={loading}
        onAccept={onAcceptPriceChanges}
        onReject={onRejectPriceChanges}
      />

      <form className="mt-8 space-y-6" onSubmit={onSubmit}>
        <Card className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Seus dados</h2>
          <p className="text-xs text-ink-500">
            Se você já comprou neste navegador, seus dados podem ser preenchidos automaticamente. Ao informar o telefone, buscamos seu cadastro na loja para
            completar nome e endereço — você pode alterar qualquer campo.
          </p>
          <div>
            <label className="text-xs font-medium text-ink-600">Nome completo</label>
            <Input
              className="mt-1"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => void tryResolveByPhone()}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Telefone / WhatsApp</label>
            <Input
              className="mt-1"
              value={phone}
              onChange={(e) => {
                setPhone(maskPhone(e.target.value))
                setPhoneWaInvalid(false)
              }}
              onBlur={() => void tryResolveByPhone()}
              required
            />
            {phoneWaChecking ? (
              <p className="mt-1 text-xs text-ink-500">Verificando WhatsApp…</p>
            ) : phoneWaInvalid ? (
              <p className="mt-1 text-xs text-red-600">Este número não possui WhatsApp ativo.</p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Outro telefone (opcional)</label>
            <p className="mt-0.5 text-xs text-ink-500">Caso não consigamos falar pelo número principal.</p>
            <Input
              className="mt-1"
              value={phoneSecondary}
              onChange={(e) => setPhoneSecondary(maskPhone(e.target.value))}
            />
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Endereço de entrega</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-ink-600">CEP</label>
              <Input className="mt-1" value={cep} onChange={(e) => setCep(maskCep(e.target.value))} onBlur={onCepBlur} required />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">UF</label>
              <Input className="mt-1" maxLength={2} value={stateUf} onChange={(e) => setStateUf(e.target.value.toUpperCase())} required />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Rua</label>
            <Input className="mt-1" value={street} onChange={(e) => setStreet(e.target.value)} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-ink-600">Número</label>
              <Input className="mt-1" value={number} onChange={(e) => setNumber(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">Complemento</label>
              <Input className="mt-1" value={complement} onChange={(e) => setComplement(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Bairro</label>
            <Input className="mt-1" value={district} onChange={(e) => setDistrict(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Cidade</label>
            <Input className="mt-1" value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Pagamento</h2>
          <Select
            value={payKind}
            onChange={(e) => {
              const next = e.target.value as PaymentKind
              setPayKind(next)
              if (next === 'cartao_credito') setCreditInstallments(1)
            }}
          >
            {payCfg.accepted_methods.map((k) => (
              <option key={k} value={k}>
                {PAYMENT_LABEL[k]}
              </option>
            ))}
          </Select>
          {payKind === 'cartao_credito' ? (
            <CreditInstallmentPicker
              subtotal={subtotal}
              selected={creditInstallments}
              onSelect={setCreditInstallments}
            />
          ) : null}
          {payKind === 'parcelado' && payCfg.card_fee_credit_percent > 0 ? (
            <p className="text-xs text-ink-500">
              Taxa estimada da maquinha (parcelado): {payCfg.card_fee_credit_percent}% — valor informativo para o fechamento do pedido.
            </p>
          ) : null}
          {payKind === 'cartao_debito' && payCfg.card_fee_debit_percent > 0 ? (
            <p className="text-xs text-ink-500">Taxa estimada da maquinha (débito): {payCfg.card_fee_debit_percent}%.</p>
          ) : null}
          {payKind === 'parcelado' || payKind === 'entrada_parcelado' ? (
            <div>
              <label className="text-xs font-medium text-ink-600">Parcelas (mín. 2)</label>
              <IntegerField
                className="mt-1"
                min={2}
                value={installments}
                onValueChange={(d) => setInstallments(d ? String(Math.max(2, Number(d) || 2)) : '2')}
              />
            </div>
          ) : null}
          {payKind === 'entrada_parcelado' ? (
            <div>
              <label className="text-xs font-medium text-ink-600">Valor da entrada</label>
              <MoneyField className="mt-1" value={down} onValueChange={(m) => setDown(m)} />
            </div>
          ) : null}
        </Card>

        <Card>
          <label className="text-xs font-medium text-ink-600">Observações do pedido</label>
          <Textarea className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </Card>

        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {creditQuote ? (
              <div className="space-y-1">
                <p className="text-sm text-ink-600">
                  Subtotal <span className="font-medium text-ink-800">{formatCurrency(subtotal)}</span>
                  {' · '}
                  Taxa ({formatPercentBr(creditQuote.percent)}){' '}
                  <span className="font-medium text-ink-800">{formatCurrency(creditQuote.feeAmount)}</span>
                </p>
                <p className="text-sm text-ink-600">Total a pagar</p>
                <p className="text-2xl font-bold" style={{ color: '#000000' }}>
                  {formatCurrency(checkoutTotal)}
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-ink-600">Total</p>
                <p className="text-2xl font-bold" style={{ color: '#000000' }}>
                  {formatCurrency(checkoutTotal)}
                </p>
              </>
            )}
          </div>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <Button
            type="submit"
            variant="catalog"
            loading={loading}
            tooltip="Registrar o pedido na loja. Se algum preço mudou, você precisará confirmar antes."
            className="bg-[var(--cat-primary)] px-8 py-3 hover:opacity-95 focus-visible:outline-[var(--cat-primary)]"
          >
            Enviar pedido
          </Button>
        </Card>
      </form>
    </div>
  )
}
