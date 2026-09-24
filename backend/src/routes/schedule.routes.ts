import { Router } from 'express'
import { scheduleController } from '../controllers/schedule.controller.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { validate } from '../middlewares/validate.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { cellOptionsQuerySchema, monthValueParamsSchema, updateCellSchema } from '../schemas/schedule.schema.js'

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
