import type { Request, Response } from 'express'
import { prisma } from '../config/db.js'
import { env } from '../config/env.js'
import { AuthService } from '../services/auth.service.js'
import type { LoginRequest, RegisterRequest } from '../schemas/auth.schema.js'

const authService = new AuthService(prisma)

const REFRESH_COOKIE_NAME = 'refreshToken'
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

export const authController = {
  async register(req: Request<unknown, unknown, RegisterRequest>, res: Response) {
    const { email, password } = req.body
    const { accessToken, refreshToken, user } = await authService.register(email, password)
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS)
    res.status(201).json({ accessToken, user })
  },

  async login(req: Request<unknown, unknown, LoginRequest>, res: Response) {
    const { email, password } = req.body
    const { accessToken, refreshToken, user } = await authService.login(email, password)
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS)
    res.json({ accessToken, user })
  },

  async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME]
    if (!refreshToken) {
      res.status(401).json({ status: 401, error: { code: 'auth.missingRefreshToken', message: 'Brak refresh tokenu' } })
      return
    }
    const result = await authService.refresh(refreshToken)
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS)
    res.json({ accessToken: result.accessToken, user: result.user })
  },

  async logout(_req: Request, res: Response) {
    res.clearCookie(REFRESH_COOKIE_NAME)
    res.status(204).send()
  },
}
