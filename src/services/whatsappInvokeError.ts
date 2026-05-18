import { FunctionsHttpError } from '@supabase/supabase-js'

type EdgeErrorBody = {
  error?: string
  details?: unknown
}

export async function readEdgeFunctionError(error: Error): Promise<string> {
  if (!(error instanceof FunctionsHttpError)) {
    return error.message
  }

  try {
    const body = (await error.context.json()) as EdgeErrorBody
    if (body?.error) {
      if (body.details && typeof body.details === 'object') {
        const d = body.details as { message?: string | string[]; response?: { message?: string[] } }
        const extra =
          d.message ??
          (Array.isArray(d.response?.message) ? d.response.message.join(', ') : undefined)
        if (extra) return `${body.error} (${String(extra)})`
      }
      return body.error
    }
  } catch {
    /* mantém mensagem padrão */
  }

  return error.message
}
