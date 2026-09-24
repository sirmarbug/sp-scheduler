import { Router } from 'express'
import { authController } from '../controllers/auth.controller.js'
import { authLimiter } from '../middlewares/rateLimiter.js'
import { validate } from '../middlewares/validate.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { loginSchema, registerSchema } from '../schemas/auth.schema.js'

export const authRouter = Router()

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(authController.register))
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(authController.login))
authRouter.post('/refresh', asyncHandler(authController.refresh))
authRouter.post('/logout', asyncHandler(authController.logout))
