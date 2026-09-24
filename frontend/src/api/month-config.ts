import { useHttp } from '@/composables/useHttp'
import type { MonthConfigType } from '@/types'

const { get, post, patch } = useHttp()

export const createMonthConfig = (year: number, monthIndex: number) =>
  post<MonthConfigType, { year: number; monthIndex: number }>('/month-config', { year, monthIndex })

export const getMonthConfig = (monthValue: string) => get<MonthConfigType>(`/month-config/${monthValue}`)

export const updateDay = (monthValue: string, date: string, isClosed: boolean) =>
  patch<MonthConfigType, { isClosed: boolean }>(`/month-config/${monthValue}/days/${date}`, { isClosed })
