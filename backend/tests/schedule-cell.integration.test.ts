import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('PATCH /schedule/:monthValue/cell', () => {
  let app: import('express').Express
  let prisma: import('@prisma/client').PrismaClient
  let accessToken: string
  let uopEmployeeId: string
  let zlecenieEmployeeId: string
  const monthValue = '2024-10'

  beforeAll(async () => {
    ;({ app } = await import('../src/app.js'))
    ;({ prisma } = await import('../src/config/db.js'))
  })

  beforeEach(async () => {
    await prisma.schedule.deleteMany({})
    await prisma.employee.deleteMany({})
    await prisma.monthConfig.deleteMany({})
    await prisma.targetHoursOverride.deleteMany({})
    await prisma.user.deleteMany({})

    const registerRes = await request(app)
      .post('/auth/register')
      .send({ email: 'cell-test@example.com', password: 'password123' })
    accessToken = registerRes.body.accessToken

    const uopEmployee = await prisma.employee.create({
      data: { name: 'Kasia', contractType: 'uop', position: 'cashier', extraRoles: [] },
    })
    uopEmployeeId = uopEmployee.id

    const zlecenieEmployee = await prisma.employee.create({
      data: { name: 'Zosia', contractType: 'zlecenie', position: 'cashier', extraRoles: [] },
    })
    zlecenieEmployeeId = zlecenieEmployee.id

    // 2024-10-01 is a Tuesday (single business day) -> auto target is 8h (32 quarter-hours)
    // the only shift lasts 10h (40 quarter-hours), so assigning it exceeds the UoP target
    await prisma.monthConfig.create({
      data: {
        year: 2024,
        monthIndex: 9,
        monthValue,
        days: [
          {
            date: '2024-10-01',
            isClosed: false,
            shifts: [
              {
                id: 'morning',
                label: '1 zmiana',
                start: '07:00',
                end: '17:00',
                shortLabel: 'I',
                durationQuarterHours: 40,
                balanceBucket: 'first',
                type: 'auto',
                enabled: true,
                requiredManagerCount: 0,
                requiredCashierCount: 2,
              },
            ],
          },
        ],
      },
    })

    await prisma.schedule.create({
      data: { monthValue, assignments: [], status: 'draft' },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('rejects a cell assignment that would exceed a UoP employee\'s monthly target', async () => {
    const res = await request(app)
      .patch(`/schedule/${monthValue}/cell`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ employeeId: uopEmployeeId, date: '2024-10-01', option: { shiftId: 'morning', role: 'cashier' } })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('schedule.cellExceedsTargetHours')

    const stored = await prisma.schedule.findUnique({ where: { monthValue } })
    expect(stored?.assignments).toEqual([])
  })

  it('allows the same cell assignment for a zlecenie employee, who has no hours target', async () => {
    const res = await request(app)
      .patch(`/schedule/${monthValue}/cell`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ employeeId: zlecenieEmployeeId, date: '2024-10-01', option: { shiftId: 'morning', role: 'cashier' } })

    expect(res.status).toBe(200)
    expect(res.body.assignments).toHaveLength(1)
  })
})
