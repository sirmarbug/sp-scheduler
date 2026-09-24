import { z } from 'zod'
import { registry } from '../docs/registry.js'

export const requestTypeSchema = z.enum(['avoid', 'prefer'])

export const createRequestSchema = registry.register(
  'CreateRequestRequest',
  z.object({
    employeeId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    shiftId: z.string().min(1),
    type: requestTypeSchema,
  })
)
export type CreateRequestRequest = z.infer<typeof createRequestSchema>

export const requestIdParamsSchema = z.object({ id: z.string().min(1) })

export const listRequestsQuerySchema = z.object({
  employeeId: z.string().optional(),
  date: z.string().optional(),
})
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>

export const requestResponseSchema = registry.register(
  'RequestResponse',
  z.object({
    id: z.string(),
    employeeId: z.string(),
    date: z.string(),
    shiftId: z.string(),
    type: requestTypeSchema,
  })
)
export type RequestResponse = z.infer<typeof requestResponseSchema>
