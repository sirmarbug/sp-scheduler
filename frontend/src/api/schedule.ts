import { useHttp } from '@/composables/useHttp'
import type { CellOptionType, ScheduleType, ValidationResultType } from '@/types'

const { get, post, patch } = useHttp()

export const getSchedule = (monthValue: string) => get<ScheduleType>(`/schedule/${monthValue}`)

export const generateSchedule = (monthValue: string) => post<ScheduleType>(`/schedule/${monthValue}/generate`)

export const approveSchedule = (monthValue: string) => post<ScheduleType>(`/schedule/${monthValue}/approve`)

export const clearSchedule = (monthValue: string) => post<ScheduleType>(`/schedule/${monthValue}/clear`)

export const getValidation = (monthValue: string) => get<ValidationResultType>(`/schedule/${monthValue}/validation`)

export const getCellOptions = (monthValue: string, employeeId: string, date: string) =>
  get<CellOptionType[]>(`/schedule/${monthValue}/cell-options`, { params: { employeeId, date } })

export const updateCell = (monthValue: string, employeeId: string, date: string, option: CellOptionType | null) =>
  patch<ScheduleType, { employeeId: string; date: string; option: CellOptionType | null }>(
    `/schedule/${monthValue}/cell`,
    { employeeId, date, option }
  )
