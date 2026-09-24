import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getValidation } from '@/api/schedule'
import type { ValidationResultType } from '@/types'

export const useValidationStore = defineStore('validation', () => {
  const result = ref<ValidationResultType | null>(null)
  const loading = ref(false)

  async function refresh(monthValue: string) {
    loading.value = true
    const { data, request, isFailed } = getValidation(monthValue)
    await request()
    loading.value = false
    if (isFailed.value || !data.value) return
    result.value = data.value
  }

  return { result, loading, refresh }
})
