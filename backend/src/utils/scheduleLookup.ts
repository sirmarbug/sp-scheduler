import type { DayForValidation, MonthConfigForValidation, ShiftForValidation } from '../types/schedule.js'

export function findDay(monthConfig: MonthConfigForValidation, date: string): DayForValidation | undefined {
  return monthConfig.days.find((d) => d.date === date)
}

export function findShift(day: DayForValidation | undefined, shiftId: string): ShiftForValidation | undefined {
  return day?.shifts.find((s) => s.id === shiftId)
}
