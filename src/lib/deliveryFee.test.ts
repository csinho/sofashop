import { describe, expect, it } from 'vitest'
import { calcularTaxaEntrega, normalizeCityKey } from './deliveryFee'

const tabela = [
  { city_key: 'salvador', fee: 30 },
  { city_key: 'camacari', fee: 50 },
  { city_key: 'feira_de_santana', fee: 80 },
  { city_key: 'praia_do_forte', fee: 100 },
] as const

describe('normalizeCityKey', () => {
  it('normaliza acentos, cedilha e espaços', () => {
    expect(normalizeCityKey('Mata de São João')).toBe('mata_de_sao_joao')
    expect(normalizeCityKey('Simões Filho')).toBe('simoes_filho')
    expect(normalizeCityKey("Dias d'Ávila")).toBe('dias_davila')
  })
})

describe('calcularTaxaEntrega', () => {
  it('retorna taxa cadastrada quando encontrada', () => {
    const q = calcularTaxaEntrega('Camaçari', tabela)
    expect(q).toEqual({
      cidade_normalizada: 'camacari',
      taxa_entrega: 50,
      moeda: 'BRL',
      encontrado: true,
    })
  })

  it('retorna taxa padrão quando cidade desconhecida', () => {
    const q = calcularTaxaEntrega('Cidade X', tabela, 100)
    expect(q.encontrado).toBe(false)
    expect(q.taxa_entrega).toBe(100)
  })

  it('retorna vazio e padrão para cidade em branco', () => {
    const q = calcularTaxaEntrega('  ', tabela, 100)
    expect(q.cidade_normalizada).toBe('')
    expect(q.encontrado).toBe(false)
    expect(q.taxa_entrega).toBe(100)
  })
})
