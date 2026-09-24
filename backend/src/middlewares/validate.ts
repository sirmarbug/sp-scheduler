import type { NextFunction, Request, Response } from 'express'
import type { ZodTypeAny } from 'zod'

interface ValidateSchemas {
  body?: ZodTypeAny
  params?: ZodTypeAny
  query?: ZodTypeAny
}

export function validate(schemas: ValidateSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body)
      if (!result.success) {
        res.status(400).json({ status: 400, error: { code: 'validation.body', message: result.error.message } })
        return
      }
      req.body = result.data
    }
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params)
      if (!result.success) {
        res.status(400).json({ status: 400, error: { code: 'validation.params', message: result.error.message } })
        return
      }
      req.params = result.data
    }
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query)
      if (!result.success) {
        res.status(400).json({ status: 400, error: { code: 'validation.query', message: result.error.message } })
        return
      }
      Object.assign(req.query, result.data)
    }
    next()
  }
}
