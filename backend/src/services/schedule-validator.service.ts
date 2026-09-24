import dayjs from '../config/dayjs.js'
import { canFillRole } from '../utils/roleEligibility.js'
import { isAvoided, isPreferred } from '../utils/requestMatching.js'
import { computeTargetQuarterHours } from '../utils/time.js'
import type {
  AssignmentForValidation,
  DayForValidation,
  EmployeeForValidation,
  EmployeeSummary,
  MonthConfigForValidation,
  RequestForValidation,
  ShiftForValidation,
  ValidationResult,
} from '../types/schedule.js'

const MAX_WORK_DAYS_PER_ISO_WEEK = 6

function findDay(monthConfig: MonthConfigForValidation, date: string): DayForValidation | undefined {
  return monthConfig.days.find((d) => d.date === date)
}

function findShift(day: DayForValidation | undefined, shiftId: string): ShiftForValidation | undefined {
  return day?.shifts.find((s) => s.id === shiftId)
}

export function validate(
  assignments: AssignmentForValidation[],
  monthConfig: MonthConfigForValidation,
  employees: EmployeeForValidation[],
  requests: RequestForValidation[]
): ValidationResult {
  const issues: string[] = []
  const coverageIssues: string[] = []
  const employeeById = new Map(employees.map((e) => [e.id, e]))

  // 1. podwójne przypisanie tego samego pracownika w jednym dniu
  const assignmentsByEmployeeDate = new Map<string, AssignmentForValidation[]>()
  for (const assignment of assignments) {
    const key = `${assignment.employeeId}|${assignment.date}`
    const list = assignmentsByEmployeeDate.get(key) ?? []
    list.push(assignment)
    assignmentsByEmployeeDate.set(key, list)
  }
  for (const [key, list] of assignmentsByEmployeeDate) {
    if (list.length > 1) {
      const [employeeId, date] = key.split('|')
      issues.push(`Pracownik ${employeeId} ma więcej niż jedno przypisanie dnia ${date}`)
    }
  }

  // 2-4, 7: dzień zamknięty / avoid / uprawnienia do roli / nadmiarowa obsada
  const coverageCount = new Map<string, number>() // key: date|shiftId|role -> count

  for (const assignment of assignments) {
    const employee = employeeById.get(assignment.employeeId)
    const day = findDay(monthConfig, assignment.date)
    const shift = findShift(day, assignment.shiftId)

    if (!employee) {
      issues.push(`Przypisanie odwołuje się do nieistniejącego pracownika ${assignment.employeeId}`)
      continue
    }

    if (!day || day.isClosed) {
      issues.push(`Przypisanie pracownika ${employee.name} w dniu zamkniętym ${assignment.date}`)
      continue
    }

    if (!shift) {
      issues.push(`Przypisanie pracownika ${employee.name} do nieistniejącej zmiany ${assignment.shiftId}`)
      continue
    }

    if (isAvoided(requests, assignment.employeeId, assignment.date, assignment.shiftId)) {
      issues.push(`Pracownik ${employee.name} przydzielony mimo blokady (avoid) dnia ${assignment.date}`)
    }

    if (!canFillRole(employee, shift, assignment.role)) {
      issues.push(
        `Pracownik ${employee.name} nie ma uprawnień do roli ${assignment.role} na zmianie ${shift.id} dnia ${assignment.date}`
      )
    }

    const coverageKey = `${assignment.date}|${assignment.shiftId}|${assignment.role}`
    coverageCount.set(coverageKey, (coverageCount.get(coverageKey) ?? 0) + 1)
  }

  // 7. nadmiar/niedobór obsady dla wszystkich zmian (auto i manual), tylko enabled
  for (const day of monthConfig.days) {
    if (day.isClosed) continue
    for (const shift of day.shifts) {
      if (!shift.enabled) continue
      for (const role of ['manager', 'cashier'] as const) {
        const required = role === 'manager' ? shift.requiredManagerCount : shift.requiredCashierCount
        const assigned = coverageCount.get(`${day.date}|${shift.id}|${role}`) ?? 0
        if (assigned > required) {
          issues.push(
            `Nadmiarowa obsada roli ${role} na zmianie ${shift.id} dnia ${day.date}: przydzielono ${assigned}, wymagane ${required}`
          )
        } else if (assigned < required) {
          coverageIssues.push(
            `Niedobór obsady roli ${role} na zmianie ${shift.id} (${shift.type}) dnia ${day.date}: przydzielono ${assigned}, wymagane ${required}`
          )
        }
      }
    }
  }

  // 5. max 6 dni pracy w tygodniu ISO
  const workDaysByEmployeeWeek = new Map<string, Set<string>>()
  for (const assignment of assignments) {
    const isoWeekKey = `${dayjs(assignment.date).isoWeekYear()}-W${dayjs(assignment.date).isoWeek()}`
    const key = `${assignment.employeeId}|${isoWeekKey}`
    const days = workDaysByEmployeeWeek.get(key) ?? new Set<string>()
    days.add(assignment.date)
    workDaysByEmployeeWeek.set(key, days)
  }
  for (const [key, days] of workDaysByEmployeeWeek) {
    if (days.size > MAX_WORK_DAYS_PER_ISO_WEEK) {
      const [employeeId, isoWeekKey] = key.split('|')
      const employee = employeeById.get(employeeId)
      issues.push(
        `Pracownik ${employee?.name ?? employeeId} pracuje ${days.size} dni w tygodniu ${isoWeekKey} (maksimum ${MAX_WORK_DAYS_PER_ISO_WEEK})`
      )
    }
  }

  // 6. godziny UoP vs target
  const targetQuarterHours = computeTargetQuarterHours(monthConfig.days)

  // Podsumowanie per pracownik
  const summaryList: EmployeeSummary[] = employees.map((employee) => {
    const employeeAssignments = assignments.filter((a) => a.employeeId === employee.id)
    let totalQuarterHours = 0
    let firstCount = 0
    let secondCount = 0
    let preferenceHits = 0

    for (const assignment of employeeAssignments) {
      const day = findDay(monthConfig, assignment.date)
      const shift = findShift(day, assignment.shiftId)
      if (!shift) continue
      totalQuarterHours += shift.durationQuarterHours
      if (shift.balanceBucket === 'first') firstCount += 1
      if (shift.balanceBucket === 'second') secondCount += 1
      if (isPreferred(requests, assignment.employeeId, assignment.date, assignment.shiftId)) {
        preferenceHits += 1
      }
    }

    const targetHours = employee.contractType === 'uop' ? targetQuarterHours / 4 : null

    if (employee.contractType === 'uop' && totalQuarterHours !== targetQuarterHours) {
      issues.push(
        `Godziny pracownika ${employee.name} (UoP) wynoszą ${totalQuarterHours / 4}h, cel to ${targetQuarterHours / 4}h`
      )
    }

    return {
      employeeId: employee.id,
      name: employee.name,
      totalHours: totalQuarterHours / 4,
      targetHours,
      firstCount,
      secondCount,
      firstSecondDiff: firstCount - secondCount,
      preferenceHits,
    }
  })

  const status = issues.length === 0 && coverageIssues.length === 0 ? 'Grafik jest spójny' : 'Grafik wymaga korekty'

  return { issues, coverageIssues, summaryList, status }
}
