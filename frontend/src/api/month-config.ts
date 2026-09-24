import { useHttp } from '@/composables/useHttp'
import type { MonthConfigType, ShiftDtoType, UpsertShiftRequest } from '@/types'

const { get, post, patch, remove } = useHttp()

export const createMonthConfig = (year: number, monthIndex: number) =>
  post<MonthConfigType, { year: number; monthIndex: number }>('/month-config', { year, monthIndex })

export const getMonthConfig = (monthValue: string) => get<MonthConfigType>(`/month-config/${monthValue}`)

export const updateDay = (monthValue: string, date: string, isClosed: boolean) =>
  patch<MonthConfigType, { isClosed: boolean }>(`/month-config/${monthValue}/days/${date}`, { isClosed })

export const createShift = (monthValue: string, date: string, body: UpsertShiftRequest) =>
  post<ShiftDtoType, UpsertShiftRequest>(`/month-config/${monthValue}/days/${date}/shifts`, body)

export const updateShift = (monthValue: string, date: string, shiftId: string, body: Partial<UpsertShiftRequest>) =>
  patch<ShiftDtoType, Partial<UpsertShiftRequest>>(`/month-config/${monthValue}/days/${date}/shifts/${shiftId}`, body)

export const removeShift = (monthValue: string, date: string, shiftId: string) =>
  remove<void>(`/month-config/${monthValue}/days/${date}/shifts/${shiftId}`)
