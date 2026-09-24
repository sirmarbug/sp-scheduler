import { ref } from 'vue'

export function useConfirmDialog() {
  const visible = ref(false)
  const title = ref('')
  const message = ref('')
  let resolvePromise: ((confirmed: boolean) => void) | null = null

  function open(dialogTitle: string, dialogMessage: string) {
    title.value = dialogTitle
    message.value = dialogMessage
    visible.value = true
    return new Promise<boolean>((resolve) => {
      resolvePromise = resolve
    })
  }

  function confirm() {
    visible.value = false
    resolvePromise?.(true)
  }

  function reject() {
    visible.value = false
    resolvePromise?.(false)
  }

  return { visible, title, message, open, confirm, reject }
}
