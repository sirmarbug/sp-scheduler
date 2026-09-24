import { Router } from 'express'
import { monthConfigController } from '../controllers/month-config.controller.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { validate } from '../middlewares/validate.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  createMonthConfigSchema,
  dayParamsSchema,
  monthValueParamsSchema,
  shiftParamsSchema,
  updateDaySchema,
  updateShiftSchema,
  upsertShiftSchema,
} from '../schemas/month-config.schema.js'

export const monthConfigRouter = Router()

monthConfigRouter.use(authMiddleware)

monthConfigRouter.post('/', validate({ body: createMonthConfigSchema }), asyncHandler(monthConfigController.create))
monthConfigRouter.get(
  '/:monthValue',
  validate({ params: monthValueParamsSchema }),
  asyncHandler(monthConfigController.getByMonthValue)
)
monthConfigRouter.patch(
  '/:monthValue/days/:date',
  validate({ params: dayParamsSchema, body: updateDaySchema }),
  asyncHandler(monthConfigController.updateDay)
)
monthConfigRouter.post(
  '/:monthValue/days/:date/shifts',
  validate({ params: dayParamsSchema, body: upsertShiftSchema }),
  asyncHandler(monthConfigController.createShift)
)
monthConfigRouter.patch(
  '/:monthValue/days/:date/shifts/:shiftId',
  validate({ params: shiftParamsSchema, body: updateShiftSchema }),
  asyncHandler(monthConfigController.updateShift)
)
monthConfigRouter.delete(
  '/:monthValue/days/:date/shifts/:shiftId',
  validate({ params: shiftParamsSchema }),
  asyncHandler(monthConfigController.removeShift)
)
