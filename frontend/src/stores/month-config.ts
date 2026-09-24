import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createMonthConfig, createShift, getMonthConfig, removeShift, updateDay, updateShift } from '@/api/month-config'
import type { MonthConfigType, ShiftDtoType, UpsertShiftRequest } from '@/types'

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

  function replaceDayShifts(date: string, mapShifts: (shifts: ShiftDtoType[]) => ShiftDtoType[]) {
    if (!current.value) return
    current.value = {
      ...current.value,
      days: current.value.days.map((day) => (day.date === date ? { ...day, shifts: mapShifts(day.shifts) } : day)),
    }
  }

  async function addShift(date: string, body: UpsertShiftRequest) {
    if (!current.value) return false
    const { data, request, isFailed } = createShift(current.value.monthValue, date, body)
    await request()
    if (isFailed.value || !data.value) return false
    replaceDayShifts(date, (shifts) => [...shifts, data.value as ShiftDtoType])
    return true
  }

  async function editShift(date: string, shiftId: string, body: Partial<UpsertShiftRequest>) {
    if (!current.value) return false
    const { data, request, isFailed } = updateShift(current.value.monthValue, date, shiftId, body)
    await request()
    if (isFailed.value || !data.value) return false
    const updated = data.value
    replaceDayShifts(date, (shifts) => shifts.map((shift) => (shift.id === shiftId ? updated : shift)))
    return true
  }

  async function deleteShift(date: string, shiftId: string) {
    if (!current.value) return false
    const { request, isFailed } = removeShift(current.value.monthValue, date, shiftId)
    await request()
    if (isFailed.value) return false
    replaceDayShifts(date, (shifts) => shifts.filter((shift) => shift.id !== shiftId))
    return true
  }

  return { current, loading, createForMonth, fetchByMonthValue, toggleDayClosed, addShift, editShift, deleteShift }
})
