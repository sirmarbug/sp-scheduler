import { defineStore } from 'pinia'
import { ref } from 'vue'
import { approveSchedule, clearSchedule, generateSchedule, getSchedule, updateCell } from '@/api/schedule'
import { useValidationStore } from '@/stores/validation'
import type { CellOptionType, ScheduleType } from '@/types'

export const useScheduleStore = defineStore('schedule', () => {
  const current = ref<ScheduleType | null>(null)
  const loading = ref(false)
  const generating = ref(false)

  async function fetchByMonthValue(monthValue: string) {
    loading.value = true
    const { data, request, isFailed } = getSchedule(monthValue)
    await request()
    loading.value = false
    if (isFailed.value || !data.value) return false
    current.value = data.value
    return true
  }

  async function generate(monthValue: string) {
    generating.value = true
    const { data, request, isFailed } = generateSchedule(monthValue)
    await request()
    generating.value = false
    if (isFailed.value || !data.value) return false
    current.value = data.value
    const validationStore = useValidationStore()
    await validationStore.refresh(monthValue)
    return true
  }

  async function approve(monthValue: string) {
    const { data, request, isFailed } = approveSchedule(monthValue)
    await request()
    if (isFailed.value || !data.value) return false
    current.value = data.value
    return true
  }

  async function clear(monthValue: string) {
    const { data, request, isFailed } = clearSchedule(monthValue)
    await request()
    if (isFailed.value || !data.value) return false
    current.value = data.value
    const validationStore = useValidationStore()
    await validationStore.refresh(monthValue)
    return true
  }

  async function updateAssignment(monthValue: string, employeeId: string, date: string, option: CellOptionType | null) {
    const { data, request, isFailed } = updateCell(monthValue, employeeId, date, option)
    await request()
    if (isFailed.value || !data.value) return false
    current.value = data.value
    const validationStore = useValidationStore()
    await validationStore.refresh(monthValue)
    return true
  }

  return { current, loading, generating, fetchByMonthValue, generate, approve, clear, updateAssignment }
})
