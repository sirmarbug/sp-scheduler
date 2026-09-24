import type { NextFunction, Request, Response } from 'express'
import { passport } from '../config/passport.js'

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  passport.authenticate('jwt', { session: false }, (err: unknown, user: Express.User | false) => {
    if (err || !user) {
      res.status(401).json({ status: 401, error: { code: 'auth.unauthorized', message: 'Wymagane zalogowanie' } })
      return
    }
    req.user = user
    next()
  })(req, res, next)
}
