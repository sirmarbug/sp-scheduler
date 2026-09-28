import { Router } from 'express'
import { scheduleController } from '../controllers/schedule.controller.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { validate } from '../middlewares/validate.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  cellOptionsQuerySchema,
  monthValueParamsSchema,
  targetHoursParamsSchema,
  updateCellSchema,
  updateTargetHoursSchema,
} from '../schemas/schedule.schema.js'

export const scheduleRouter = Router()

scheduleRouter.use(authMiddleware)

scheduleRouter.get(
  '/:monthValue',
  validate({ params: monthValueParamsSchema }),
  asyncHandler(scheduleController.getByMonthValue)
)
scheduleRouter.post(
  '/:monthValue/generate',
  validate({ params: monthValueParamsSchema }),
  asyncHandler(scheduleController.generate)
)
scheduleRouter.post(
  '/:monthValue/generate-deterministic',
  validate({ params: monthValueParamsSchema }),
  asyncHandler(scheduleController.generateDeterministic)
)
scheduleRouter.get(
  '/:monthValue/validation',
  validate({ params: monthValueParamsSchema }),
  asyncHandler(scheduleController.validateMonth)
)
scheduleRouter.post(
  '/:monthValue/approve',
  validate({ params: monthValueParamsSchema }),
  asyncHandler(scheduleController.approve)
)
scheduleRouter.post(
  '/:monthValue/clear',
  validate({ params: monthValueParamsSchema }),
  asyncHandler(scheduleController.clear)
)
scheduleRouter.get(
  '/:monthValue/cell-options',
  validate({ params: monthValueParamsSchema, query: cellOptionsQuerySchema }),
  asyncHandler(scheduleController.getCellOptions)
)
scheduleRouter.patch(
  '/:monthValue/cell',
  validate({ params: monthValueParamsSchema, body: updateCellSchema }),
  asyncHandler(scheduleController.updateCell)
)
scheduleRouter.put(
  '/:monthValue/target-hours/:employeeId',
  validate({ params: targetHoursParamsSchema, body: updateTargetHoursSchema }),
  asyncHandler(scheduleController.updateTargetHours)
)
