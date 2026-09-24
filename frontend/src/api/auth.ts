import { useHttp } from '@/composables/useHttp'
import type { AuthResponseType } from '@/types'

const { post } = useHttp()

export const registerUser = (email: string, password: string) =>
  post<AuthResponseType>('/auth/register', { email, password })

export const loginUser = (email: string, password: string) =>
  post<AuthResponseType>('/auth/login', { email, password })

export const refreshSession = () => post<AuthResponseType>('/auth/refresh')

export const logoutUser = () => post<void>('/auth/logout')
