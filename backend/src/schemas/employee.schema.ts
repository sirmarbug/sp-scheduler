import { z } from 'zod'
import { registry } from '../docs/registry.js'

export const contractTypeSchema = z.enum(['uop', 'zlecenie'])
export const positionSchema = z.enum(['manager', 'cashier'])
export const extraRoleSchema = z.enum(['managerShift1', 'managerShift2'])

export const createEmployeeSchema = registry.register(
  'CreateEmployeeRequest',
  z.object({
    name: z.string().min(1),
    contractType: contractTypeSchema,
    position: positionSchema,
    extraRoles: z.array(extraRoleSchema).default([]),
  })
)
export type CreateEmployeeRequest = z.infer<typeof createEmployeeSchema>

export const updateEmployeeSchema = registry.register('UpdateEmployeeRequest', createEmployeeSchema.partial())
export type UpdateEmployeeRequest = z.infer<typeof updateEmployeeSchema>

export const employeeIdParamsSchema = z.object({ id: z.string().min(1) })

export const employeeResponseSchema = registry.register(
  'EmployeeResponse',
  z.object({
    id: z.string(),
    name: z.string(),
    contractType: contractTypeSchema,
    position: positionSchema,
    extraRoles: z.array(extraRoleSchema),
  })
)
export type EmployeeResponse = z.infer<typeof employeeResponseSchema>
