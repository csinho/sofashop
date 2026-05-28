import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { MoneyField } from '@/components/ui/MoneyField'
import { IntegerField } from '@/components/ui/IntegerField'
import { formatCurrency } from '@/lib/format'
import { formatMoneyFromDecimal, parseMoneyBRL } from '@/lib/moneyInput'
import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import { notifyErr, notifyInfo, notifyOk } from '@/lib/notify'
import { allocatedStock, freeStock, parseStockInput } from '@/lib/productStock'
import { productListPrice } from '@/lib/productPricing'
import type { AdminOutletCtx } from '@/pages/admin/adminOutlet'
import type { SofaSpec } from '@/types/database'

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60)
}

type ImgRow = { id: string; url: string }
type VariantRow = {
  id: string
  name: string
  sku_suffix: string
  price_override: number | null
  stock: number | null
  color_id: string | null
  is_active: boolean
  is_default: boolean
  colors: { id: string; name: string; hex: string } | null
}

function parseVariantPriceOverride(input: string): number | null {
  if (!input.trim()) return null
  const n = parseMoneyBRL(input)
  return n > 0 ? n : null
}

const DRAFT_PREFIX = 'product-editor-draft:'
const MAX_IMAGES = 10

function pathFromAssetUrl(url: string) {
  const i = url.indexOf('/store-assets/')
  if (i === -1) return null
  return url.slice(i + '/store-assets/'.length)
}

function buildAutoSku(productName: string, sequence: number) {
  const base = slugify(productName || 'produto').toUpperCase() || 'PRODUTO'
  return `${base}-${String(sequence).padStart(4, '0')}`
}

