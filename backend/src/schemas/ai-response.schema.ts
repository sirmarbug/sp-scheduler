import { z } from 'zod'

export const aiAssignmentSchema = z.object({
  employeeId: z.string(),
  date: z.string(),
  shiftId: z.string(),
  role: z.enum(['manager', 'cashier']),
})

export const aiResponseSchema = z.object({
  assignments: z.array(aiAssignmentSchema),
  unfilledSlots: z
    .array(
      z.object({
        date: z.string(),
        shiftId: z.string(),
        role: z.enum(['manager', 'cashier']),
        reason: z.string().optional(),
      })
    )
    .optional()
    .default([]),
})
export type AiResponse = z.infer<typeof aiResponseSchema>
