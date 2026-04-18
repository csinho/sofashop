export type ViaCepResponse = {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export async function fetchAddressByCep(cep: string): Promise<ViaCepResponse> {
  const clean = cep.replace(/\D/g, '')
  if (clean.length !== 8) {
    throw new Error('CEP deve ter 8 dígitos.')
  }
  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
  if (!res.ok) throw new Error('Não foi possível consultar o CEP.')
  const data = (await res.json()) as ViaCepResponse
  if (data.erro) throw new Error('CEP não encontrado.')
  return data
}
