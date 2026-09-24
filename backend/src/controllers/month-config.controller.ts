import type { Request, Response } from 'express'
import { prisma } from '../config/db.js'
import { MonthConfigService } from '../services/month-config.service.js'
import type {
  CreateMonthConfigRequest,
  UpdateDayRequest,
  UpdateShiftRequest,
  UpsertShiftRequest,
} from '../schemas/month-config.schema.js'

const monthConfigService = new MonthConfigService(prisma)

export const monthConfigController = {
  async create(req: Request<unknown, unknown, CreateMonthConfigRequest>, res: Response) {
    const monthConfig = await monthConfigService.createDefault(req.body.year, req.body.monthIndex)
    res.status(201).json(monthConfig)
  },

  async getByMonthValue(req: Request<{ monthValue: string }>, res: Response) {
    const monthConfig = await monthConfigService.getByMonthValue(req.params.monthValue)
    res.json(monthConfig)
  },

  async updateDay(req: Request<{ monthValue: string; date: string }, unknown, UpdateDayRequest>, res: Response) {
    const monthConfig = await monthConfigService.updateDay(req.params.monthValue, req.params.date, req.body.isClosed)
    res.json(monthConfig)
  },

  async createShift(
    req: Request<{ monthValue: string; date: string }, unknown, UpsertShiftRequest>,
    res: Response
  ) {
    const shift = await monthConfigService.upsertShift(req.params.monthValue, req.params.date, req.body)
    res.status(201).json(shift)
  },

  async updateShift(
    req: Request<{ monthValue: string; date: string; shiftId: string }, unknown, UpdateShiftRequest>,
    res: Response
  ) {
    const shift = await monthConfigService.updateShift(
      req.params.monthValue,
      req.params.date,
      req.params.shiftId,
      req.body
    )
    res.json(shift)
  },

  async removeShift(req: Request<{ monthValue: string; date: string; shiftId: string }>, res: Response) {
    await monthConfigService.removeShift(req.params.monthValue, req.params.date, req.params.shiftId)
    res.status(204).send()
  },
}
