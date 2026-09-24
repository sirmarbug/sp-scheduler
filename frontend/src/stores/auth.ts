import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { loginUser, logoutUser, refreshSession, registerUser } from '@/api/auth'
import type { AuthUserType } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<AuthUserType | null>(null)
  const accessToken = ref<string | null>(null)
  const isAuthenticated = computed(() => !!accessToken.value)

  function setSession(user: AuthUserType, token: string) {
    currentUser.value = user
    accessToken.value = token
  }

  function clearSession() {
    currentUser.value = null
    accessToken.value = null
  }

  async function register(email: string, password: string) {
    const { data, request, isFailed } = registerUser(email, password)
    await request()
    if (isFailed.value || !data.value) return false
    setSession(data.value.user, data.value.accessToken)
    return true
  }

  async function login(email: string, password: string) {
    const { data, request, isFailed } = loginUser(email, password)
    await request()
    if (isFailed.value || !data.value) return false
    setSession(data.value.user, data.value.accessToken)
    return true
  }

  async function logout() {
    const { request } = logoutUser()
    await request()
    clearSession()
  }

  async function tryRestoreSession() {
    const { data, request, isFailed } = refreshSession()
    await request()
    if (isFailed.value || !data.value) return false
    setSession(data.value.user, data.value.accessToken)
    return true
  }

  return { currentUser, accessToken, isAuthenticated, setSession, clearSession, register, login, logout, tryRestoreSession }
})
