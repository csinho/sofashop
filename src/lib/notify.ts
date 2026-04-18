import { toast } from 'sonner'

export { toast }

export function notifyOk(message: string) {
  toast.success(message)
}

export function notifyErr(message: string) {
  toast.error(message)
}

export function notifyInfo(message: string) {
  toast.info(message)
}
