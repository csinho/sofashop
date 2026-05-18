export const TEMPLATE_VARIABLES = ['NOME_CLIENTE', 'NUMERO_PEDIDO', 'STATUS_PEDIDO'] as const

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]

export type TemplateValues = Record<TemplateVariable, string>

const VAR_RE = /\{\{([A-Z0-9_]+)\}\}/g

export function applyMessageTemplate(template: string, values: Partial<TemplateValues>): string {
  return template.replace(VAR_RE, (_, key: string) => {
    const k = key as TemplateVariable
    return values[k] ?? `{{${key}}}`
  })
}

export function findUnknownTemplateVariables(template: string): string[] {
  const known = new Set<string>(TEMPLATE_VARIABLES)
  const unknown: string[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(VAR_RE.source, 'g')
  while ((m = re.exec(template)) !== null) {
    if (!known.has(m[1]) && !unknown.includes(m[1])) unknown.push(m[1])
  }
  return unknown
}

export const DEFAULT_STATUS_TEMPLATES: Record<string, string> = {
  novo: 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi registrado. Status: {{STATUS_PEDIDO}}.',
  em_analise: 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está em análise. Status: {{STATUS_PEDIDO}}.',
  aprovado: 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi aprovado. Status: {{STATUS_PEDIDO}}.',
  em_producao: 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está em produção. Status: {{STATUS_PEDIDO}}.',
  pronto_entrega:
    'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} está pronto para entrega. Status: {{STATUS_PEDIDO}}.',
  entregue: 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi entregue. Status: {{STATUS_PEDIDO}}.',
  cancelado: 'Olá {{NOME_CLIENTE}}! Seu pedido {{NUMERO_PEDIDO}} foi cancelado. Status: {{STATUS_PEDIDO}}.',
}

export type NotifySettingItem = { enabled: boolean; template: string }

/** Valor inicial para INSERT em store_whatsapp_instances (coluna notify_settings NOT NULL). */
export function defaultNotifySettingsRecord(): Record<string, NotifySettingItem> {
  return Object.fromEntries(
    Object.entries(DEFAULT_STATUS_TEMPLATES).map(([status, template]) => [
      status,
      { enabled: false, template },
    ]),
  )
}

export function resolveStatusTemplate(
  settings: Record<string, NotifySettingItem> | null | undefined,
  status: string,
): { enabled: boolean; template: string } {
  const item = settings?.[status]
  const enabled = Boolean(item?.enabled)
  const template = (item?.template ?? '').trim() || DEFAULT_STATUS_TEMPLATES[status] || DEFAULT_STATUS_TEMPLATES.novo
  return { enabled, template }
}
