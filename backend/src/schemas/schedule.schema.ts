import { z } from 'zod'
import { registry } from '../docs/registry.js'

export const monthValueParamsSchema = z.object({ monthValue: z.string().regex(/^\d{4}-\d{2}$/) })

export const cellOptionsQuerySchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
export type CellOptionsQuery = z.infer<typeof cellOptionsQuerySchema>

export const cellOptionSchema = registry.register(
  'CellOption',
  z.object({ shiftId: z.string(), role: z.enum(['manager', 'cashier']) })
)
export type CellOptionResponse = z.infer<typeof cellOptionSchema>

export const updateCellSchema = registry.register(
  'UpdateCellRequest',
  z.object({
    employeeId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    option: z.object({ shiftId: z.string(), role: z.enum(['manager', 'cashier']) }).nullable(),
  })
)
export type UpdateCellRequest = z.infer<typeof updateCellSchema>

export const validationResultSchema = registry.register(
  'ValidationResult',
  z.object({
    issues: z.array(z.string()),
    coverageIssues: z.array(z.string()),
    summaryList: z.array(
      z.object({
        employeeId: z.string(),
        name: z.string(),
        totalHours: z.number(),
        targetHours: z.number().nullable(),
        firstCount: z.number(),
        secondCount: z.number(),
        firstSecondDiff: z.number(),
        preferenceHits: z.number(),
      })
    ),
    status: z.string(),
  })
)
export type ValidationResultResponse = z.infer<typeof validationResultSchema>
