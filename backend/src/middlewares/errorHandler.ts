import type { NextFunction, Request, Response } from 'express'
import { logger } from '../config/logger.js'
import { AppError } from '../types/index.js'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    logger.warn({ err }, 'Handled application error')
    res.status(err.status).json({ status: err.status, error: { code: err.code, message: err.message } })
    return
  }

  logger.error({ err }, 'Unhandled error')
  const isProduction = process.env.NODE_ENV === 'production'
  res.status(500).json({
    status: 500,
    error: {
      code: 'internal.error',
      message: isProduction ? 'Internal server error' : (err as Error)?.message,
    },
  })
}