export function ProductEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'novo'
  const nav = useNavigate()
  const { store } = useOutletContext<AdminOutletCtx>()

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [modelTypes, setModelTypes] = useState<{ id: string; name: string }[]>([])
  const [colors, setColors] = useState<{ id: string; name: string; hex: string }[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [modelType, setModelType] = useState('')
  const [shortDesc, setShortDesc] = useState('')
  const [description, setDescription] = useState('')
  const [sku, setSku] = useState('')
  const [skuTouched, setSkuTouched] = useState(false)
  const [nextSkuNumber, setNextSkuNumber] = useState(1)
  const [basePrice, setBasePrice] = useState('')
  const [promoPrice, setPromoPrice] = useState('')
  const [productStock, setProductStock] = useState('')
  const [deliveryDays, setDeliveryDays] = useState('15')
  const [dimL, setDimL] = useState('')
  const [dimW, setDimW] = useState('')
  const [dimH, setDimH] = useState('')
  const [warranty, setWarranty] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isFeatured, setIsFeatured] = useState(false)

  const [existingImgs, setExistingImgs] = useState<ImgRow[]>([])
  const [removeImgIds, setRemoveImgIds] = useState<Set<string>>(() => new Set())
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  const [variants, setVariants] = useState<VariantRow[]>([])
  const [vName, setVName] = useState('')
  const [vColor, setVColor] = useState('')
  const [vPrice, setVPrice] = useState('')
  const [vSku, setVSku] = useState('')
  const [vStock, setVStock] = useState('')

  const [editVid, setEditVid] = useState<string | null>(null)
  const [evName, setEvName] = useState('')
  const [evColor, setEvColor] = useState('')
  const [evPrice, setEvPrice] = useState('')
  const [evSku, setEvSku] = useState('')
  const [evStock, setEvStock] = useState('')
  const [variantPanel, setVariantPanel] = useState<'list' | 'create' | 'edit'>('list')

  const dirtyRef = useRef(false)
  const draftNotifyDone = useRef(false)
  const draftKey = `${DRAFT_PREFIX}${isNew ? 'novo' : id}`

  const autoSlug = useMemo(() => slugify(name), [name])
  const productStockNum = useMemo(() => parseStockInput(productStock), [productStock])
  const variantsAllocated = useMemo(() => allocatedStock(variants), [variants])
  const variantsFreeForCreate = useMemo(
    () => freeStock(productStockNum, variants),
    [productStockNum, variants],
  )
  const variantsFreeForEdit = useMemo(
    () => freeStock(productStockNum, variants, editVid),
    [productStockNum, variants, editVid],
  )

  const productListPriceLive = useMemo(() => {
    const base = basePrice.trim() ? parseMoneyBRL(basePrice) : 0
    const promo = promoPrice.trim() ? parseMoneyBRL(promoPrice) : null
    return productListPrice({ base_price: base, promo_price: promo })
  }, [basePrice, promoPrice])

  const editingDefaultVariant = useMemo(
    () => (editVid ? variants.some((v) => v.id === editVid && v.is_default) : false),
    [variants, editVid],
  )
  const [createStep, setCreateStep] = useState(0)
  const createSteps = ['Dados', 'Preço', 'Mídia', 'Variações', 'Revisão']
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const markDirty = useCallback(() => {
    dirtyRef.current = true
  }, [])

  useEffect(() => {
    const onB = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onB)
    return () => window.removeEventListener('beforeunload', onB)
  }, [])

  useEffect(() => {
    if (loading) return
    const t = window.setTimeout(() => {
      try {
        const payload = {
          savedAt: Date.now(),
          name,
          slug,
          categoryId,
          subcategory,
          modelType,
          shortDesc,
          description,
          sku,
          basePrice,
          promoPrice,
          deliveryDays,
          dimL,
          dimW,
          dimH,
          warranty,
          internalNotes,
          isActive,
          isFeatured,
        }
        sessionStorage.setItem(draftKey, JSON.stringify(payload))
      } catch {
        /* ignore */
      }
    }, 500)
    return () => window.clearTimeout(t)
  }, [
    loading,
    draftKey,
    name,
    slug,
    categoryId,
    subcategory,
    modelType,
    shortDesc,
    description,
    sku,
    basePrice,
    promoPrice,
    deliveryDays,
    dimL,
    dimW,
    dimH,
    warranty,
    internalNotes,
    isActive,
    isFeatured,
  ])

  const loadVariants = useCallback(async (productId: string) => {
    const sb = getSupabaseBrowserClient()
    const { data, error } = await sb
      .from('product_variants')
      .select('id, name, sku_suffix, price_override, stock, color_id, is_active, is_default, colors ( id, name, hex )')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
    if (error) return
    setVariants(
      (data as unknown as VariantRow[]).map((v) => ({
        ...v,
        is_default: Boolean(v.is_default),
        colors: v.colors as VariantRow['colors'],
      })),
    )
  }, [])

  useEffect(() => {
    const sb = getSupabaseBrowserClient()
    ;(async () => {
      const [{ data: cats }, { data: mt }, { data: cols }] = await Promise.all([
        sb.from('categories').select('id, name').eq('store_id', store.id).order('sort_order'),
        sb.from('product_model_types').select('id, name').eq('store_id', store.id).order('sort_order'),
        sb.from('colors').select('id, name, hex').eq('store_id', store.id).order('name'),
      ])
      setCategories((cats as never) ?? [])
      const mlist = (mt as { id: string; name: string }[]) ?? []
      setModelTypes(mlist)
      setColors((cols as never) ?? [])

      if (isNew) {
        const { count } = await sb.from('products').select('id', { count: 'exact', head: true }).eq('store_id', store.id)
        setNextSkuNumber((count ?? 0) + 1)
        setCategoryId((cats as { id: string }[] | null)?.[0]?.id ?? '')
        setModelType(mlist[0]?.name ?? '')
        const raw = sessionStorage.getItem(draftKey)
        if (raw) {
          try {
            const d = JSON.parse(raw) as Record<string, string | boolean>
            if (typeof d.name === 'string') setName(d.name)
            if (typeof d.slug === 'string') setSlug(d.slug)
            if (typeof d.categoryId === 'string') setCategoryId(d.categoryId)
            if (typeof d.subcategory === 'string') setSubcategory(d.subcategory)
            if (typeof d.modelType === 'string') setModelType(d.modelType)
            if (typeof d.shortDesc === 'string') setShortDesc(d.shortDesc)
            if (typeof d.description === 'string') setDescription(d.description)
            if (typeof d.sku === 'string') {
              setSku(d.sku)
              if (d.sku.trim()) setSkuTouched(true)
            }
            if (typeof d.basePrice === 'string') setBasePrice(d.basePrice)
            if (typeof d.promoPrice === 'string') setPromoPrice(d.promoPrice)
            if (typeof d.deliveryDays === 'string') setDeliveryDays(d.deliveryDays)
            if (typeof d.dimL === 'string') setDimL(d.dimL)
            if (typeof d.dimW === 'string') setDimW(d.dimW)
            if (typeof d.dimH === 'string') setDimH(d.dimH)
            if (typeof d.warranty === 'string') setWarranty(d.warranty)
            if (typeof d.internalNotes === 'string') setInternalNotes(d.internalNotes)
            if (typeof d.isActive === 'boolean') setIsActive(d.isActive)
            if (typeof d.isFeatured === 'boolean') setIsFeatured(d.isFeatured)
            if (!draftNotifyDone.current) {
              draftNotifyDone.current = true
              notifyOk('Rascunho local restaurado (campos de texto).')
            }
          } catch {
            /* ignore */
          }
        }
        setLoading(false)
        return
      }

      const { data: p } = await sb.from('products').select('*').eq('id', id).eq('store_id', store.id).single()
      if (!p) {
        setLoading(false)
        return
      }
      const pr = p as Record<string, unknown>
      setName(String(pr.name))
      setSlug(String(pr.slug))
      setCategoryId(String(pr.category_id))
      setSubcategory(String(pr.subcategory ?? ''))
      setModelType(String(pr.model_type))
      setShortDesc(String(pr.short_description ?? ''))
      setDescription(String(pr.description ?? ''))
      setSku(String(pr.sku))
      setSkuTouched(true)
      setBasePrice(formatMoneyFromDecimal(Number(pr.base_price)))
      setPromoPrice(pr.promo_price != null ? formatMoneyFromDecimal(Number(pr.promo_price)) : '')
      setProductStock(pr.stock != null ? String(Math.floor(Number(pr.stock))) : '')
      setDeliveryDays(String(pr.delivery_days ?? 15))
      setDimL(pr.dimension_length_cm != null ? String(Math.round(Number(pr.dimension_length_cm))) : '')
      setDimW(pr.dimension_width_cm != null ? String(Math.round(Number(pr.dimension_width_cm))) : '')
      setDimH(pr.dimension_height_cm != null ? String(Math.round(Number(pr.dimension_height_cm))) : '')
      setWarranty(String((pr.sofa_spec as SofaSpec | null | undefined)?.warranty ?? ''))
      setInternalNotes(String(pr.internal_notes ?? ''))
      setIsActive(Boolean(pr.is_active))
      setIsFeatured(Boolean(pr.is_featured))

      const { data: imgs } = await sb.from('product_images').select('id, url').eq('product_id', id).order('sort_order')
      setExistingImgs((imgs as ImgRow[]) ?? [])
      await loadVariants(id!)
      setLoading(false)
    })()
  }, [store.id, id, isNew, draftKey, loadVariants])

  const visibleCount = existingImgs.filter((i) => !removeImgIds.has(i.id)).length + pendingFiles.length
  const pendingPreviewUrls = useMemo(() => pendingFiles.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })), [pendingFiles])

  useEffect(() => {
    if (!isNew || skuTouched) return
    setSku(buildAutoSku(name, nextSkuNumber))
  }, [isNew, skuTouched, name, nextSkuNumber])

  useEffect(() => {
    return () => {
      pendingPreviewUrls.forEach((p) => URL.revokeObjectURL(p.url))
    }
  }, [pendingPreviewUrls])

  function onPickFiles(files: FileList | null) {
    if (!files?.length) return
    const next = [...pendingFiles, ...Array.from(files)]
    const cap = MAX_IMAGES - existingImgs.filter((i) => !removeImgIds.has(i.id)).length
    setPendingFiles(next.slice(0, Math.max(0, cap)))
    markDirty()
  }

  function toggleRemoveImg(imgId: string) {
    setRemoveImgIds((prev) => {
      const n = new Set(prev)
      if (n.has(imgId)) {
        n.delete(imgId)
        notifyInfo('Imagem mantida.')
      } else {
        n.add(imgId)
        notifyInfo('Imagem marcada para remoção ao salvar.')
      }
      return n
    })
    markDirty()
  }

  async function uploadImages(sb: ReturnType<typeof getSupabaseBrowserClient>, productId: string) {
    const startOrder = existingImgs.filter((i) => !removeImgIds.has(i.id)).length
    let order = startOrder
    for (const f of pendingFiles) {
      const path = `${store.id}/products/${productId}/${Date.now()}-${f.name.replace(/\s+/g, '_')}`
      const up = await sb.storage.from('store-assets').upload(path, f, { upsert: true })
      if (up.error) continue
      const url = sb.storage.from('store-assets').getPublicUrl(path).data.publicUrl
      await sb.from('product_images').insert({ product_id: productId, url, sort_order: order++, alt: name })
    }
  }

  async function persistProduct(opts: { requireValidPrice?: boolean; finishFlow?: boolean } = {}) {
    const { requireValidPrice = false, finishFlow = false } = opts

    if (!name.trim()) {
      notifyErr('Informe o nome do produto.')
      return false
    }

    const spec: SofaSpec = {
      warranty: warranty.trim() || undefined,
    }

    if (visibleCount > MAX_IMAGES) {
      notifyErr(`No máximo ${MAX_IMAGES} imagens (contando as já publicadas e as novas).`)
      return false
    }

    const baseNum = parseMoneyBRL(basePrice)
    if (requireValidPrice && baseNum <= 0) {
      notifyErr('Informe um preço base válido.')
      return false
    }
    const effectiveBase = baseNum > 0 ? baseNum : 0

    setSaving(true)
    const sb = getSupabaseBrowserClient()

    let finalCategoryId = categoryId
    let finalModelType = modelType.trim()

    if (!finalCategoryId) {
      const { data: insertedCat, error: catErr } = await sb
        .from('categories')
        .insert({
          store_id: store.id,
          name: 'Geral',
          slug: `geral-${Date.now()}`,
          sort_order: categories.length,
          is_active: true,
        })
        .select('id')
        .single()
      if (catErr) {
        notifyErr('Não foi possível definir categoria padrão. Verifique os dados do catálogo.')
        setSaving(false)
        return false
      }
      finalCategoryId = String((insertedCat as { id: string }).id)
      setCategoryId(finalCategoryId)
      setCategories((prev) => [...prev, { id: finalCategoryId!, name: 'Geral' }])
    }

    if (!finalModelType) {
      finalModelType = 'Padrão'
      setModelType(finalModelType)
    }

    const finalSku = sku.trim() || buildAutoSku(name, nextSkuNumber)
    if (!sku.trim()) setSku(finalSku)

    const stockValue = parseStockInput(productStock)
    if (stockValue != null && variants.length > 0) {
      const allocated = allocatedStock(variants)
      if (allocated > stockValue) {
        notifyErr(
          `As variações somam ${allocated} unidades, acima do estoque total (${stockValue}). Ajuste as quantidades.`,
        )
        setSaving(false)
        return false
      }
    }

    const row = {
      store_id: store.id,
      category_id: finalCategoryId,
      name: name.trim(),
      slug: (slug.trim() || autoSlug).toLowerCase(),
      subcategory: subcategory.trim() || null,
      model_type: finalModelType,
      short_description: shortDesc.trim(),
      description: description.trim(),
      sku: finalSku,
      base_price: effectiveBase,
      promo_price: promoPrice.trim() ? parseMoneyBRL(promoPrice) : null,
      is_active: isActive,
      is_featured: isFeatured,
      delivery_days: Number(deliveryDays) || 15,
      internal_notes: internalNotes.trim(),
      sofa_spec: spec,
      dimension_length_cm: dimL.trim() ? Number(dimL.replace(',', '.')) : null,
      dimension_width_cm: dimW.trim() ? Number(dimW.replace(',', '.')) : null,
      dimension_height_cm: dimH.trim() ? Number(dimH.replace(',', '.')) : null,
      stock: stockValue,
    }

    try {
      if (isNew) {
        const { data: ins, error } = await sb.from('products').insert(row).select('id').single()
        if (error) throw error
        const pid = (ins as { id: string }).id
        await uploadImages(sb, pid)
        sessionStorage.removeItem(draftKey)
        dirtyRef.current = false
        if (finishFlow) {
          notifyOk('Produto criado.')
          nav('/admin/produtos')
        } else {
          notifyOk('Produto salvo.')
          nav(`/admin/produtos/${pid}`, { replace: true })
        }
      } else {
        const { error } = await sb.from('products').update(row).eq('id', id!).eq('store_id', store.id)
        if (error) throw error

        for (const imgId of removeImgIds) {
          const rowI = existingImgs.find((x) => x.id === imgId)
          if (rowI) {
            const pth = pathFromAssetUrl(rowI.url)
            if (pth) await sb.storage.from('store-assets').remove([pth])
            await sb.from('product_images').delete().eq('id', imgId)
          }
        }

        await uploadImages(sb, id!)
        setPendingFiles([])
        setRemoveImgIds(new Set())
        const { data: imgs } = await sb.from('product_images').select('id, url').eq('product_id', id!).order('sort_order')
        setExistingImgs((imgs as ImgRow[]) ?? [])
        sessionStorage.removeItem(draftKey)
        dirtyRef.current = false
        notifyOk(finishFlow ? 'Produto atualizado.' : 'Alterações salvas.')
        await loadVariants(id!)
      }
      return true
    } catch (err: unknown) {
      notifyErr(err instanceof Error ? err.message : 'Erro ao salvar')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveCurrentStep() {
    const requireValidPrice = createStep === 1 || createStep === createSteps.length - 1
    await persistProduct({ requireValidPrice, finishFlow: false })
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    await persistProduct({ requireValidPrice: true, finishFlow: true })
  }

  async function addVariant() {
    if (isNew || !id) {
      notifyErr('Salve o produto antes de adicionar variações.')
      return
    }
    if (!vName.trim()) {
      notifyErr('Informe o nome da variação.')
      return
    }
    const variantQty = parseStockInput(vStock)
    if (productStockNum != null) {
      if (variantQty == null) {
        notifyErr('Informe a quantidade em estoque desta variação.')
        return
      }
      const available = freeStock(productStockNum, variants)
      if (available != null && variantQty > available) {
        notifyErr(`Disponível para alocar: ${available} unidade(s).`)
        return
      }
    }
    const sb = getSupabaseBrowserClient()
    const { error } = await sb.from('product_variants').insert({
      product_id: id,
      color_id: vColor || null,
      name: vName.trim(),
      sku_suffix: vSku.trim(),
      price_override: parseVariantPriceOverride(vPrice),
      stock: variantQty,
      is_active: true,
    })
    if (error) notifyErr(error.message)
    else {
      notifyOk('Variação adicionada.')
      setVName('')
      setVColor('')
      setVPrice('')
      setVSku('')
      setVStock('')
      setVariantPanel('list')
      markDirty()
      void loadVariants(id)
    }
  }

  async function toggleDefaultVariant(v: VariantRow) {
    if (!id || isNew) return
    const sb = getSupabaseBrowserClient()

    if (v.is_default) {
      const { error } = await sb.from('product_variants').update({ is_default: false }).eq('id', v.id).eq('product_id', id)
      if (error) {
        notifyErr(error.message)
        return
      }
      notifyOk('Padrão removido. A variação volta a usar o preço próprio cadastrado.')
    } else {
      const { error } = await sb.from('product_variants').update({ is_default: true }).eq('id', v.id).eq('product_id', id)
      if (error) {
        notifyErr(error.message)
        return
      }
      notifyOk('Variação marcada como padrão. No catálogo, ela usa o preço do produto (as outras padrão continuam iguais).')
    }

    markDirty()
    await loadVariants(id)
  }

  async function deleteVariant(vid: string) {
    const sb = getSupabaseBrowserClient()
    const { error } = await sb.from('product_variants').delete().eq('id', vid)
    if (error) notifyErr(error.message)
    else {
      notifyOk('Variação removida.')
      if (id) void loadVariants(id)
      markDirty()
    }
  }

  async function saveVariantEdit() {
    if (!editVid) return
    const variantQty = parseStockInput(evStock)
    if (productStockNum != null) {
      if (variantQty == null) {
        notifyErr('Informe a quantidade em estoque desta variação.')
        return
      }
      const available = freeStock(productStockNum, variants, editVid)
      if (available != null && variantQty > available) {
        notifyErr(`Disponível para alocar: ${available} unidade(s).`)
        return
      }
    }
    const sb = getSupabaseBrowserClient()
    const { error } = await sb
      .from('product_variants')
      .update({
        name: evName.trim(),
        color_id: evColor || null,
        sku_suffix: evSku.trim(),
        price_override: parseVariantPriceOverride(evPrice),
        stock: variantQty,
      })
      .eq('id', editVid)
    if (error) notifyErr(error.message)
    else {
      notifyOk('Variação atualizada.')
      setEditVid(null)
      setVariantPanel('list')
      if (id) void loadVariants(id)
      markDirty()
    }
  }

  async function onDeleteProduct() {
    if (isNew || !id) return
    if (deleteConfirmName.trim() !== name.trim()) {
      notifyErr('Digite o nome do produto exatamente para confirmar.')
      return
    }
    setDeleting(true)
    const sb = getSupabaseBrowserClient()
    try {
      const { data: variantRows } = await sb.from('product_variants').select('id').eq('product_id', id)
      const variantIds = (variantRows ?? []).map((v) => v.id as string)
      const { data: imgs } = await sb.from('product_images').select('id, url').eq('product_id', id)
      const { data: variantImgs } = variantIds.length
        ? await sb.from('variant_images').select('id, url').in('variant_id', variantIds)
        : { data: [] as { id: string; url: string }[] }

      const pathsToRemove = [
        ...((imgs as ImgRow[] | null) ?? []).map((im) => pathFromAssetUrl(im.url)).filter(Boolean),
        ...(((variantImgs as { id: string; url: string }[] | null) ?? []).map((im) => pathFromAssetUrl(im.url)).filter(Boolean) as string[]),
      ] as string[]

      if (pathsToRemove.length) {
        await sb.storage.from('store-assets').remove(pathsToRemove)
      }

      if (variantIds.length) {
        await sb.from('variant_images').delete().in('variant_id', variantIds)
      }
      await sb.from('product_variants').delete().eq('product_id', id)
      await sb.from('product_images').delete().eq('product_id', id)
      const { error } = await sb.from('products').delete().eq('id', id).eq('store_id', store.id)
      if (error) throw error

      notifyOk('Produto excluído com sucesso.')
      setDeleteOpen(false)
      nav('/admin/produtos')
    } catch (err: unknown) {
      notifyErr(err instanceof Error ? err.message : 'Erro ao excluir produto')
    } finally {
      setDeleting(false)
    }
  }

  function variantPriceDisplay(v: VariantRow): { main: string; hint: string | null } {
    if (v.is_default) {
      const stored =
        v.price_override != null && v.price_override > 0
          ? ` · ao remover padrão: ${formatCurrency(v.price_override)}`
          : ''
      return {
        main: formatCurrency(productListPriceLive),
        hint: `Padrão no catálogo${stored}`,
      }
    }
    if (v.price_override != null && v.price_override > 0) {
      return { main: formatCurrency(v.price_override), hint: null }
    }
    return { main: formatCurrency(productListPriceLive), hint: 'Usa preço do produto' }
  }

  function startEdit(v: VariantRow) {
    setEditVid(v.id)
    setEvName(v.name)
    setEvColor(v.color_id ?? '')
    setEvSku(v.sku_suffix ?? '')
    setEvPrice(
      v.price_override != null && v.price_override > 0 ? formatMoneyFromDecimal(v.price_override) : '',
    )
    setEvStock(v.stock != null ? String(v.stock) : '')
    setVariantPanel('edit')
    notifyInfo('Editando variação.')
  }

  if (loading) return <p className="text-sm text-ink-500">Carregando produto…</p>
  const showStep = (index: number) => createStep === index
  const isLastStep = createStep === createSteps.length - 1

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div className="space-y-3">
        <Link
          to="/admin/produtos"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para produtos
        </Link>
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink-900">{isNew ? 'Criar produto' : 'Editar produto'}</h2>
          <p className="text-sm text-ink-600">
            {isNew
              ? 'Preencha os dados principais e salve para liberar variações.'
              : 'Atualize informações, imagens e variações do produto.'}
          </p>
        </div>
      </div>

      <form
        className="space-y-6 pb-24 md:pb-0"
        onSubmit={onSave}
        onChange={() => {
          markDirty()
        }}
      >
        <Card className="space-y-3 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Etapa {createStep + 1} de {createSteps.length}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {createSteps.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  title={`Ir para a etapa: ${label}.`}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-center text-xs font-semibold ${
                    createStep === index ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'
                  }`}
                  onClick={() => setCreateStep(index)}
                >
                  {label}
                </button>
              ))}
            </div>
            {!isNew ? (
              <button
                type="button"
                className="ml-auto whitespace-nowrap rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                title="Excluir permanentemente este produto e todas as variações e fotos."
                onClick={() => {
                  setDeleteConfirmName('')
                  setDeleteOpen(true)
                }}
              >
                Deletar
              </button>
            ) : null}
          </div>
        </Card>

        <Card className={`grid gap-4 p-4 md:grid-cols-2 md:p-6 ${createStep === 3 ? 'hidden' : ''}`}>
          <div className={`space-y-4 md:col-span-2 ${showStep(0) ? '' : 'hidden'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Informações básicas</p>
            <div>
              <label className="text-xs font-medium text-ink-600">Nome</label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-600">Slug (URL)</label>
                <Input className="mt-1" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={autoSlug} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600">SKU</label>
                <Input
                  className="mt-1"
                  value={sku}
                  onChange={(e) => {
                    setSkuTouched(true)
                    setSku(e.target.value)
                  }}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-600">Categoria</label>
                <Select className="mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600">Subcategoria</label>
                <Input className="mt-1" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">Tipo / modelo</label>
              <Select className="mt-1" value={modelType} onChange={(e) => setModelType(e.target.value)}>
                {modelTypes.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">Descrição curta</label>
              <Input className="mt-1" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">Descrição completa</label>
              <Textarea className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
            </div>
          </div>

          <div className={`space-y-4 md:col-span-2 ${showStep(1) ? '' : 'hidden'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Preço e logística</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-600">Preço base</label>
                <MoneyField className="mt-1" value={basePrice} onValueChange={(m) => setBasePrice(m)} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600">Preço promocional</label>
                <MoneyField className="mt-1" value={promoPrice} onValueChange={(m) => setPromoPrice(m)} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600">Prazo entrega (dias)</label>
                <IntegerField className="mt-1" value={deliveryDays} onValueChange={setDeliveryDays} min={1} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">Estoque total (unidades)</label>
              <IntegerField
                className="mt-1 block w-full max-w-xs"
                value={productStock}
                onValueChange={setProductStock}
                min={0}
                placeholder="ex.: 10"
              />
              <p className="mt-1 text-xs text-ink-500">
                Quantidade total em estoque. Distribua nas variações (cores) na etapa Variações. Deixe vazio para não
                controlar estoque.
              </p>
              {productStockNum != null && variants.length > 0 ? (
                <p className="mt-1 text-xs font-medium text-ink-700">
                  Alocado nas variações: {variantsAllocated} · Livre: {Math.max(productStockNum - variantsAllocated, 0)}
                </p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-ink-600">Comprimento (cm)</label>
                <IntegerField className="mt-1" value={dimL} onValueChange={setDimL} min={0} placeholder="opcional" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600">Largura (cm)</label>
                <IntegerField className="mt-1" value={dimW} onValueChange={setDimW} min={0} placeholder="opcional" />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600">Altura (cm)</label>
                <IntegerField className="mt-1" value={dimH} onValueChange={setDimH} min={0} placeholder="opcional" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">Garantia do produto</label>
              <Input
                className="mt-1"
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                placeholder="Ex.: 90 dias, 3 meses, 1 ano"
              />
            </div>
          </div>

          <div className={`space-y-4 md:col-span-2 ${showStep(2) ? '' : 'hidden'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Mídia e publicação</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-ink-200 p-1.5">
            <p className="px-2 pb-2 text-xs text-ink-500">Visibilidade no catálogo</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                title="Publicar o produto no catálogo para os clientes."
                onClick={() => setIsActive(true)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'}`}
              >
                Ativo
              </button>
              <button
                type="button"
                title="Ocultar o produto do catálogo (não aparece para clientes)."
                onClick={() => setIsActive(false)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${!isActive ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'}`}
              >
                Inativo
              </button>
            </div>
              </div>
              <div className="rounded-xl border border-ink-200 p-1.5">
            <p className="px-2 pb-2 text-xs text-ink-500">Prioridade da vitrine</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                title="Destacar o produto na vitrine do catálogo."
                onClick={() => setIsFeatured(true)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${isFeatured ? 'bg-amber-500 text-white' : 'bg-white text-ink-600'}`}
              >
                Destaque
              </button>
              <button
                type="button"
                title="Remover destaque; o produto continua no catálogo normalmente."
                onClick={() => setIsFeatured(false)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${!isFeatured ? 'bg-ink-200 text-ink-700' : 'bg-white text-ink-600'}`}
              >
                Normal
              </button>
            </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-600">Observações internas</label>
              <Textarea className="mt-1" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2 rounded-xl border border-ink-100 bg-ink-50/50 p-3">
            <label className="text-xs font-medium text-ink-600">Imagens do produto (máx. {MAX_IMAGES})</label>
            <p className="text-xs text-ink-500">
              Imagens extras aparecem no catálogo em carrossel. Você pode remover imagens existentes antes de salvar.
            </p>
            <p className="text-xs font-medium text-ink-700">
              {visibleCount}/{MAX_IMAGES} imagens neste envio
            </p>
            <input
              type="file"
              multiple
              accept="image/*"
              className="block w-full rounded-lg border border-dashed border-ink-300 bg-white p-3 text-sm"
              onChange={(e) => onPickFiles(e.target.files)}
            />
            {existingImgs.length > 0 || pendingPreviewUrls.length > 0 ? (
              <div className="mt-2">
                <p className="mb-2 text-xs font-medium text-ink-600">Preview das imagens</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {existingImgs.map((im) => {
                    const gone = removeImgIds.has(im.id)
                    return (
                      <div key={im.id} className="space-y-1">
                        <div className="relative aspect-square overflow-hidden rounded-lg bg-ink-100 ring-1 ring-ink-200">
                          <img src={im.url} alt="" className={`h-full w-full object-cover ${gone ? 'opacity-35' : ''}`} />
                          {gone ? (
                            <div className="absolute inset-0 flex items-end bg-ink-900/25 p-1.5">
                              <span className="rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-medium text-ink-700">
                                Será removida ao salvar
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full text-xs"
                          tooltip={
                            gone
                              ? 'Desfazer a remoção desta foto; ela continuará no produto ao salvar.'
                              : 'Marcar esta foto para remoção ao salvar o produto.'
                          }
                          onClick={() => toggleRemoveImg(im.id)}
                        >
                          {gone ? 'Manter' : 'Remover'}
                        </Button>
                      </div>
                    )
                  })}

                  {pendingPreviewUrls.map((p) => (
                    <div key={p.url} className="space-y-1">
                      <div className="relative aspect-square overflow-hidden rounded-lg bg-ink-100 ring-1 ring-ink-200">
                        <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                        <span className="absolute left-1.5 top-1.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Nova
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-ink-500">Pronta para envio</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            </div>
          </div>

          <div className={`md:col-span-2 ${showStep(4) ? '' : 'hidden'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Revisão</p>
            <div className="mt-2 rounded-xl border border-ink-100 bg-ink-50 p-3 text-sm text-ink-700">
              <p>
                <strong>Produto:</strong> {name || '—'}
              </p>
              <p>
                <strong>SKU:</strong> {sku || '—'}
              </p>
              <p>
                <strong>Preço base:</strong> {basePrice ? `R$ ${basePrice}` : '—'}
              </p>
              <p>
                <strong>Categoria:</strong> {categories.find((c) => c.id === categoryId)?.name ?? '—'}
              </p>
              <p>
                <strong>Imagens neste envio:</strong> {visibleCount}/{MAX_IMAGES}
              </p>
              {visibleCount > 0 ? (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">Preview das imagens</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {existingImgs
                      .filter((im) => !removeImgIds.has(im.id))
                      .map((im) => (
                        <img key={im.id} src={im.url} alt="" className="h-20 w-full rounded-lg object-cover ring-1 ring-ink-200" />
                      ))}
                    {pendingPreviewUrls.map((p) => (
                      <img key={p.url} src={p.url} alt={p.name} className="h-20 w-full rounded-lg object-cover ring-1 ring-ink-200" />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className={`space-y-4 ${showStep(3) ? '' : 'hidden'}`}>
            <div>
              <h3 className="font-display text-lg font-semibold text-ink-900">Variações do produto</h3>
              <p className="mt-1 text-sm text-ink-600">
                Uma <strong>variação</strong> é uma opção de venda do mesmo produto: outra cor, outro tecido ou preço diferente.
                O cliente escolhe a variação no catálogo; o preço pode ser ajustado sem criar outro produto.
              </p>
              {isNew ? (
                <p className="mt-2 text-xs text-amber-700">
                  Clique em <strong>Salvar</strong> nesta etapa (ou em Dados/Preço) para gravar o produto e liberar as
                  variações.
                </p>
              ) : null}
              {colors.length === 0 ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Cadastre cores em{' '}
                  <Link to="/admin/dados-catalogo" className="font-semibold underline">
                    Dados do catálogo → Cores
                  </Link>{' '}
                  para associar às variações.
                </p>
              ) : null}
            </div>

            {!isNew ? (
              <div className="flex flex-wrap items-center gap-2">
                {variantPanel === 'list' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    tooltip="Cadastrar uma nova cor, tamanho ou preço para este produto."
                    onClick={() => setVariantPanel('create')}
                  >
                    Nova variação
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    tooltip="Voltar à lista de variações sem salvar o formulário aberto."
                    onClick={() => {
                      setVariantPanel('list')
                      setEditVid(null)
                    }}
                  >
                    Voltar para lista
                  </Button>
                )}
              </div>
            ) : null}

            {variantPanel === 'list' ? (
              variants.length > 0 ? (
                <>
                  <div className="space-y-2 md:hidden">
                    {variants.map((v) => (
                      <div key={v.id} className="rounded-2xl border border-ink-200 bg-white p-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-lg font-semibold text-ink-900">{v.name}</p>
                            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-ink-500">Variação ativa</p>
                          </div>
                          <div className="text-right">
                            {v.is_default ? (
                              <span className="mb-1 inline-block rounded-full bg-[var(--cat-accent)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-800">
                                Padrão
                              </span>
                            ) : null}
                            <p className="whitespace-nowrap text-lg font-bold text-ink-900">{variantPriceDisplay(v).main}</p>
                            {variantPriceDisplay(v).hint ? (
                              <p className="text-[10px] text-ink-500">{variantPriceDisplay(v).hint}</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-700">
                          <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1">
                            Cor:
                            {v.colors ? (
                              <span className="inline-flex items-center gap-1 font-medium">
                                <span className="h-3.5 w-3.5 rounded-full ring-1 ring-ink-200" style={{ background: v.colors.hex }} />
                                {v.colors.name}
                              </span>
                            ) : (
                              '—'
                            )}
                          </span>
                          <span className="rounded-full bg-ink-100 px-2.5 py-1">
                            SKU: <span className="font-medium">{v.sku_suffix || '—'}</span>
                          </span>
                          <span className="rounded-full bg-ink-100 px-2.5 py-1">
                            Estoque: <span className="font-medium">{v.stock != null ? v.stock : '—'}</span>
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            className="rounded-xl border border-ink-200 py-2 text-sm"
                            tooltip="Editar nome, cor, preço e estoque desta variação."
                            onClick={() => startEdit(v)}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className={`rounded-xl border py-2 text-xs ${
                              v.is_default ? 'border-[var(--cat-accent)] bg-[var(--cat-accent)]/10' : 'border-ink-200'
                            }`}
                            tooltip={
                              v.is_default
                                ? 'Remover o padrão: no catálogo volta o preço próprio desta variação.'
                                : 'Marcar como padrão: no catálogo usa o preço do produto (promo ou base). Outras padrão não são alteradas.'
                            }
                            onClick={() => void toggleDefaultVariant(v)}
                          >
                            {v.is_default ? 'Remover padrão' : 'Def. padrão'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="rounded-xl border border-red-200 py-2 text-sm text-red-600"
                            tooltip="Excluir esta variação permanentemente."
                            onClick={() => void deleteVariant(v.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto rounded-xl border border-ink-100 md:block">
                    <table className="min-w-full text-sm">
                      <thead className="bg-ink-50 text-left text-xs uppercase text-ink-500">
                        <tr>
                          <th className="px-3 py-2">Nome</th>
                          <th className="px-3 py-2">Cor</th>
                          <th className="px-3 py-2">SKU sufixo</th>
                          <th className="px-3 py-2">Preço</th>
                          <th className="px-3 py-2">Qtd</th>
                          <th className="px-3 py-2">Padrão</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {variants.map((v) => (
                          <tr key={v.id}>
                            <td className="px-3 py-2 font-medium">{v.name}</td>
                            <td className="px-3 py-2">
                              {v.colors ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="h-4 w-4 rounded-full ring-1 ring-ink-200" style={{ background: v.colors.hex }} />
                                  {v.colors.name}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-3 py-2">{v.sku_suffix || '—'}</td>
                            <td className="px-3 py-2">
                              <div>
                                {variantPriceDisplay(v).main}
                                {variantPriceDisplay(v).hint ? (
                                  <p className="text-[10px] text-ink-500">{variantPriceDisplay(v).hint}</p>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-2">{v.stock != null ? v.stock : '—'}</td>
                            <td className="px-3 py-2">
                              <Button
                                type="button"
                                variant="ghost"
                                className={`text-xs ${v.is_default ? 'font-semibold text-brand-800' : ''}`}
                                tooltip={
                                  v.is_default
                                    ? 'Remover o padrão: no catálogo volta o preço próprio desta variação.'
                                    : 'Marcar como padrão: no catálogo usa o preço do produto. Outras padrão continuam iguais.'
                                }
                                onClick={() => void toggleDefaultVariant(v)}
                              >
                                {v.is_default ? 'Remover' : 'Definir'}
                              </Button>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                className="text-xs"
                                tooltip="Editar nome, cor, preço e estoque desta variação."
                                onClick={() => startEdit(v)}
                              >
                                Editar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="text-xs text-red-600"
                                tooltip="Excluir esta variação permanentemente."
                                onClick={() => void deleteVariant(v.id)}
                              >
                                Excluir
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-500">Nenhuma variação ainda.</p>
              )
            ) : null}

            {variantPanel === 'create' ? (
              <div className="rounded-xl border border-dashed border-ink-200 p-4">
                <p className="text-xs font-medium text-ink-600">Nova variação</p>
                {productStockNum != null ? (
                  <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">
                    Estoque total: <strong>{productStockNum}</strong> · Já alocado: <strong>{variantsAllocated}</strong> ·
                    Disponível para esta variação:{' '}
                    <strong>{variantsFreeForCreate ?? 0}</strong>
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-amber-700">
                    Defina o estoque total do produto na etapa Preço para distribuir quantidades por variação.
                  </p>
                )}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-ink-500">Nome</label>
                    <Input className="mt-1" value={vName} onChange={(e) => setVName(e.target.value)} placeholder="ex: Linho cinza" />
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">Cor (cadastro)</label>
                    <Select className="mt-1" value={vColor} onChange={(e) => setVColor(e.target.value)}>
                      <option value="">—</option>
                      {colors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.hex})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">Sufixo SKU</label>
                    <Input className="mt-1" value={vSku} onChange={(e) => setVSku(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">Preço específico (opcional)</label>
                    <MoneyField className="mt-1" value={vPrice} onValueChange={(m) => setVPrice(m)} />
                    <p className="mt-1 text-[10px] text-ink-500">Deixe vazio ou zero para usar o preço do produto ({formatCurrency(productListPriceLive)}).</p>
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">Quantidade em estoque</label>
                    <IntegerField
                      className="mt-1"
                      value={vStock}
                      onValueChange={setVStock}
                      min={0}
                      placeholder={productStockNum != null ? `máx. ${variantsFreeForCreate ?? 0}` : 'opcional'}
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    tooltip="Salvar a nova variação; ela aparece no topo da lista (mais recente primeiro)."
                    onClick={() => void addVariant()}
                    disabled={isNew}
                  >
                    Adicionar variação
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    tooltip="Fechar o formulário sem criar a variação."
                    onClick={() => {
                      setVariantPanel('list')
                      setVName('')
                      setVColor('')
                      setVPrice('')
                      setVSku('')
                      setVStock('')
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : null}

            {variantPanel === 'edit' && editVid ? (
              <div className="rounded-xl border border-ink-200 p-4">
                <p className="text-xs font-medium text-ink-600">Editar variação</p>
                {productStockNum != null ? (
                  <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">
                    Estoque total: <strong>{productStockNum}</strong> · Já alocado (outras variações):{' '}
                    <strong>{allocatedStock(variants, editVid)}</strong> · Disponível para esta variação:{' '}
                    <strong>{variantsFreeForEdit ?? 0}</strong>
                  </p>
                ) : null}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-ink-500">Nome</label>
                    <Input className="mt-1" value={evName} onChange={(e) => setEvName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">Cor (cadastro)</label>
                    <Select className="mt-1" value={evColor} onChange={(e) => setEvColor(e.target.value)}>
                      <option value="">Sem cor</option>
                      {colors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">Sufixo SKU</label>
                    <Input className="mt-1" value={evSku} onChange={(e) => setEvSku(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">Preço específico (opcional)</label>
                    <MoneyField className="mt-1" value={evPrice} onValueChange={(m) => setEvPrice(m)} />
                    <p className="mt-1 text-[10px] text-ink-500">
                      {editingDefaultVariant
                        ? `No catálogo aparece ${formatCurrency(productListPriceLive)}. O valor acima será usado quando você remover o padrão.`
                        : 'Deixe vazio ou zero para usar o preço do produto no catálogo.'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">Quantidade em estoque</label>
                    <IntegerField
                      className="mt-1"
                      value={evStock}
                      onValueChange={setEvStock}
                      min={0}
                      placeholder={productStockNum != null ? `máx. ${variantsFreeForEdit ?? 0}` : 'opcional'}
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    tooltip="Gravar as alterações desta variação."
                    onClick={() => void saveVariantEdit()}
                  >
                    Salvar alterações
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    tooltip="Descartar alterações e voltar à lista."
                    onClick={() => {
                      setEditVid(null)
                      setVariantPanel('list')
                      notifyInfo('Edição da variação cancelada.')
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

        <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
          {createStep > 0 ? (
            <Button
              type="button"
              variant="secondary"
              tooltip="Voltar para a etapa anterior do cadastro."
              onClick={() => setCreateStep((s) => Math.max(0, s - 1))}
            >
              Voltar etapa
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            {!isLastStep ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  loading={saving}
                  tooltip="Salvar o progresso desta etapa sem sair do editor."
                  onClick={() => void saveCurrentStep()}
                >
                  Salvar
                </Button>
                <Button
                  type="button"
                  tooltip="Avançar para a próxima etapa do cadastro."
                  onClick={() => setCreateStep((s) => Math.min(createSteps.length - 1, s + 1))}
                >
                  Próxima etapa
                </Button>
              </>
            ) : (
              <Button type="submit" loading={saving} tooltip="Salvar tudo e voltar para a lista de produtos.">
                Concluir e voltar
              </Button>
            )}
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex gap-2">
            {createStep > 0 ? (
              <Button
                type="button"
                variant="secondary"
                className="shrink-0 px-3"
                tooltip="Etapa anterior."
                onClick={() => setCreateStep((s) => Math.max(0, s - 1))}
              >
                Voltar
              </Button>
            ) : null}
            {!isLastStep ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  loading={saving}
                  className="flex-1"
                  tooltip="Salvar esta etapa."
                  onClick={() => void saveCurrentStep()}
                >
                  Salvar
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  tooltip="Próxima etapa."
                  onClick={() => setCreateStep((s) => Math.min(createSteps.length - 1, s + 1))}
                >
                  Próxima
                </Button>
              </>
            ) : (
              <Button type="submit" loading={saving} className="flex-1" tooltip="Salvar e voltar à lista de produtos.">
                Concluir e voltar
              </Button>
            )}
          </div>
        </div>
      </form>

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 bg-ink-900/40" onClick={() => setDeleteOpen(false)}>
          <div
            className="absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-semibold text-ink-900">Excluir produto</h3>
            <p className="mt-2 text-sm text-ink-600">
              Esta ação não pode ser desfeita. Para confirmar, digite exatamente o nome do produto:
            </p>
            <p className="mt-1 text-sm text-ink-900">
              <strong>{name || '—'}</strong>
            </p>
            <div className="mt-4">
              <label className="text-xs font-medium text-ink-600">Confirmação por nome</label>
              <Input
                className="mt-1"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Digite o nome exato do produto"
              />
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                tooltip="Fechar sem excluir o produto."
                onClick={() => setDeleteOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={deleting}
                disabled={deleteConfirmName.trim() !== name.trim()}
                tooltip="Excluir o produto de forma permanente após confirmar o nome."
                onClick={() => void onDeleteProduct()}
              >
                Excluir produto
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
