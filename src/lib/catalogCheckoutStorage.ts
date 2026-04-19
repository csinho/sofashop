const KEY_PREFIX = 'vender:catalogCheckout:'

export type StoredCheckoutIdentity = {
  customerId: string | null
  fullName: string
  phone: string
  phoneSecondary: string
  cep: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
}

function keyForStore(storeId: string) {
  return `${KEY_PREFIX}${storeId}`
}

export function loadCheckoutIdentity(storeId: string): StoredCheckoutIdentity | null {
  try {
    const raw = localStorage.getItem(keyForStore(storeId))
    if (!raw) return null
    const o = JSON.parse(raw) as Partial<StoredCheckoutIdentity>
    if (typeof o.fullName !== 'string' || typeof o.phone !== 'string') return null
    return {
      customerId: typeof o.customerId === 'string' ? o.customerId : null,
      fullName: o.fullName,
      phone: o.phone,
      phoneSecondary: typeof o.phoneSecondary === 'string' ? o.phoneSecondary : '',
      cep: typeof o.cep === 'string' ? o.cep : '',
      street: typeof o.street === 'string' ? o.street : '',
      number: typeof o.number === 'string' ? o.number : '',
      complement: typeof o.complement === 'string' ? o.complement : '',
      district: typeof o.district === 'string' ? o.district : '',
      city: typeof o.city === 'string' ? o.city : '',
      state: typeof o.state === 'string' ? o.state : 'SP',
    }
  } catch {
    return null
  }
}

export function saveCheckoutIdentity(storeId: string, data: StoredCheckoutIdentity) {
  try {
    localStorage.setItem(keyForStore(storeId), JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}
