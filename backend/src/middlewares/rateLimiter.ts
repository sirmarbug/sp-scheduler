import rateLimit from 'express-rate-limit'

export const globalRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 })
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 })
