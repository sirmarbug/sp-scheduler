import type { Request, Response } from 'express'

export function catchNotFound(_req: Request, res: Response) {
  res.status(404).json({ status: 404, error: { code: 'route.notFound', message: 'Route not found' } })
}
