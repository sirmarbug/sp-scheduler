import type { Request, Response } from 'express'
import { prisma } from '../config/db.js'
import { env } from '../config/env.js'
import { AppError } from '../types/index.js'
import { ScheduleService } from '../services/schedule.service.js'
import { getAvailableOptions, ScheduleCellService } from '../services/schedule-cell.service.js'
import type { CellOptionsQuery, UpdateCellRequest } from '../schemas/schedule.schema.js'

const scheduleService = new ScheduleService(prisma, {
  openRouterApiKey: env.OPENROUTER_API_KEY,
  openRouterModel: env.OPENROUTER_MODEL,
  openRouterMaxRetries: env.OPENROUTER_MAX_RETRIES,
  openRouterTemperature: env.OPENROUTER_TEMPERATURE,
})
const scheduleCellService = new ScheduleCellService(prisma)

export const scheduleController = {
  async validateMonth(req: Request<{ monthValue: string }>, res: Response) {
    const result = await scheduleService.validateMonth(req.params.monthValue)
    res.json(result)
  },

  async generate(req: Request<{ monthValue: string }>, res: Response) {
    const schedule = await scheduleService.generate(req.params.monthValue)
    res.json(schedule)
  },

  async getByMonthValue(req: Request<{ monthValue: string }>, res: Response) {
    const schedule = await prisma.schedule.findUnique({ where: { monthValue: req.params.monthValue } })
    if (!schedule) {
      throw new AppError('schedule.notFound', 404, 'Grafik dla tego miesiąca nie istnieje')
    }
    res.json(schedule)
  },

  async approve(req: Request<{ monthValue: string }>, res: Response) {
    const schedule = await prisma.schedule.update({
      where: { monthValue: req.params.monthValue },
      data: { status: 'approved' },
    })
    res.json(schedule)
  },

  async getCellOptions(req: Request<{ monthValue: string }, unknown, unknown, CellOptionsQuery>, res: Response) {
    const { monthConfig, employees, requests, assignments } = await scheduleService.loadMonthData(req.params.monthValue)
    const options = getAvailableOptions(req.query.employeeId, req.query.date, monthConfig, employees, requests, assignments)
    res.json(options)
  },

  async updateCell(req: Request<{ monthValue: string }, unknown, UpdateCellRequest>, res: Response) {
    const { monthConfig, employees, requests } = await scheduleService.loadMonthData(req.params.monthValue)
    const schedule = await scheduleCellService.updateCell(
      req.params.monthValue,
      req.body.employeeId,
      req.body.date,
      req.body.option,
      { monthConfig, employees, requests }
    )
    res.json(schedule)
  },
}
