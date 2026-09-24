import { ref } from 'vue'
import { getCellOptions } from '@/api/schedule'
import type { CellOptionType } from '@/types'

export function useCellOptions() {
  const visible = ref(false)
  const loading = ref(false)
  const employeeId = ref('')
  const date = ref('')
  const options = ref<CellOptionType[]>([])

  async function open(monthValue: string, targetEmployeeId: string, targetDate: string) {
    employeeId.value = targetEmployeeId
    date.value = targetDate
    visible.value = true
    loading.value = true
    const { data, request, isFailed } = getCellOptions(monthValue, targetEmployeeId, targetDate)
    await request()
    loading.value = false
    options.value = isFailed.value || !data.value ? [] : data.value
  }

  function close() {
    visible.value = false
    options.value = []
  }

  return { visible, loading, employeeId, date, options, open, close }
}
