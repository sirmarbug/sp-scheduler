import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('POST /schedule/:monthValue/clear', () => {
  let app: import('express').Express
  let prisma: import('@prisma/client').PrismaClient
  let accessToken: string
  const monthValue = '2024-11'

  beforeAll(async () => {
    ;({ app } = await import('../src/app.js'))
    ;({ prisma } = await import('../src/config/db.js'))
  })

  beforeEach(async () => {
    await prisma.schedule.deleteMany({})
    await prisma.user.deleteMany({})

    const registerRes = await request(app)
      .post('/auth/register')
      .send({ email: 'clear-test@example.com', password: 'password123' })
    accessToken = registerRes.body.accessToken
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('returns 404 when the schedule does not exist', async () => {
    const res = await request(app)
      .post(`/schedule/${monthValue}/clear`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send()

    expect(res.status).toBe(404)
  })

  it('clears assignments and resets status to draft for a non-approved schedule', async () => {
    await prisma.schedule.create({
      data: {
        monthValue,
        assignments: [{ employeeId: 'emp1', date: '2024-11-01', shiftId: 'morning', role: 'cashier' }],
        status: 'needsCorrection',
      },
    })

    const res = await request(app)
      .post(`/schedule/${monthValue}/clear`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.assignments).toEqual([])
    expect(res.body.status).toBe('draft')
  })

  it('rejects clearing an approved schedule', async () => {
    await prisma.schedule.create({
      data: {
        monthValue,
        assignments: [{ employeeId: 'emp1', date: '2024-11-01', shiftId: 'morning', role: 'cashier' }],
        status: 'approved',
      },
    })

    const res = await request(app)
      .post(`/schedule/${monthValue}/clear`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send()

    expect(res.status).toBe(422)

    const stored = await prisma.schedule.findUnique({ where: { monthValue } })
    expect(stored?.assignments).toHaveLength(1)
    expect(stored?.status).toBe('approved')
  })
})
