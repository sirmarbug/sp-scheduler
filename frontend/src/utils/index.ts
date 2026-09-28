import axios from 'axios'

export function getErrorMessage(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message
  }
  return undefined
}
