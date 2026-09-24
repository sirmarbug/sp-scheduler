import { Notify } from 'quasar'

export function useNotification() {
  function positive(title: string, message?: string) {
    Notify.create({ type: 'positive', message: message ? `${title}: ${message}` : title })
  }

  function negative(title: string, message?: string) {
    Notify.create({ type: 'negative', message: message ? `${title}: ${message}` : title })
  }

  return { positive, negative }
}
