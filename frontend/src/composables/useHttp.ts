import axios, { type AxiosRequestConfig } from 'axios'
import { computed, ref } from 'vue'
import { router } from '@/router'
import { useAuthStore } from '@/stores/auth'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
})

client.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  if (authStore.accessToken) {
    config.headers.Authorization = `Bearer ${authStore.accessToken}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      authStore.clearSession()
      router.push({ name: 'login' })
    }
    return Promise.reject(error)
  }
)

export function useHttp() {
  function request<D>(config: AxiosRequestConfig) {
    const data = ref<D | null>(null)
    const loading = ref(true)
    const error = ref<unknown>(null)
    const isSuccessed = computed(() => !loading.value && !error.value)
    const isFailed = computed(() => !loading.value && !!error.value)

    async function execute() {
      loading.value = true
      error.value = null
      try {
        const response = await client.request<D>(config)
        data.value = response.data
      } catch (err) {
        error.value = err
      } finally {
        loading.value = false
      }
    }

    return { data, loading, error, isSuccessed, isFailed, request: execute }
  }

  const get = <D>(url: string, config?: AxiosRequestConfig) => request<D>({ ...config, url, method: 'get' })
  const post = <D, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig) =>
    request<D>({ ...config, url, method: 'post', data: body })
  const put = <D, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig) =>
    request<D>({ ...config, url, method: 'put', data: body })
  const patch = <D, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig) =>
    request<D>({ ...config, url, method: 'patch', data: body })
  const remove = <D>(url: string, config?: AxiosRequestConfig) => request<D>({ ...config, url, method: 'delete' })

  return { get, post, put, patch, remove }
}
