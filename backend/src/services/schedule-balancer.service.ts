import dayjs from '../config/dayjs.js'
import { canFillRole } from '../utils/roleEligibility.js'
import { isAvoided } from '../utils/requestMatching.js'
import { findDay, findShift } from '../utils/scheduleLookup.js'
import { computeQuarterHoursDelta } from '../utils/time.js'
import type {
  AssignmentForValidation,
  EmployeeForValidation,
  MonthConfigForValidation,
  RequestForValidation,
  ShiftForValidation,
} from '../types/schedule.js'

const MAX_WORK_DAYS_PER_ISO_WEEK = 6

function isoWeekKeyOf(date: string): string {
  return `${dayjs(date).isoWeekYear()}-W${dayjs(date).isoWeek()}`
}

function workDaysInIsoWeek(working: AssignmentForValidation[], employeeId: string, date: string): Set<string> {
  const key = isoWeekKeyOf(date)
  const days = new Set<string>()
  for (const a of working) {
    if (a.employeeId !== employeeId) continue
    if (isoWeekKeyOf(a.date) !== key) continue
    days.add(a.date)
  }
  return days
}

function isEligibleForSlot(
  employee: EmployeeForValidation,
  shift: ShiftForValidation,
  role: 'manager' | 'cashier',
  date: string,
  working: AssignmentForValidation[],
  requests: RequestForValidation[]
): boolean {
  if (!canFillRole(employee, shift, role)) return false
  if (isAvoided(requests, employee.id, date, shift.id)) return false
  if (working.some((a) => a.employeeId === employee.id && a.date === date)) return false
  if (workDaysInIsoWeek(working, employee.id, date).size >= MAX_WORK_DAYS_PER_ISO_WEEK) return false
  return true
}

/**
 * Usuwa przypisania, które łamią reguły niemożliwe do naprawienia przez przeniesienie
 * (duplikat pracownik/dzień, dzień zamknięty/wyłączona zmiana, blokada avoid, brak uprawnień do roli).
 */
function dropInvalidAssignments(
  assignments: AssignmentForValidation[],
  monthConfig: MonthConfigForValidation,
  employeeById: Map<string, EmployeeForValidation>,
  requests: RequestForValidation[]
): AssignmentForValidation[] {
  const result: AssignmentForValidation[] = []
  const seenEmployeeDay = new Set<string>()

  for (const assignment of assignments) {
    const employee = employeeById.get(assignment.employeeId)
    const day = findDay(monthConfig, assignment.date)
    const shift = findShift(day, assignment.shiftId)

    if (!employee || !day || day.isClosed || !shift || !shift.enabled) continue

    const dayKey = `${assignment.employeeId}|${assignment.date}`
    if (seenEmployeeDay.has(dayKey)) continue
    if (isAvoided(requests, assignment.employeeId, assignment.date, assignment.shiftId)) continue
    if (!canFillRole(employee, shift, assignment.role)) continue

    seenEmployeeDay.add(dayKey)
    result.push({ ...assignment })
  }

  return result
}

/** Usuwa nadmiarowe przypisania per slot, preferując pracowników UoP ponad celem, potem zlecenie. */
function trimExcessCoverage(
  assignments: AssignmentForValidation[],
  monthConfig: MonthConfigForValidation,
  employeeById: Map<string, EmployeeForValidation>,
  targetHoursByEmployee: Record<string, number>
): AssignmentForValidation[] {
  let result = [...assignments]

  for (const day of monthConfig.days) {
    if (day.isClosed) continue
    for (const shift of day.shifts) {
      if (!shift.enabled) continue
      for (const role of ['manager', 'cashier'] as const) {
        const required = role === 'manager' ? shift.requiredManagerCount : shift.requiredCashierCount
        const slotAssignments = result.filter((a) => a.date === day.date && a.shiftId === shift.id && a.role === role)
        if (slotAssignments.length <= required) continue

        const excessCount = slotAssignments.length - required
        const ranked = slotAssignments
          .map((assignment) => {
            const employee = employeeById.get(assignment.employeeId)
            let removalScore = 500 // domyślnie zlecenie: bezpieczne do usunięcia
            if (employee?.contractType === 'uop' && targetHoursByEmployee[employee.id] !== undefined) {
              const delta = computeQuarterHoursDelta(employee.id, result, monthConfig.days, targetHoursByEmployee)
              removalScore = delta > 0 ? 1000 + delta : delta - 1000
            }
            return { assignment, removalScore }
          })
          .sort((a, b) => b.removalScore - a.removalScore)

        const toRemove = new Set(ranked.slice(0, excessCount).map((r) => r.assignment))
        result = result.filter((a) => !toRemove.has(a))
      }
    }
  }

  return result
}

