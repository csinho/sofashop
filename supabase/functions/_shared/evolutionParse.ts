/** Resposta create (Evolution 2.3.x): hash pode ser string ou { apikey }. */
export function extractCreateToken(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const hash = d.hash
  if (typeof hash === 'string' && hash.trim()) return hash.trim()
  if (hash && typeof hash === 'object') {
    const apikey = (hash as { apikey?: string }).apikey
    if (apikey) return String(apikey)
  }
  const token = d.token
  if (typeof token === 'string' && token.trim()) return token.trim()
  return null
}

export function extractCreateInstanceId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const inst = (data as { instance?: Record<string, unknown> }).instance
  if (!inst) return null
  const id = inst.instanceId ?? inst.id
  return id ? String(id) : null
}

/** fetchInstances: objeto único ou array (v2.3.x). */
export function normalizeFetchedInstance(data: unknown): Record<string, unknown> | null {
  if (!data) return null
  if (Array.isArray(data)) {
    const first = data[0]
    if (!first) return null
    return (first as { instance?: Record<string, unknown> }).instance ?? (first as Record<string, unknown>)
  }
  if (typeof data === 'object') {
    return (data as { instance?: Record<string, unknown> }).instance ?? (data as Record<string, unknown>)
  }
  return null
}

export function profilePatchFromEvolution(
  inst: Record<string, unknown>,
  row: { profile_name: string | null; profile_picture_url: string | null; owner_number: string | null; owner_jid: string | null; connection_state: string | null; instance_id: string | null },
) {
  const ownerJid = String(inst.ownerJid ?? inst.owner ?? '')
  const ownerNumber =
    String(inst.number ?? '').replace(/\D/g, '') ||
    ownerJid.replace(/@.*/, '').replace(/\D/g, '') ||
    row.owner_number

  const conn = String(inst.connectionStatus ?? inst.status ?? row.connection_state ?? '')

  return {
    profile_name: String(inst.profileName ?? inst.profile_name ?? row.profile_name ?? '') || row.profile_name,
    profile_picture_url: String(inst.profilePicUrl ?? inst.profilePictureUrl ?? row.profile_picture_url ?? '') ||
      row.profile_picture_url,
    owner_jid: ownerJid || row.owner_jid,
    owner_number: ownerNumber || row.owner_number,
    connection_state: conn === 'open' ? 'open' : conn === 'connecting' ? 'connecting' : conn ? 'close' : row.connection_state,
    instance_id: String(inst.id ?? inst.instanceId ?? row.instance_id ?? '') || row.instance_id,
  }
}

/** Resposta /instance/connect: base64 = imagem; code = payload Baileys (ex.: 2@...), não é PNG. */
export function parseConnectResponse(data: unknown) {
  if (!data || typeof data !== 'object') {
    return { pairingCode: null as string | null, qrBase64: null as string | null, qrPayload: null as string | null, count: 0 }
  }
  const d = data as Record<string, unknown>
  const pairingCode = d.pairingCode != null ? String(d.pairingCode) : null
  const count = typeof d.count === 'number' ? d.count : 0

  const rawBase64 = d.base64 != null ? String(d.base64) : null
  let qrBase64: string | null = null
  if (rawBase64) {
    qrBase64 = rawBase64.startsWith('data:') ? rawBase64 : `data:image/png;base64,${rawBase64}`
  }

  const code = d.code != null ? String(d.code) : null
  let qrPayload: string | null = null
  if (code && !qrBase64) {
    if (code.startsWith('2@') || code.startsWith('1@') || code.includes('@')) {
      qrPayload = code
    } else if (/^[A-Za-z0-9+/=]+$/.test(code.replace(/\s/g, ''))) {
      qrBase64 = `data:image/png;base64,${code}`
    } else {
      qrPayload = code
    }
  }

  return { pairingCode, qrBase64, qrPayload, count }
}

export function mapConnectionStatePayload(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const inst = d.instance as Record<string, unknown> | undefined
  const state = inst?.state ?? d.state ?? inst?.connectionStatus ?? d.connectionStatus
  if (!state) return null
  const s = String(state)
  if (s === 'open') return 'open'
  if (s === 'connecting') return 'connecting'
  return 'close'
}
