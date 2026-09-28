import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('POST /schedule/:monthValue/approve', () => {
  let app: import('express').Express
  let prisma: import('@prisma/client').PrismaClient
  let accessToken: string
  let employeeId: string
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
      .send({ email: 'approve-test@example.com', password: 'password123' })
    accessToken = registerRes.body.accessToken

    const employee = await prisma.employee.create({
      data: { name: 'Kasia', contractType: 'uop', position: 'cashier', extraRoles: [] },
    })
    employeeId = employee.id

    // 2024-10-01 is a Tuesday (business day) -> auto target is 8h (32 quarter-hours)
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
                end: '15:00',
                shortLabel: 'I',
                durationQuarterHours: 32,
                balanceBucket: 'first',
                type: 'auto',
                enabled: true,
                requiredManagerCount: 0,
                requiredCashierCount: 1,
              },
            ],
          },
        ],
      },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('rejects approval when a UoP employee\'s hours differ from their monthly target', async () => {
    await prisma.schedule.create({
      data: { monthValue, assignments: [], status: 'draft' },
    })

    const res = await request(app)
      .post(`/schedule/${monthValue}/approve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send()

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('schedule.approve.hasIssues')

    const stored = await prisma.schedule.findUnique({ where: { monthValue } })
    expect(stored?.status).toBe('draft')
  })

  it('approves when every UoP employee\'s hours exactly match their monthly target', async () => {
    await prisma.schedule.create({
      data: {
        monthValue,
        assignments: [{ employeeId, date: '2024-10-01', shiftId: 'morning', role: 'cashier' }],
        status: 'draft',
      },
    })

    const res = await request(app)
      .post(`/schedule/${monthValue}/approve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('approved')
  })

  it('rejects approval when a required slot is left uncovered, even with no critical issues', async () => {
    await prisma.employee.deleteMany({})
    const zlecenieEmployee = await prisma.employee.create({
      data: { name: 'Marek', contractType: 'zlecenie', position: 'cashier', extraRoles: [] },
    })

    await prisma.monthConfig.update({
      where: { monthValue },
      data: {
        days: [
          {
            date: '2024-10-01',
            isClosed: false,
            shifts: [
              {
                id: 'morning',
                label: '1 zmiana',
                start: '07:00',
                end: '15:00',
                shortLabel: 'I',
                durationQuarterHours: 32,
                balanceBucket: 'first',
                type: 'auto',
                enabled: true,
                requiredManagerCount: 0,
                requiredCashierCount: 1,
              },
              {
                id: 'evening',
                label: '2 zmiana',
                start: '13:00',
                end: '21:00',
                shortLabel: 'II',
                durationQuarterHours: 32,
                balanceBucket: 'second',
                type: 'auto',
                enabled: true,
                requiredManagerCount: 0,
                requiredCashierCount: 1,
              },
            ],
          },
        ],
      },
    })

    await prisma.schedule.create({
      data: {
        monthValue,
        assignments: [{ employeeId: zlecenieEmployee.id, date: '2024-10-01', shiftId: 'morning', role: 'cashier' }],
        status: 'draft',
      },
    })

    const res = await request(app)
      .post(`/schedule/${monthValue}/approve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send()

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('schedule.approve.hasIssues')

    const stored = await prisma.schedule.findUnique({ where: { monthValue } })
    expect(stored?.status).toBe('draft')
  })
})
