import { useState, type FormEvent } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { ColorField } from '@/components/ui/ColorField'
import { maskCep, maskCpfCnpj, maskPhone } from '@/lib/masks'
import { onlyDigits } from '@/lib/format'
import { validateCpfCnpj } from '@/lib/validators/cpfCnpj'
import { fetchAddressByCep } from '@/integrations/viacep'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { useMyStore } from '@/hooks/useMyStore'
import { notifyErr, notifyOk } from '@/lib/notify'
import type { AdminOutletCtx } from '@/pages/admin/adminOutlet'

export function SettingsPage() {
  const { store } = useOutletContext<AdminOutletCtx>()
  const { refresh } = useMyStore()

  const [tradeName, setTradeName] = useState(store.trade_name)
  const [legalName, setLegalName] = useState(store.legal_name)
  const [doc, setDoc] = useState(store.document)
  const [phoneMain, setPhoneMain] = useState(store.phone_main)
  const [wa1, setWa1] = useState(store.whatsapp_1)
  const [wa2, setWa2] = useState(store.whatsapp_2)
  const [waOrder, setWaOrder] = useState(store.whatsapp_orders_phone)
  const [cep, setCep] = useState(store.cep)
  const [street, setStreet] = useState(store.street)
  const [number, setNumber] = useState(store.number)
  const [complement, setComplement] = useState(store.complement)
  const [district, setDistrict] = useState(store.district)
  const [city, setCity] = useState(store.city)
  const [stateUf, setStateUf] = useState(store.state)
  const [inst, setInst] = useState(store.institutional_text)
  const [themeP, setThemeP] = useState(store.theme_primary)
  const [themeA, setThemeA] = useState(store.theme_accent)
  const [pdfFooter, setPdfFooter] = useState(store.pdf_footer)
  const [policy, setPolicy] = useState(store.policy_text)
  const [bannerUrl, setBannerUrl] = useState(store.banner_url ?? '')
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

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
      /* ignore */
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    const dv = validateCpfCnpj(doc)
    if (!dv.ok) {
      notifyErr(dv.message)
      return
    }
    setSaving(true)
    const sb = getSupabaseBrowserClient()

    let nextBanner = bannerUrl.trim() || null
    if (bannerFile) {
      const ext = bannerFile.name.split('.').pop() || 'jpg'
      const path = `${store.id}/banner.${ext}`
      const up = await sb.storage.from('store-assets').upload(path, bannerFile, { upsert: true })
      if (up.error) {
        notifyErr(up.error.message)
        setSaving(false)
        return
      }
      nextBanner = sb.storage.from('store-assets').getPublicUrl(path).data.publicUrl
    }

    const { error } = await sb
      .from('stores')
      .update({
        trade_name: tradeName.trim(),
        legal_name: legalName.trim(),
        document_kind: dv.kind,
        document: onlyDigits(doc),
        phone_main: phoneMain,
        whatsapp_1: wa1,
        whatsapp_2: wa2,
        whatsapp_orders_phone: onlyDigits(waOrder),
        cep: onlyDigits(cep),
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim(),
        district: district.trim(),
        city: city.trim(),
        state: stateUf,
        institutional_text: inst,
        theme_primary: themeP,
        theme_accent: themeA,
        pdf_footer: pdfFooter,
        policy_text: policy,
        banner_url: nextBanner,
      })
      .eq('id', store.id)

    setSaving(false)
    if (error) notifyErr(error.message)
    else {
      setBannerFile(null)
      if (nextBanner) setBannerUrl(nextBanner)
      notifyOk('Configurações salvas.')
      await refresh()
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h2 className="font-display text-2xl font-semibold text-ink-900">Configurações</h2>
      <form className="space-y-6" onSubmit={onSave}>
        <Card className="space-y-4">
          <h3 className="font-display text-lg font-semibold">Identidade</h3>
          <div>
            <label className="text-xs font-medium text-ink-600">Nome fantasia</label>
            <Input className="mt-1" value={tradeName} onChange={(e) => setTradeName(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Razão social</label>
            <Input className="mt-1" value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">CPF/CNPJ</label>
            <Input className="mt-1" value={maskCpfCnpj(doc)} onChange={(e) => setDoc(maskCpfCnpj(e.target.value))} required />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Banner da loja</label>
            <p className="mt-0.5 text-xs text-ink-500">Envie uma imagem larga para o topo do catálogo público. Você pode manter uma URL manual abaixo se preferir.</p>
            <input
              type="file"
              accept="image/*"
              className="mt-2 block w-full text-sm"
              onChange={(e) => setBannerFile(e.target.files?.[0] ?? null)}
            />
            {bannerFile ? (
              <p className="mt-1 text-xs text-ink-600">Será enviado ao salvar: {bannerFile.name}</p>
            ) : null}
            {bannerUrl ? (
              <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-ink-200">
                <img src={bannerUrl} alt="" className="max-h-40 w-full object-cover" />
              </div>
            ) : null}
            <label className="mt-3 block text-xs font-medium text-ink-600">Ou URL do banner</label>
            <Input className="mt-1" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Texto institucional</label>
            <Textarea className="mt-1" value={inst} onChange={(e) => setInst(e.target.value)} rows={3} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField id="themeP" label="Cor primária (tema do catálogo)" value={themeP} onChange={setThemeP} />
            <ColorField id="themeA" label="Cor de destaque (botões e preços)" value={themeA} onChange={setThemeA} />
          </div>
        </Card>

        <Card className="space-y-4">
          <h3 className="font-display text-lg font-semibold">Contato</h3>
          <div>
            <label className="text-xs font-medium text-ink-600">Telefone principal</label>
            <Input className="mt-1" value={phoneMain} onChange={(e) => setPhoneMain(maskPhone(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">WhatsApp 1</label>
            <Input className="mt-1" value={wa1} onChange={(e) => setWa1(maskPhone(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">WhatsApp 2</label>
            <Input className="mt-1" value={wa2} onChange={(e) => setWa2(maskPhone(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">WhatsApp principal para pedidos (somente dígitos)</label>
            <Input className="mt-1" value={waOrder} onChange={(e) => setWaOrder(maskPhone(e.target.value))} />
          </div>
        </Card>

        <Card className="space-y-4">
          <h3 className="font-display text-lg font-semibold">Endereço</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-ink-600">CEP</label>
              <Input className="mt-1" value={maskCep(cep)} onChange={(e) => setCep(maskCep(e.target.value))} onBlur={onCepBlur} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">UF</label>
              <Input className="mt-1" maxLength={2} value={stateUf} onChange={(e) => setStateUf(e.target.value.toUpperCase())} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Rua</label>
            <Input className="mt-1" value={street} onChange={(e) => setStreet(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-ink-600">Número</label>
              <Input className="mt-1" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">Complemento</label>
              <Input className="mt-1" value={complement} onChange={(e) => setComplement(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Bairro</label>
            <Input className="mt-1" value={district} onChange={(e) => setDistrict(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Cidade</label>
            <Input className="mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </Card>

        <Card className="space-y-4">
          <h3 className="font-display text-lg font-semibold">PDF e catálogo</h3>
          <div>
            <label className="text-xs font-medium text-ink-600">Rodapé do PDF</label>
            <Textarea className="mt-1" value={pdfFooter} onChange={(e) => setPdfFooter(e.target.value)} rows={2} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600">Política / comunicado (catálogo)</label>
            <Textarea className="mt-1" value={policy} onChange={(e) => setPolicy(e.target.value)} rows={3} />
          </div>
        </Card>

        <Button type="submit" loading={saving}>
          Salvar alterações
        </Button>
      </form>
    </div>
  )
}
