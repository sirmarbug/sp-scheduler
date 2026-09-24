import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import swaggerUi from 'swagger-ui-express'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { passport } from './config/passport.js'
import { buildOpenApiDocument } from './docs/index.js'
import { catchNotFound } from './middlewares/catchNotFound.js'
import { errorHandler } from './middlewares/errorHandler.js'
import { globalRateLimiter } from './middlewares/rateLimiter.js'
import { router } from './routes/index.js'

export const app = express()

app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use(pinoHttp({ logger }))
app.use(globalRateLimiter)
app.use(passport.initialize())

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(buildOpenApiDocument()))

app.use(router)

app.use(catchNotFound)
app.use(errorHandler)
