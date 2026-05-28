import { getSupabaseBrowserClient } from '@/integrations/supabase/client'
import type { StoreDeliveryCityRow, StoreDeliverySettingsRow } from '@/types/database'

export type StoreDeliveryRates = {
  defaultFee: number
  cities: Pick<StoreDeliveryCityRow, 'id' | 'city_key' | 'display_name' | 'fee' | 'sort_order'>[]
}

export async function fetchStoreDeliveryRates(storeId: string): Promise<StoreDeliveryRates> {
  const sb = getSupabaseBrowserClient()
  const [settingsRes, citiesRes] = await Promise.all([
    sb.from('store_delivery_settings').select('default_fee').eq('store_id', storeId).maybeSingle(),
    sb
      .from('store_delivery_cities')
      .select('id, city_key, display_name, fee, sort_order')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true })
      .order('display_name', { ascending: true }),
  ])

  if (settingsRes.error) throw settingsRes.error
  if (citiesRes.error) throw citiesRes.error

  return {
    defaultFee: Number(settingsRes.data?.default_fee ?? 100),
    cities: (citiesRes.data ?? []) as StoreDeliveryRates['cities'],
  }
}

export async function saveStoreDeliveryDefaultFee(storeId: string, defaultFee: number) {
  const sb = getSupabaseBrowserClient()
  const { error } = await sb.from('store_delivery_settings').upsert({
    store_id: storeId,
    default_fee: defaultFee,
  })
  if (error) throw error
}

export async function addStoreDeliveryCity(
  storeId: string,
  displayName: string,
  cityKey: string,
  fee: number,
) {
  const sb = getSupabaseBrowserClient()
  const { error } = await sb.from('store_delivery_cities').insert({
    store_id: storeId,
    display_name: displayName.trim(),
    city_key: cityKey,
    fee,
    sort_order: 999,
  })
  if (error) throw error
}

export async function updateStoreDeliveryCityFee(cityId: string, fee: number) {
  const sb = getSupabaseBrowserClient()
  const { error } = await sb.from('store_delivery_cities').update({ fee }).eq('id', cityId)
  if (error) throw error
}

export async function updateStoreDeliveryCityDisplayName(cityId: string, displayName: string, cityKey: string) {
  const sb = getSupabaseBrowserClient()
  const { error } = await sb
    .from('store_delivery_cities')
    .update({ display_name: displayName.trim(), city_key: cityKey })
    .eq('id', cityId)
  if (error) throw error
}

export async function removeStoreDeliveryCity(cityId: string) {
  const sb = getSupabaseBrowserClient()
  const { error } = await sb.from('store_delivery_cities').delete().eq('id', cityId)
  if (error) throw error
}

export async function updateDeliveryFeeForAllCitiesWithFee(storeId: string, oldFee: number, newFee: number) {
  const sb = getSupabaseBrowserClient()
  const { error } = await sb
    .from('store_delivery_cities')
    .update({ fee: newFee })
    .eq('store_id', storeId)
    .eq('fee', oldFee)
  if (error) throw error
}

export async function restoreStoreDeliveryDefaults(storeId: string) {
  const sb = getSupabaseBrowserClient()
  const { error: delErr } = await sb.from('store_delivery_cities').delete().eq('store_id', storeId)
  if (delErr) throw delErr
  const { error } = await sb.rpc('seed_store_delivery_cities', { p_store_id: storeId })
  if (error) throw error
}

export type { StoreDeliverySettingsRow, StoreDeliveryCityRow }
