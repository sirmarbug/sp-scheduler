import type { PrismaClient } from '@prisma/client'
import { AppError } from '../types/index.js'
import { canFillRole } from '../utils/roleEligibility.js'
import { isAvoided } from '../utils/requestMatching.js'
import type {
  AssignmentForValidation,
  EmployeeForValidation,
  MonthConfigForValidation,
  RequestForValidation,
} from '../types/schedule.js'

export interface CellOption {
  shiftId: string
  role: 'manager' | 'cashier'
}

export function getAvailableOptions(
  employeeId: string,
  date: string,
  monthConfig: MonthConfigForValidation,
  employees: EmployeeForValidation[],
  requests: RequestForValidation[],
  currentAssignments: AssignmentForValidation[]
): CellOption[] {
  const employee = employees.find((e) => e.id === employeeId)
  const day = monthConfig.days.find((d) => d.date === date)
  if (!employee || !day || day.isClosed) return []

  const options: CellOption[] = []

  for (const shift of day.shifts) {
    if (!shift.enabled) continue
    if (isAvoided(requests, employeeId, date, shift.id)) continue

    for (const role of ['manager', 'cashier'] as const) {
      if (!canFillRole(employee, shift, role)) continue

      const required = role === 'manager' ? shift.requiredManagerCount : shift.requiredCashierCount
      const assignedCount = currentAssignments.filter(
        (a) => a.date === date && a.shiftId === shift.id && a.role === role && a.employeeId !== employeeId
      ).length

      if (assignedCount < required) {
        options.push({ shiftId: shift.id, role })
      }
    }
  }

  return options
}

export class ScheduleCellService {
  constructor(private readonly prisma: PrismaClient) {}

  async updateCell(
    monthValue: string,
    employeeId: string,
    date: string,
    payload: CellOption | null,
    context: {
      monthConfig: MonthConfigForValidation
      employees: EmployeeForValidation[]
      requests: RequestForValidation[]
    }
  ) {
    const schedule = await this.prisma.schedule.upsert({
      where: { monthValue },
      create: { monthValue, assignments: [], status: 'draft' },
      update: {},
    })

    const currentAssignments: AssignmentForValidation[] = schedule.assignments.map((a) => ({
      employeeId: a.employeeId,
      date: a.date,
      shiftId: a.shiftId,
      role: a.role as 'manager' | 'cashier',
    }))

    const withoutThisCell = currentAssignments.filter((a) => !(a.employeeId === employeeId && a.date === date))

    if (payload) {
      const available = getAvailableOptions(
        employeeId,
        date,
        context.monthConfig,
        context.employees,
        context.requests,
        withoutThisCell
      )
      const isAllowed = available.some((o) => o.shiftId === payload.shiftId && o.role === payload.role)
      if (!isAllowed) {
        throw new AppError('schedule.invalidCellOption', 400, 'Wybrana opcja nie jest dopuszczalna dla tego pracownika/dnia')
      }
      withoutThisCell.push({ employeeId, date, shiftId: payload.shiftId, role: payload.role })
    }

    return this.prisma.schedule.update({
      where: { monthValue },
      data: { assignments: withoutThisCell },
    })
  }
}
