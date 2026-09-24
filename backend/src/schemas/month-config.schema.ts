import { z } from 'zod'
import { registry } from '../docs/registry.js'

const timeRegex = /^\d{2}:\d{2}$/
const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const monthValueRegex = /^\d{4}-\d{2}$/

export const shiftTypeSchema = z.enum(['auto', 'manual'])
export const balanceBucketSchema = z.enum(['first', 'mid', 'second'])

export const shiftSchema = z.object({
  id: z.string(),
  label: z.string(),
  start: z.string().regex(timeRegex),
  end: z.string().regex(timeRegex),
  shortLabel: z.string(),
  durationQuarterHours: z.number().int().nonnegative(),
  balanceBucket: balanceBucketSchema,
  type: shiftTypeSchema,
  enabled: z.boolean(),
  requiredManagerCount: z.number().int().nonnegative(),
  requiredCashierCount: z.number().int().nonnegative(),
})
export type ShiftDto = z.infer<typeof shiftSchema>

export const daySchema = z.object({
  date: z.string().regex(dateRegex),
  isClosed: z.boolean(),
  shifts: z.array(shiftSchema),
})
export type DayDto = z.infer<typeof daySchema>

export const monthConfigResponseSchema = registry.register(
  'MonthConfigResponse',
  z.object({
    year: z.number().int(),
    monthIndex: z.number().int().min(0).max(11),
    monthValue: z.string().regex(monthValueRegex),
    days: z.array(daySchema),
  })
)
export type MonthConfigResponse = z.infer<typeof monthConfigResponseSchema>

export const createMonthConfigSchema = registry.register(
  'CreateMonthConfigRequest',
  z.object({
    year: z.number().int(),
    monthIndex: z.number().int().min(0).max(11),
  })
)
export type CreateMonthConfigRequest = z.infer<typeof createMonthConfigSchema>

export const monthValueParamsSchema = z.object({ monthValue: z.string().regex(monthValueRegex) })

export const updateDaySchema = registry.register(
  'UpdateDayRequest',
  z.object({ isClosed: z.boolean() })
)
export type UpdateDayRequest = z.infer<typeof updateDaySchema>

export const dayParamsSchema = z.object({
  monthValue: z.string().regex(monthValueRegex),
  date: z.string().regex(dateRegex),
})

export const shiftParamsSchema = dayParamsSchema.extend({ shiftId: z.string().min(1) })

export const upsertShiftSchema = registry.register(
  'UpsertShiftRequest',
  z.object({
    label: z.string().min(1),
    start: z.string().regex(timeRegex),
    end: z.string().regex(timeRegex),
    shortLabel: z.string().min(1),
    balanceBucket: balanceBucketSchema,
    type: shiftTypeSchema,
    enabled: z.boolean().default(true),
    requiredManagerCount: z.number().int().nonnegative(),
    requiredCashierCount: z.number().int().nonnegative(),
  })
)
export type UpsertShiftRequest = z.infer<typeof upsertShiftSchema>

export const updateShiftSchema = registry.register('UpdateShiftRequest', upsertShiftSchema.partial())
export type UpdateShiftRequest = z.infer<typeof updateShiftSchema>
