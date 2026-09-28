import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('POST /schedule/:monthValue/generate-deterministic', () => {
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
    await prisma.request.deleteMany({})
    await prisma.employee.deleteMany({})
    await prisma.monthConfig.deleteMany({})
    await prisma.targetHoursOverride.deleteMany({})
    await prisma.user.deleteMany({})

    const registerRes = await request(app)
      .post('/auth/register')
      .send({ email: 'gen-deterministic-test@example.com', password: 'password123' })
    accessToken = registerRes.body.accessToken

    const employee = await prisma.employee.create({
      data: { name: 'Kasia', contractType: 'zlecenie', position: 'cashier', extraRoles: [] },
    })
    employeeId = employee.id

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

  it('fills the single required slot and returns draft status', async () => {
    const res = await request(app)
      .post(`/schedule/${monthValue}/generate-deterministic`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('draft')
    expect(res.body.assignments).toEqual([{ employeeId, date: '2024-10-01', shiftId: 'morning', role: 'cashier' }])
    expect(res.body.generationAttempts).toHaveLength(1)
    expect(res.body.generationAttempts[0].succeeded).toBe(true)
  })

  it('requires authentication', async () => {
    const res = await request(app).post(`/schedule/${monthValue}/generate-deterministic`).send()

    expect(res.status).toBe(401)
  })

  it('returns 404 when the month is not configured', async () => {
    const res = await request(app)
      .post('/schedule/2099-01/generate-deterministic')
      .set('Authorization', `Bearer ${accessToken}`)
      .send()

    expect(res.status).toBe(404)
  })

  it('overwrites an existing schedule from scratch', async () => {
    await prisma.schedule.create({
      data: {
        monthValue,
        assignments: [{ employeeId: 'stale-employee-id', date: '2024-10-01', shiftId: 'morning', role: 'cashier' }],
        status: 'draft',
        generationAttempts: [],
      },
    })

    const res = await request(app)
      .post(`/schedule/${monthValue}/generate-deterministic`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.assignments).toEqual([{ employeeId, date: '2024-10-01', shiftId: 'morning', role: 'cashier' }])
    expect(res.body.assignments.some((a: { employeeId: string }) => a.employeeId === 'stale-employee-id')).toBe(false)
  })

  it('can be used alongside the AI generate endpoint without conflict', async () => {
    const deterministicRes = await request(app)
      .post(`/schedule/${monthValue}/generate-deterministic`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send()
    expect(deterministicRes.status).toBe(200)

    const getRes = await request(app).get(`/schedule/${monthValue}`).set('Authorization', `Bearer ${accessToken}`).send()
    expect(getRes.status).toBe(200)
    expect(getRes.body.status).toBe('draft')
  })
})
