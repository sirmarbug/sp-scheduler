import { Router } from 'express'
import { authRouter } from './auth.routes.js'
import { employeeRouter } from './employee.routes.js'
import { monthConfigRouter } from './month-config.routes.js'
import { requestRouter } from './request.routes.js'
import { scheduleRouter } from './schedule.routes.js'

export const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.use('/auth', authRouter)
router.use('/employees', employeeRouter)
router.use('/month-config', monthConfigRouter)
router.use('/requests', requestRouter)
router.use('/schedule', scheduleRouter)
