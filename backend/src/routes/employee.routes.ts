import { Router } from 'express'
import { employeeController } from '../controllers/employee.controller.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { validate } from '../middlewares/validate.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { createEmployeeSchema, employeeIdParamsSchema, updateEmployeeSchema } from '../schemas/employee.schema.js'

export const employeeRouter = Router()

employeeRouter.use(authMiddleware)

employeeRouter.get('/', asyncHandler(employeeController.list))
employeeRouter.get('/:id', validate({ params: employeeIdParamsSchema }), asyncHandler(employeeController.getById))
employeeRouter.post('/', validate({ body: createEmployeeSchema }), asyncHandler(employeeController.create))
employeeRouter.put(
  '/:id',
  validate({ params: employeeIdParamsSchema, body: updateEmployeeSchema }),
  asyncHandler(employeeController.update)
)
employeeRouter.delete('/:id', validate({ params: employeeIdParamsSchema }), asyncHandler(employeeController.remove))
