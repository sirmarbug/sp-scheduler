import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import dayjs from 'dayjs'
import { AppError } from '../types/index.js'
import { buildDefaultShifts, DEFAULT_CLOSED_WEEKDAY } from '../utils/constants.js'
import { computeDurationQuarterHours } from '../utils/time.js'
import type { DayDto, ShiftDto, UpdateShiftRequest, UpsertShiftRequest } from '../schemas/month-config.schema.js'

export class MonthConfigService {
  constructor(private readonly prisma: PrismaClient) {}

  async createDefault(year: number, monthIndex: number) {
    const monthValue = `${year}-${String(monthIndex + 1).padStart(2, '0')}`

    const existing = await this.prisma.monthConfig.findUnique({ where: { monthValue } })
    if (existing) {
      throw new AppError('monthConfig.alreadyExists', 409, 'Konfiguracja tego miesiąca już istnieje')
    }

    const daysInMonth = dayjs(`${monthValue}-01`).daysInMonth()
    const days: DayDto[] = Array.from({ length: daysInMonth }, (_, index) => {
      const date = dayjs(`${monthValue}-01`).date(index + 1)
      const isClosed = date.day() === DEFAULT_CLOSED_WEEKDAY
      return {
        date: date.format('YYYY-MM-DD'),
        isClosed,
        shifts: isClosed ? buildDefaultShifts().map((s) => ({ ...s, enabled: false })) : buildDefaultShifts(),
      }
    })

    return this.prisma.monthConfig.create({ data: { year, monthIndex, monthValue, days } })
  }

  async getByMonthValue(monthValue: string) {
    const monthConfig = await this.prisma.monthConfig.findUnique({ where: { monthValue } })
    if (!monthConfig) {
      throw new AppError('monthConfig.notFound', 404, 'Konfiguracja miesiąca nie istnieje')
    }
    return monthConfig
  }

  async updateDay(monthValue: string, date: string, isClosed: boolean) {
    const monthConfig = await this.getByMonthValue(monthValue)
    const days = monthConfig.days.map((day) => {
      if (day.date !== date) return day
      return {
        ...day,
        isClosed,
        shifts: isClosed ? day.shifts.map((s) => ({ ...s, enabled: false })) : buildDefaultShifts(),
      }
    })

    if (isClosed) {
      await this.clearAssignmentsForDate(monthValue, date)
    }

    return this.prisma.monthConfig.update({ where: { monthValue }, data: { days } })
  }

  async upsertShift(monthValue: string, date: string, payload: UpsertShiftRequest) {
    const monthConfig = await this.getByMonthValue(monthValue)
    const newShift: ShiftDto = {
      id: randomUUID(),
      ...payload,
      durationQuarterHours: computeDurationQuarterHours(payload.start, payload.end),
    }

    const days = monthConfig.days.map((day) => {
      if (day.date !== date) return day
      return { ...day, shifts: [...day.shifts, newShift] }
    })

    await this.prisma.monthConfig.update({ where: { monthValue }, data: { days } })
    return newShift
  }

  async updateShift(monthValue: string, date: string, shiftId: string, payload: UpdateShiftRequest) {
    const monthConfig = await this.getByMonthValue(monthValue)
    let updatedShift: ShiftDto | undefined
    let shiftDisabled = false

    const days = monthConfig.days.map((day) => {
      if (day.date !== date) return day
      const shifts = day.shifts.map((shift) => {
        if (shift.id !== shiftId) return shift
        const merged = { ...shift, ...payload } as ShiftDto
        if (payload.start || payload.end) {
          merged.durationQuarterHours = computeDurationQuarterHours(merged.start, merged.end)
        }
        if (payload.enabled === false && shift.enabled) {
          shiftDisabled = true
        }
        updatedShift = merged
        return merged
      })
      return { ...day, shifts }
    })

    if (!updatedShift) {
      throw new AppError('monthConfig.shiftNotFound', 404, 'Zmiana nie istnieje')
    }

    if (shiftDisabled) {
      await this.clearAssignmentsForShift(monthValue, date, shiftId)
    }

    await this.prisma.monthConfig.update({ where: { monthValue }, data: { days } })
    return updatedShift
  }

  async removeShift(monthValue: string, date: string, shiftId: string) {
    const monthConfig = await this.getByMonthValue(monthValue)
    const days = monthConfig.days.map((day) => {
      if (day.date !== date) return day
      return { ...day, shifts: day.shifts.filter((s) => s.id !== shiftId) }
    })

    await this.clearAssignmentsForShift(monthValue, date, shiftId)
    await this.prisma.monthConfig.update({ where: { monthValue }, data: { days } })
  }

  private async clearAssignmentsForDate(monthValue: string, date: string) {
    const schedule = await this.prisma.schedule.findUnique({ where: { monthValue } })
    if (!schedule) return
    await this.prisma.schedule.update({
      where: { monthValue },
      data: { assignments: { set: schedule.assignments.filter((a) => a.date !== date) } },
    })
  }

  private async clearAssignmentsForShift(monthValue: string, date: string, shiftId: string) {
    const schedule = await this.prisma.schedule.findUnique({ where: { monthValue } })
    if (!schedule) return
    await this.prisma.schedule.update({
      where: { monthValue },
      data: {
        assignments: {
          set: schedule.assignments.filter((a) => !(a.date === date && a.shiftId === shiftId)),
        },
      },
    })
  }
}
