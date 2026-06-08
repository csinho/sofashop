const RECOVERY_KEY = 'vender.auth.recoveryPending'

export function isRecoveryInUrl(): boolean {
  if (typeof window === 'undefined') return false

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (hashParams.get('type') === 'recovery') return true

  const searchParams = new URLSearchParams(window.location.search)
  if (searchParams.get('type') === 'recovery') return true
  if (searchParams.get('token_hash')) return true
  if (searchParams.get('code') && window.location.pathname === '/redefinir-senha') return true

  return false
}

export function hasRecoveryPending(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === '1'
  } catch {
    return false
  }
}

/** Grava o flag antes do Supabase consumir o hash da URL. */
export function captureRecoveryFromUrl(): boolean {
  if (isRecoveryInUrl()) {
    markRecoveryPending()
    return true
  }
  return hasRecoveryPending()
}

export function markRecoveryPending() {
  try {
    sessionStorage.setItem(RECOVERY_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearRecoveryPending() {
  try {
    sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    /* ignore */
  }
}
