import { z } from 'zod'
import { registry } from '../docs/registry.js'

export const registerSchema = registry.register(
  'RegisterRequest',
  z.object({
    email: z.string().email(),
    password: z.string().min(8),
  })
)
export type RegisterRequest = z.infer<typeof registerSchema>

export const loginSchema = registry.register(
  'LoginRequest',
  z.object({
    email: z.string().email(),
    password: z.string().min(1),
  })
)
export type LoginRequest = z.infer<typeof loginSchema>

export const authResponseSchema = registry.register(
  'AuthResponse',
  z.object({
    accessToken: z.string(),
    user: z.object({ id: z.string(), email: z.string().email() }),
  })
)
export type AuthResponse = z.infer<typeof authResponseSchema>
