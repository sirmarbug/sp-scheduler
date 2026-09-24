import nock from 'nock'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const OPENROUTER_URL = 'https://openrouter.ai'
const OPENROUTER_PATH = '/api/v1/chat/completions'

function aiChatResponse(content: unknown) {
  return { choices: [{ message: { content: JSON.stringify(content) } }] }
}

describe('POST /schedule/:monthValue/generate', () => {
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
    await prisma.user.deleteMany({})

    const registerRes = await request(app)
      .post('/auth/register')
      .send({ email: 'gen-test@example.com', password: 'password123' })
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

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('succeeds on the first attempt when the AI response is valid', async () => {
    nock(OPENROUTER_URL)
      .post(OPENROUTER_PATH)
      .reply(200, aiChatResponse({ assignments: [{ employeeId, date: '2024-10-01', shiftId: 'morning', role: 'cashier' }] }))

    const res = await request(app)
      .post(`/schedule/${monthValue}/generate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('draft')
    expect(res.body.generationAttempts).toHaveLength(1)
    expect(res.body.generationAttempts[0].succeeded).toBe(true)
  })

  it('retries with feedback after a rule-violating first attempt, then succeeds', async () => {
    const invalidBody = aiChatResponse({
      assignments: [
        { employeeId, date: '2024-10-01', shiftId: 'morning', role: 'cashier' },
        { employeeId, date: '2024-10-01', shiftId: 'morning', role: 'cashier' },
      ],
    })
    const validBody = aiChatResponse({ assignments: [{ employeeId, date: '2024-10-01', shiftId: 'morning', role: 'cashier' }] })

    let secondRequestBody: unknown
    nock(OPENROUTER_URL).post(OPENROUTER_PATH).reply(200, invalidBody)
    nock(OPENROUTER_URL)
      .post(OPENROUTER_PATH)
      .reply(200, (_uri, body) => {
        secondRequestBody = body
        return validBody
      })

    const res = await request(app)
      .post(`/schedule/${monthValue}/generate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('draft')
    expect(res.body.generationAttempts).toHaveLength(2)
    expect(res.body.generationAttempts[0].succeeded).toBe(false)
    expect(res.body.generationAttempts[1].succeeded).toBe(true)
    const secondMessages = (secondRequestBody as { messages: Array<{ content: string }> }).messages
    expect(secondMessages.some((m) => m.content.includes('Poprzednia próba naruszyła'))).toBe(true)
  })

  it('marks the schedule as needsCorrection after exhausting all retries', async () => {
    const invalidBody = aiChatResponse({
      assignments: [
        { employeeId, date: '2024-10-01', shiftId: 'morning', role: 'cashier' },
        { employeeId, date: '2024-10-01', shiftId: 'morning', role: 'cashier' },
      ],
    })
    nock(OPENROUTER_URL).post(OPENROUTER_PATH).times(3).reply(200, invalidBody)

    const res = await request(app)
      .post(`/schedule/${monthValue}/generate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('needsCorrection')
    expect(res.body.generationAttempts).toHaveLength(3)
    expect(res.body.generationAttempts.every((a: { succeeded: boolean }) => !a.succeeded)).toBe(true)
  })

  it('treats an invalid JSON response as a failed attempt without crashing', async () => {
    nock(OPENROUTER_URL).post(OPENROUTER_PATH).reply(200, { choices: [{ message: { content: 'not valid json' } }] })
    nock(OPENROUTER_URL)
      .post(OPENROUTER_PATH)
      .reply(200, aiChatResponse({ assignments: [{ employeeId, date: '2024-10-01', shiftId: 'morning', role: 'cashier' }] }))

    const res = await request(app)
      .post(`/schedule/${monthValue}/generate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('draft')
    expect(res.body.generationAttempts).toHaveLength(2)
    expect(res.body.generationAttempts[0].succeeded).toBe(false)
    expect(res.body.generationAttempts[1].succeeded).toBe(true)
  })
})
