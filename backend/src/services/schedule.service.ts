import type { PrismaClient } from '@prisma/client'
import { AppError } from '../types/index.js'
import { AiSchedulerService } from './ai-scheduler.service.js'
import { validate } from './schedule-validator.service.js'
import { computeTargetQuarterHours } from '../utils/time.js'
import type {
  AssignmentForValidation,
  EmployeeForValidation,
  MonthConfigForValidation,
  RequestForValidation,
  ValidationResult,
} from '../types/schedule.js'

interface ScheduleServiceConfig {
  openRouterApiKey: string
  openRouterModel: string
  openRouterMaxRetries: number
  openRouterTemperature: number
}

export class ScheduleService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: ScheduleServiceConfig
  ) {}

  async validateMonth(monthValue: string): Promise<ValidationResult> {
    const { monthConfig, employees, requests, assignments } = await this.loadMonthData(monthValue)
    return validate(assignments, monthConfig, employees, requests)
  }

  async generate(monthValue: string) {
    const { monthConfig, employees, requests } = await this.loadMonthData(monthValue)

    const targetQuarterHours = computeTargetQuarterHours(monthConfig.days)
    const targetHoursByEmployee: Record<string, number> = {}
    for (const employee of employees) {
      if (employee.contractType === 'uop') {
        targetHoursByEmployee[employee.id] = targetQuarterHours / 4
      }
    }

    const aiService = new AiSchedulerService({
      apiKey: this.config.openRouterApiKey,
      model: this.config.openRouterModel,
      maxRetries: this.config.openRouterMaxRetries,
      temperature: this.config.openRouterTemperature,
    })

    const result = await aiService.generateWithRetry({ monthConfig, employees, requests, targetHoursByEmployee })

    const diagnostics = this.buildDiagnostics(monthConfig, result.assignments, targetQuarterHours)

    const schedule = await this.prisma.schedule.upsert({
      where: { monthValue },
      create: {
        monthValue,
        assignments: result.assignments,
        diagnostics,
        status: result.status,
        generationAttempts: result.attempts,
      },
      update: {
        assignments: result.assignments,
        diagnostics,
        status: result.status,
        generationAttempts: result.attempts,
      },
    })

    return schedule
  }

  async clear(monthValue: string) {
    const schedule = await this.prisma.schedule.findUnique({ where: { monthValue } })
    if (!schedule) {
      throw new AppError('schedule.notFound', 404, 'Grafik dla tego miesiąca nie istnieje')
    }
    if (schedule.status === 'approved') {
      throw new AppError('schedule.alreadyApproved', 422, 'Nie można wyczyścić zatwierdzonego grafiku')
    }

    return this.prisma.schedule.update({
      where: { monthValue },
      data: { assignments: [], diagnostics: null, generationAttempts: [], status: 'draft' },
    })
  }

  private buildDiagnostics(
    monthConfig: MonthConfigForValidation,
    assignments: AssignmentForValidation[],
    targetQuarterHours: number
  ) {
    let totalSlots = 0
    for (const day of monthConfig.days) {
      if (day.isClosed) continue
      for (const shift of day.shifts) {
        if (!shift.enabled) continue
        totalSlots += shift.requiredManagerCount + shift.requiredCashierCount
      }
    }
    const filledCount = assignments.length
    const unfilledSlots = Math.max(totalSlots - filledCount, 0)
    const tier = unfilledSlots === 0 ? 'complete' : unfilledSlots <= totalSlots * 0.1 ? 'mostly-complete' : 'partial'

    return {
      targetQuarterHours,
      totalSlots,
      filledCount,
      unfilledSlots,
      tier,
      totalShortfall: unfilledSlots,
    }
  }

  async loadMonthData(monthValue: string) {
    const monthConfig = await this.prisma.monthConfig.findUnique({ where: { monthValue } })
    if (!monthConfig) {
      throw new AppError('monthConfig.notFound', 404, 'Konfiguracja miesiąca nie istnieje')
    }

    const [schedule, employees, requests] = await Promise.all([
      this.prisma.schedule.findUnique({ where: { monthValue } }),
      this.prisma.employee.findMany(),
      this.prisma.request.findMany(),
    ])

    const assignments: AssignmentForValidation[] = (schedule?.assignments ?? []).map((a) => ({
      employeeId: a.employeeId,
      date: a.date,
      shiftId: a.shiftId,
      role: a.role as 'manager' | 'cashier',
    }))

    return {
      monthConfig: monthConfig as unknown as MonthConfigForValidation,
      employees: employees as unknown as EmployeeForValidation[],
      requests: requests as unknown as RequestForValidation[],
      assignments,
    }
  }
}