function pickBestCoverageCandidate(
  employees: EmployeeForValidation[],
  shift: ShiftForValidation,
  role: 'manager' | 'cashier',
  date: string,
  working: AssignmentForValidation[],
  requests: RequestForValidation[],
  monthConfig: MonthConfigForValidation,
  targetHoursByEmployee: Record<string, number>
): EmployeeForValidation | null {
  const eligible = employees.filter((e) => isEligibleForSlot(e, shift, role, date, working, requests))
  if (eligible.length === 0) return null

  const scored = eligible.map((employee) => {
    if (employee.contractType === 'uop' && targetHoursByEmployee[employee.id] !== undefined) {
      const delta = computeQuarterHoursDelta(employee.id, working, monthConfig.days, targetHoursByEmployee)
      return { employee, priority: 0, delta }
    }
    return { employee, priority: 1, delta: 0 }
  })

  scored.sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : a.delta - b.delta))
  return scored[0].employee
}

/** Uzupełnia niedobory obsady, preferując pracowników UoP najbardziej poniżej celu. */
function fillCoverageGaps(
  assignments: AssignmentForValidation[],
  monthConfig: MonthConfigForValidation,
  employees: EmployeeForValidation[],
  requests: RequestForValidation[],
  targetHoursByEmployee: Record<string, number>
): AssignmentForValidation[] {
  const result = [...assignments]

  for (const day of monthConfig.days) {
    if (day.isClosed) continue
    for (const shift of day.shifts) {
      if (!shift.enabled) continue
      for (const role of ['manager', 'cashier'] as const) {
        const required = role === 'manager' ? shift.requiredManagerCount : shift.requiredCashierCount
        let assignedCount = result.filter((a) => a.date === day.date && a.shiftId === shift.id && a.role === role).length

        while (assignedCount < required) {
          const candidate = pickBestCoverageCandidate(
            employees,
            shift,
            role,
            day.date,
            result,
            requests,
            monthConfig,
            targetHoursByEmployee
          )
          if (!candidate) break
          result.push({ employeeId: candidate.id, date: day.date, shiftId: shift.id, role })
          assignedCount += 1
        }
      }
    }
  }

  return result
}

function pickReceiver(
  employees: EmployeeForValidation[],
  shift: ShiftForValidation,
  role: 'manager' | 'cashier',
  date: string,
  working: AssignmentForValidation[],
  requests: RequestForValidation[],
  monthConfig: MonthConfigForValidation,
  targetHoursByEmployee: Record<string, number>,
  duration: number,
  excludeEmployeeId: string
): EmployeeForValidation | null {
  const eligible = employees.filter((e) => e.id !== excludeEmployeeId && isEligibleForSlot(e, shift, role, date, working, requests))

  // Transfer nie zmienia obsady (przesunięcie 1:1), więc nigdy nie ma uzasadnienia, by
  // wybrać odbiorcę, dla którego ten transfer oznaczałby przekroczenie celu — nawet jeśli
  // numerycznie wypadałby "bliżej zera" niż bezpieczna (niedoborowa) alternatywa.
  const uopReceivers = eligible
    .filter((e) => e.contractType === 'uop' && targetHoursByEmployee[e.id] !== undefined)
    .map((e) => ({ employee: e, delta: computeQuarterHoursDelta(e.id, working, monthConfig.days, targetHoursByEmployee) }))
    .filter((r) => r.delta < 0 && duration + r.delta <= 0)
    .sort((a, b) => Math.abs(duration + a.delta) - Math.abs(duration + b.delta))

  if (uopReceivers.length > 0) return uopReceivers[0].employee

  const zlecenieReceiver = eligible.find((e) => e.contractType === 'zlecenie')
  return zlecenieReceiver ?? null
}

/** Znajduje jedną zmianę pracownika `employeeId` (ponad celem) i przenosi ją na pracownika, który jej potrzebuje. */
function giveAwayOneShift(
  employeeId: string,
  result: AssignmentForValidation[],
  monthConfig: MonthConfigForValidation,
  employees: EmployeeForValidation[],
  requests: RequestForValidation[],
  targetHoursByEmployee: Record<string, number>
): boolean {
  const giverDelta = computeQuarterHoursDelta(employeeId, result, monthConfig.days, targetHoursByEmployee)

  const candidates = result
    .filter((a) => a.employeeId === employeeId)
    .map((assignment) => {
      const day = findDay(monthConfig, assignment.date)
      const shift = findShift(day, assignment.shiftId)
      return shift ? { assignment, shift, duration: shift.durationQuarterHours } : null
    })
    .filter((c): c is { assignment: AssignmentForValidation; shift: ShiftForValidation; duration: number } => c !== null)
    .sort((x, y) => {
      const xFits = x.duration <= giverDelta
      const yFits = y.duration <= giverDelta
      if (xFits !== yFits) return xFits ? -1 : 1
      return xFits ? y.duration - x.duration : x.duration - y.duration
    })

  for (const { assignment, shift, duration } of candidates) {
    const receiver = pickReceiver(
      employees,
      shift,
      assignment.role,
      assignment.date,
      result,
      requests,
      monthConfig,
      targetHoursByEmployee,
      duration,
      employeeId
    )
    if (receiver) {
      assignment.employeeId = receiver.id
      return true
    }
  }

  return false
}

