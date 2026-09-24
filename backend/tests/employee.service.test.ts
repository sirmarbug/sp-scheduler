import { describe, expect, it, vi } from 'vitest'
import { EmployeeService } from '../src/services/employee.service.js'

function buildPrismaMock() {
  const schedule = {
    id: 'sched-1',
    assignments: [
      { employeeId: 'emp-1', date: '2024-10-01', shiftId: 'morning', role: 'cashier' },
      { employeeId: 'emp-2', date: '2024-10-01', shiftId: 'evening', role: 'cashier' },
    ],
  }

  const employeeDelete = vi.fn()
  const requestDeleteMany = vi.fn()
  const scheduleUpdate = vi.fn()

  const prisma = {
    employee: {
      findUnique: vi.fn().mockResolvedValue({ id: 'emp-1', name: 'Jan' }),
      delete: employeeDelete,
    },
    schedule: {
      findMany: vi.fn().mockResolvedValue([schedule]),
      update: scheduleUpdate,
    },
    request: {
      deleteMany: requestDeleteMany,
    },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  }

  return { prisma, employeeDelete, requestDeleteMany, scheduleUpdate }
}

describe('EmployeeService.remove', () => {
  it('deletes the employee, their requests, and their assignments across schedules in one transaction', async () => {
    const { prisma, employeeDelete, requestDeleteMany, scheduleUpdate } = buildPrismaMock()
    const service = new EmployeeService(prisma as never)

    await service.remove('emp-1')

    expect(employeeDelete).toHaveBeenCalledWith({ where: { id: 'emp-1' } })
    expect(requestDeleteMany).toHaveBeenCalledWith({ where: { employeeId: 'emp-1' } })
    expect(scheduleUpdate).toHaveBeenCalledWith({
      where: { id: 'sched-1' },
      data: { assignments: { set: [{ employeeId: 'emp-2', date: '2024-10-01', shiftId: 'evening', role: 'cashier' }] } },
    })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })
})
