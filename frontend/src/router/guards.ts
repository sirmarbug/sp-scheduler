import type { NavigationGuard } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export const requireAuth: NavigationGuard = async (_to, _from, next) => {
  const authStore = useAuthStore()
  if (authStore.isAuthenticated) {
    next()
    return
  }

  const restored = await authStore.tryRestoreSession()
  if (restored) {
    next()
    return
  }
  next({ name: 'login' })
}

export const redirectIfAuthenticated: NavigationGuard = (_to, _from, next) => {
  const authStore = useAuthStore()
  if (authStore.isAuthenticated) {
    next({ name: 'employees' })
    return
  }
  next()
}
