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

export function computeQuarterHoursDelta(
  employeeId: string,
  assignments: AssignmentForValidation[],
  days: DayForValidation[],
  targetHoursByEmployee: Record<string, number>
): number {
  const targetHours = targetHoursByEmployee[employeeId]
  if (targetHours === undefined) return 0
  const actualQuarterHours = computeEmployeeQuarterHours(assignments, employeeId, days)
  return actualQuarterHours - targetHours * 4
}

export function computeDurationQuarterHours(start: string, end: string): number {
  const [startHours, startMinutes] = start.split(':').map(Number)
  const [endHours, endMinutes] = end.split(':').map(Number)
  const startTotal = startHours * 60 + startMinutes
  const endTotal = endHours * 60 + endMinutes
  const diffMinutes = endTotal >= startTotal ? endTotal - startTotal : endTotal + 24 * 60 - startTotal
  return Math.round(diffMinutes / 15)
}

/** Suma kwadransów wszystkich wymaganych obsad w miesiącu (otwarte dni, włączone zmiany). */
export function computeTotalSlotQuarterHours(days: DayForValidation[]): number {
  let total = 0
  for (const day of days) {
    if (day.isClosed) continue
    for (const shift of day.shifts) {
      if (!shift.enabled) continue
      total += (shift.requiredManagerCount + shift.requiredCashierCount) * shift.durationQuarterHours
    }
  }
  return total
}

/**
 * Sprawiedliwy udział godzin (w kwadransach) dla każdego pracownika `zlecenie`: równy podział
 * tego, co zostaje z puli slotów po pokryciu celów UoP. To cel **miękki** — sygnał w punktacji
 * i w balanserze, nigdy filtr odrzucający kandydata, bo maksymalne pokrycie slotów pozostaje
 * priorytetem nr 1 (BUSINESS-REQUIREMENTS.md sekcja 5, reguła 1).
 */
export function computeFairShareQuarterHours(
  days: DayForValidation[],
  employees: EmployeeForValidation[],
  targetHoursByEmployee: Record<string, number>
): Record<string, number> {
  const zlecenieEmployees = employees.filter((employee) => employee.contractType === 'zlecenie')
  if (zlecenieEmployees.length === 0) return {}

  let uopCommittedQuarterHours = 0
  for (const employee of employees) {
    if (employee.contractType !== 'uop') continue
    const targetHours = targetHoursByEmployee[employee.id]
    if (targetHours === undefined) continue
    uopCommittedQuarterHours += targetHours * 4
  }

  const remaining = Math.max(0, computeTotalSlotQuarterHours(days) - uopCommittedQuarterHours)
  const share = remaining / zlecenieEmployees.length

  const fairShareByEmployee: Record<string, number> = {}
  for (const employee of zlecenieEmployees) {
    fairShareByEmployee[employee.id] = share
  }
  return fairShareByEmployee
}
