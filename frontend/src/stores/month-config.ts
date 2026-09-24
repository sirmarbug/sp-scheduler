import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createMonthConfig, getMonthConfig, updateDay } from '@/api/month-config'
import type { MonthConfigType } from '@/types'

export const useMonthConfigStore = defineStore('month-config', () => {
  const current = ref<MonthConfigType | null>(null)
  const loading = ref(false)

  async function createForMonth(year: number, monthIndex: number) {
    loading.value = true
    const { data, request, isFailed } = createMonthConfig(year, monthIndex)
    await request()
    loading.value = false
    if (isFailed.value || !data.value) return false
    current.value = data.value
    return true
  }

  async function fetchByMonthValue(monthValue: string) {
    loading.value = true
    const { data, request, isFailed } = getMonthConfig(monthValue)
    await request()
    loading.value = false
    if (isFailed.value || !data.value) return false
    current.value = data.value
    return true
  }

  async function toggleDayClosed(date: string, isClosed: boolean) {
    if (!current.value) return false
    const { data, request, isFailed } = updateDay(current.value.monthValue, date, isClosed)
    await request()
    if (isFailed.value || !data.value) return false
    current.value = data.value
    return true
  }

  return { current, loading, createForMonth, fetchByMonthValue, toggleDayClosed }
})
