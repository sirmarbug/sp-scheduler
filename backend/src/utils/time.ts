import dayjs from '../config/dayjs.js'
import type { AssignmentForValidation, DayForValidation, EmployeeForValidation } from '../types/schedule.js'

const QUARTER_HOURS_PER_WORK_DAY = 32 // 8h * 4 (quarter-hour blocks)

export function computeTargetQuarterHours(days: DayForValidation[]): number {
  const businessDays = days.filter((day) => {
    if (day.isClosed) return false
    const weekday = dayjs(day.date).isoWeekday()
    return weekday >= 1 && weekday <= 5
  })
  return businessDays.length * QUARTER_HOURS_PER_WORK_DAY
}

export function computeEmployeeQuarterHours(
  assignments: AssignmentForValidation[],
  employeeId: string,
  days: DayForValidation[]
): number {
  let totalQuarterHours = 0
  for (const assignment of assignments) {
    if (assignment.employeeId !== employeeId) continue
    const day = days.find((d) => d.date === assignment.date)
    const shift = day?.shifts.find((s) => s.id === assignment.shiftId)
    if (!shift) continue
    totalQuarterHours += shift.durationQuarterHours
  }
  return totalQuarterHours
}

export function resolveTargetQuarterHours(
  employee: EmployeeForValidation,
  days: DayForValidation[],
  targetHoursOverrides: Map<string, number>
): number | null {
  if (employee.contractType !== 'uop') return null
  const autoTargetHours = computeTargetQuarterHours(days) / 4
  const targetHours = targetHoursOverrides.get(employee.id) ?? autoTargetHours
  return targetHours * 4
}

export function computeDurationQuarterHours(start: string, end: string): number {
  const [startHours, startMinutes] = start.split(':').map(Number)
  const [endHours, endMinutes] = end.split(':').map(Number)
  const startTotal = startHours * 60 + startMinutes
  const endTotal = endHours * 60 + endMinutes
  const diffMinutes = endTotal >= startTotal ? endTotal - startTotal : endTotal + 24 * 60 - startTotal
  return Math.round(diffMinutes / 15)
}
