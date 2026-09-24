import type { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { AppError } from '../types/index.js'

const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL = '7d'

interface TokenPayload {
  sub: string
  email: string
}

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async register(email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new AppError('auth.emailTaken', 409, 'Ten adres e-mail jest już zajęty')
    }

    const passwordHash = await argon2.hash(password)
    const user = await this.prisma.user.create({ data: { email, passwordHash } })
    return this.issueTokens(user.id, user.email)
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) {
      throw new AppError('auth.invalidCredentials', 401, 'Nieprawidłowy e-mail lub hasło')
    }

    const isValid = await argon2.verify(user.passwordHash, password)
    if (!isValid) {
      throw new AppError('auth.invalidCredentials', 401, 'Nieprawidłowy e-mail lub hasło')
    }

    return this.issueTokens(user.id, user.email)
  }

  async refresh(refreshToken: string) {
    let payload: TokenPayload
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as TokenPayload
    } catch {
      throw new AppError('auth.invalidRefreshToken', 401, 'Nieprawidłowy lub wygasły refresh token')
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) {
      throw new AppError('auth.invalidRefreshToken', 401, 'Nieprawidłowy lub wygasły refresh token')
    }

    return this.issueTokens(user.id, user.email)
  }

  private issueTokens(userId: string, email: string) {
    const payload: TokenPayload = { sub: userId, email }
    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL })
    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL })
    return { accessToken, refreshToken, user: { id: userId, email } }
  }
}
