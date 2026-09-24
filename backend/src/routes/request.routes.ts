import { Router } from 'express'
import { requestController } from '../controllers/request.controller.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { validate } from '../middlewares/validate.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { createRequestSchema, listRequestsQuerySchema, requestIdParamsSchema } from '../schemas/request.schema.js'

export const requestRouter = Router()

requestRouter.use(authMiddleware)

requestRouter.get('/', validate({ query: listRequestsQuerySchema }), asyncHandler(requestController.list))
requestRouter.post('/', validate({ body: createRequestSchema }), asyncHandler(requestController.create))
requestRouter.delete('/:id', validate({ params: requestIdParamsSchema }), asyncHandler(requestController.remove))