/** Znajduje zmianę trzymaną przez kogoś, kto może się nią bezpiecznie podzielić, i przenosi ją na `employeeId`. */
function receiveOneShift(
  employeeId: string,
  result: AssignmentForValidation[],
  monthConfig: MonthConfigForValidation,
  employees: EmployeeForValidation[],
  employeeById: Map<string, EmployeeForValidation>,
  requests: RequestForValidation[],
  targetHoursByEmployee: Record<string, number>
): boolean {
  const me = employeeById.get(employeeId)
  if (!me) return false
  const myDelta = computeQuarterHoursDelta(employeeId, result, monthConfig.days, targetHoursByEmployee)

  const candidates = result
    .filter((a) => a.employeeId !== employeeId)
    .map((assignment) => {
      const day = findDay(monthConfig, assignment.date)
      const shift = findShift(day, assignment.shiftId)
      const holder = employeeById.get(assignment.employeeId)
      return shift && holder ? { assignment, shift, holder, duration: shift.durationQuarterHours } : null
    })
    .filter((c): c is { assignment: AssignmentForValidation; shift: ShiftForValidation; holder: EmployeeForValidation; duration: number } => c !== null)
    .filter(({ shift, assignment }) => isEligibleForSlot(me, shift, assignment.role, assignment.date, result, requests))
    .filter(({ holder }) => {
      if (holder.contractType === 'zlecenie') return true
      if (targetHoursByEmployee[holder.id] === undefined) return false
      return computeQuarterHoursDelta(holder.id, result, monthConfig.days, targetHoursByEmployee) > 0
    })
    .sort((x, y) => Math.abs(myDelta + x.duration) - Math.abs(myDelta + y.duration))

  const best = candidates[0]
  if (!best) return false

  best.assignment.employeeId = employeeId
  return true
}

/** Przenosi zmiany między pracownikami (nie zmieniając obsady slotów), aż każdy UoP trafi dokładnie w cel — o ile to możliwe. */
function rebalanceHours(
  assignments: AssignmentForValidation[],
  monthConfig: MonthConfigForValidation,
  employees: EmployeeForValidation[],
  requests: RequestForValidation[],
  targetHoursByEmployee: Record<string, number>
): AssignmentForValidation[] {
  const result = assignments.map((a) => ({ ...a }))
  const employeeById = new Map(employees.map((e) => [e.id, e]))
  const uopTargetIds = employees
    .filter((e) => e.contractType === 'uop' && targetHoursByEmployee[e.id] !== undefined)
    .map((e) => e.id)

  if (uopTargetIds.length === 0) return result

  const stuck = new Set<string>()
  const maxIterations = uopTargetIds.length * monthConfig.days.length * 10 + 100

  for (let i = 0; i < maxIterations; i += 1) {
    let worstId: string | null = null
    let worstAbs = 0

    for (const id of uopTargetIds) {
      if (stuck.has(id)) continue
      const delta = Math.abs(computeQuarterHoursDelta(id, result, monthConfig.days, targetHoursByEmployee))
      if (delta > worstAbs) {
        worstAbs = delta
        worstId = id
      }
    }

    if (!worstId || worstAbs === 0) break

    const delta = computeQuarterHoursDelta(worstId, result, monthConfig.days, targetHoursByEmployee)
    const moved =
      delta > 0
        ? giveAwayOneShift(worstId, result, monthConfig, employees, requests, targetHoursByEmployee)
        : receiveOneShift(worstId, result, monthConfig, employees, employeeById, requests, targetHoursByEmployee)

    if (!moved) stuck.add(worstId)
  }

  return result
}

/**
 * Deterministyczny krok naprawczy uruchamiany po odpowiedzi AI: czyści niepoprawne przypisania,
 * domyka braki/nadmiary obsady i przenosi zmiany między pracownikami tak, by każdy UoP trafił
 * dokładnie w swój cel godzinowy — o ile pozwala na to dostępność i uprawnienia pracowników.
 */
export function balanceAssignments(
  assignments: AssignmentForValidation[],
  monthConfig: MonthConfigForValidation,
  employees: EmployeeForValidation[],
  requests: RequestForValidation[],
  targetHoursByEmployee: Record<string, number>
): AssignmentForValidation[] {
  const employeeById = new Map(employees.map((e) => [e.id, e]))

  let result = dropInvalidAssignments(assignments, monthConfig, employeeById, requests)
  result = trimExcessCoverage(result, monthConfig, employeeById, targetHoursByEmployee)
  result = fillCoverageGaps(result, monthConfig, employees, requests, targetHoursByEmployee)
  result = rebalanceHours(result, monthConfig, employees, requests, targetHoursByEmployee)

  return result
}
