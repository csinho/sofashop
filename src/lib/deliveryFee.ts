export type DeliveryFeeQuote = {
  cidade_normalizada: string
  taxa_entrega: number
  moeda: 'BRL'
  encontrado: boolean
}

export type DeliveryCityRate = {
  city_key: string
  fee: number
}

const DEFAULT_DELIVERY_FEE = 100

/** Normaliza nome de cidade para chave de lookup (espelha `public.normalize_city_key` no Postgres). */
export function normalizeCityKey(cidade: string): string {
  let s = cidade.trim().toLowerCase()
  s = s.replace(/[''`´]/g, '')
  s = s.normalize('NFD').replace(/\p{M}/gu, '')
  s = s.replace(/ç/g, 'c')
  s = s.replace(/[^a-z0-9]+/g, '_')
  s = s.replace(/^_+|_+$/g, '')
  s = s.replace(/_+/g, '_')
  return s
}

export function calcularTaxaEntrega(
  cidade: string,
  tabela: ReadonlyArray<DeliveryCityRate>,
  taxaPadrao: number = DEFAULT_DELIVERY_FEE,
): DeliveryFeeQuote {
  const cidade_normalizada = normalizeCityKey(cidade)
  if (!cidade_normalizada) {
    return {
      cidade_normalizada: '',
      taxa_entrega: taxaPadrao,
      moeda: 'BRL',
      encontrado: false,
    }
  }

  const row = tabela.find((r) => r.city_key === cidade_normalizada)
  if (row) {
    return {
      cidade_normalizada,
      taxa_entrega: row.fee,
      moeda: 'BRL',
      encontrado: true,
    }
  }

  return {
    cidade_normalizada,
    taxa_entrega: taxaPadrao,
    moeda: 'BRL',
    encontrado: false,
  }
}

export const DEFAULT_DELIVERY_FEE_BRL = DEFAULT_DELIVERY_FEE
