import { defineStore } from 'pinia'
import { ref } from 'vue'
import { allRequests, createRequest, deleteRequest } from '@/api/requests'
import type { CreateRequestRequest, RequestDtoType } from '@/types'

export const useRequestsStore = defineStore('requests', () => {
  const requests = ref<RequestDtoType[]>([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    const { data, request, isFailed } = allRequests()
    await request()
    loading.value = false
    if (isFailed.value || !data.value) return
    requests.value = data.value
  }

  async function add(payload: CreateRequestRequest) {
    const { data, request, isFailed } = createRequest(payload)
    await request()
    if (isFailed.value || !data.value) return false
    requests.value.push(data.value)
    return true
  }

  async function remove(id: string) {
    const { request, isFailed } = deleteRequest(id)
    await request()
    if (isFailed.value) return false
    requests.value = requests.value.filter((r) => r.id !== id)
    return true
  }

  return { requests, loading, fetchAll, add, remove }
})
