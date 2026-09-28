import { describe, expect, it } from 'vitest'
import { DeterministicSchedulerService } from '../src/services/deterministic-scheduler.service.js'
import type { EmployeeForValidation, MonthConfigForValidation, RequestForValidation, ShiftForValidation } from '../src/types/schedule.js'

function shift(overrides: Partial<ShiftForValidation> & Pick<ShiftForValidation, 'id'>): ShiftForValidation {
  return {
    balanceBucket: 'mid',
    type: 'auto',
    enabled: true,
    requiredManagerCount: 0,
    requiredCashierCount: 0,
    durationQuarterHours: 32,
    ...overrides,
  }
}

function employee(overrides: Partial<EmployeeForValidation> & Pick<EmployeeForValidation, 'id'>): EmployeeForValidation {
  return { name: overrides.id, contractType: 'zlecenie', position: 'cashier', extraRoles: [], ...overrides }
}

describe('DeterministicSchedulerService', () => {
  it('fills every slot and returns draft status when full coverage is possible', async () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [
        { date: '2024-10-01', isClosed: false, shifts: [shift({ id: 'day', requiredManagerCount: 1, requiredCashierCount: 1 })] },
        { date: '2024-10-02', isClosed: false, shifts: [shift({ id: 'day', requiredManagerCount: 1, requiredCashierCount: 1 })] },
      ],
    }
    const employees = [employee({ id: 'mgr-1', position: 'manager' }), employee({ id: 'csh-1', position: 'cashier' })]
    const service = new DeterministicSchedulerService()

    const result = await service.generateWithRetry({ monthConfig, employees, requests: [], targetHoursByEmployee: {} })

    expect(result.status).toBe('draft')
    expect(result.assignments).toHaveLength(4)
    expect(result.attempts[0].succeeded).toBe(true)
  })

  it('never assigns work on a closed day', async () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [
        { date: '2024-10-01', isClosed: true, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] },
        { date: '2024-10-02', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] },
      ],
    }
    const employees = [employee({ id: 'csh-1', position: 'cashier' })]
    const service = new DeterministicSchedulerService()

    const result = await service.generateWithRetry({ monthConfig, employees, requests: [], targetHoursByEmployee: {} })

    expect(result.assignments.some((a) => a.date === '2024-10-01')).toBe(false)
    expect(result.assignments.filter((a) => a.date === '2024-10-02')).toHaveLength(1)
  })

  it('respects an avoid request for a specific shift but still allows other shifts that day', async () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [
        {
          date: '2024-10-01',
          isClosed: false,
          shifts: [
            shift({ id: 'morning', balanceBucket: 'first', requiredCashierCount: 1 }),
            shift({ id: 'evening', balanceBucket: 'second', requiredCashierCount: 1 }),
          ],
        },
      ],
    }
    const employees = [employee({ id: 'csh-1', position: 'cashier' }), employee({ id: 'csh-2', position: 'cashier' })]
    const requests: RequestForValidation[] = [{ employeeId: 'csh-1', date: '2024-10-01', shiftId: 'morning', type: 'avoid' }]
    const service = new DeterministicSchedulerService()

    const result = await service.generateWithRetry({ monthConfig, employees, requests, targetHoursByEmployee: {} })

    expect(result.assignments.find((a) => a.shiftId === 'morning')?.employeeId).not.toBe('csh-1')
    expect(result.assignments).toHaveLength(2)
  })

  it('respects an avoid "all" request by blocking the whole day', async () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [{ date: '2024-10-01', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] }],
    }
    const employees = [employee({ id: 'csh-1', position: 'cashier' }), employee({ id: 'csh-2', position: 'cashier' })]
    const requests: RequestForValidation[] = [{ employeeId: 'csh-1', date: '2024-10-01', shiftId: 'all', type: 'avoid' }]
    const service = new DeterministicSchedulerService()

    const result = await service.generateWithRetry({ monthConfig, employees, requests, targetHoursByEmployee: {} })

    expect(result.assignments.every((a) => a.employeeId !== 'csh-1')).toBe(true)
  })

  it('only assigns a cashier as manager when eligible for that shift\'s balance bucket', async () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [
        { date: '2024-10-01', isClosed: false, shifts: [shift({ id: 'morning', balanceBucket: 'first', requiredManagerCount: 1 })] },
        { date: '2024-10-02', isClosed: false, shifts: [shift({ id: 'evening', balanceBucket: 'second', requiredManagerCount: 1 })] },
      ],
    }
    const employees = [employee({ id: 'csh-1', position: 'cashier', extraRoles: ['managerShift1'] })]
    const service = new DeterministicSchedulerService()

    const result = await service.generateWithRetry({ monthConfig, employees, requests: [], targetHoursByEmployee: {} })

    expect(result.assignments.find((a) => a.date === '2024-10-01')?.employeeId).toBe('csh-1')
    expect(result.assignments.some((a) => a.date === '2024-10-02')).toBe(false)
  })

  it('does not assign a 7th working day in the same ISO week', async () => {
    const dates = ['2024-09-30', '2024-10-01', '2024-10-02', '2024-10-03', '2024-10-04', '2024-10-05', '2024-10-06']
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: dates.map((date) => ({ date, isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] })),
    }
    const employees = [employee({ id: 'only-one', position: 'cashier' })]
    const service = new DeterministicSchedulerService()

    const result = await service.generateWithRetry({ monthConfig, employees, requests: [], targetHoursByEmployee: {} })

    expect(result.assignments.filter((a) => a.employeeId === 'only-one')).toHaveLength(6)
    expect(result.assignments.some((a) => a.date === dates[6])).toBe(false)
  })

  it('never lets a UoP employee exceed their target hours when another eligible employee can cover the slot instead', async () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [
        { date: '2024-10-01', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1, durationQuarterHours: 32 })] },
        { date: '2024-10-02', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1, durationQuarterHours: 32 })] },
      ],
    }
    const employees = [
      employee({ id: 'uop-1', contractType: 'uop', position: 'cashier' }),
      employee({ id: 'zlecenie-1', contractType: 'zlecenie', position: 'cashier' }),
    ]
    const service = new DeterministicSchedulerService()

    const result = await service.generateWithRetry({ monthConfig, employees, requests: [], targetHoursByEmployee: { 'uop-1': 8 } })

    expect(result.status).toBe('draft')
    expect(result.assignments.filter((a) => a.employeeId === 'uop-1')).toHaveLength(1)
    expect(result.assignments.filter((a) => a.employeeId === 'zlecenie-1')).toHaveLength(1)
  })

  it('returns needsCorrection with coverage issues (but no hard-rule issues) when staff is insufficient', async () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [{ date: '2024-10-01', isClosed: false, shifts: [shift({ id: 'day', requiredManagerCount: 1, requiredCashierCount: 1 })] }],
    }
    const employees = [employee({ id: 'csh-1', position: 'cashier' })]
    const service = new DeterministicSchedulerService()

    const result = await service.generateWithRetry({ monthConfig, employees, requests: [], targetHoursByEmployee: {} })

    expect(result.status).toBe('needsCorrection')
    const lastAttempt = result.attempts[result.attempts.length - 1]
    expect(lastAttempt.issues).toHaveLength(0)
    expect(lastAttempt.coverageIssues.length).toBeGreaterThan(0)
  })

  it('resolves an infeasible requirement quickly instead of hanging', async () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [{ date: '2024-10-01', isClosed: false, shifts: [shift({ id: 'day', requiredManagerCount: 2 })] }],
    }
    const employees = [employee({ id: 'mgr-1', position: 'manager' })]
    const service = new DeterministicSchedulerService()

    const start = Date.now()
    const result = await service.generateWithRetry({ monthConfig, employees, requests: [], targetHoursByEmployee: {} })
    const elapsedMs = Date.now() - start

    expect(elapsedMs).toBeLessThan(2000)
    expect(result.assignments.filter((a) => a.date === '2024-10-01')).toHaveLength(1)
    expect(result.status).toBe('needsCorrection')
  })

  it('prefers a candidate whose preference matches the exact shift over one preferring the whole day', async () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [{ date: '2024-10-01', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] }],
    }
    const employees = [employee({ id: 'exact-pref' }), employee({ id: 'day-pref' })]
    const requests: RequestForValidation[] = [
      { employeeId: 'exact-pref', date: '2024-10-01', shiftId: 'day', type: 'prefer' },
      { employeeId: 'day-pref', date: '2024-10-01', shiftId: 'all', type: 'prefer' },
    ]
    const service = new DeterministicSchedulerService()

    const result = await service.generateWithRetry({ monthConfig, employees, requests, targetHoursByEmployee: {} })

    expect(result.assignments[0]?.employeeId).toBe('exact-pref')
  })

  it('prefers a UoP employee over zlecenie when all other soft-rule criteria are equal', async () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [{ date: '2024-10-01', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] }],
    }
    const employees = [employee({ id: 'zlecenie-1', contractType: 'zlecenie' }), employee({ id: 'uop-1', contractType: 'uop' })]
    const service = new DeterministicSchedulerService()

    const result = await service.generateWithRetry({ monthConfig, employees, requests: [], targetHoursByEmployee: {} })

    expect(result.assignments[0]?.employeeId).toBe('uop-1')
  })

  it('keeps each employee\'s first/second shift count balanced when candidates are otherwise equivalent', async () => {
    const dates = ['2024-10-01', '2024-10-02', '2024-10-03', '2024-10-04']
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: dates.map((date) => ({
        date,
        isClosed: false,
        shifts: [
          shift({ id: 'morning', balanceBucket: 'first', requiredCashierCount: 1 }),
          shift({ id: 'evening', balanceBucket: 'second', requiredCashierCount: 1 }),
        ],
      })),
    }
    const employees = [employee({ id: 'a' }), employee({ id: 'b' })]
    const service = new DeterministicSchedulerService()

    const result = await service.generateWithRetry({ monthConfig, employees, requests: [], targetHoursByEmployee: {} })

    expect(result.status).toBe('draft')
    for (const emp of employees) {
      const firstCount = result.assignments.filter((a) => a.employeeId === emp.id && a.shiftId === 'morning').length
      const secondCount = result.assignments.filter((a) => a.employeeId === emp.id && a.shiftId === 'evening').length
      expect(Math.abs(firstCount - secondCount)).toBeLessThanOrEqual(1)
    }
  })

  it('distributes shifts fairly across equally-eligible UoP employees instead of maxing out one at a time', async () => {
    const dates = Array.from({ length: 20 }, (_, i) => `2024-10-${String(i + 1).padStart(2, '0')}`)
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: dates.map((date) => ({ date, isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] })),
    }
    const employees = [
      employee({ id: 'uop-a', contractType: 'uop' }),
      employee({ id: 'uop-b', contractType: 'uop' }),
      employee({ id: 'uop-c', contractType: 'uop' }),
    ]
    const targetHoursByEmployee = { 'uop-a': 80, 'uop-b': 80, 'uop-c': 80 }
    const service = new DeterministicSchedulerService()

    const result = await service.generateWithRetry({ monthConfig, employees, requests: [], targetHoursByEmployee })

    const counts = employees.map((e) => result.assignments.filter((a) => a.employeeId === e.id).length)
    expect(result.assignments).toHaveLength(20)
    expect(Math.min(...counts)).toBeGreaterThan(0)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2)
  })

  it('returns a result without throwing or hanging when the step budget is exhausted mid-search', async () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [
        { date: '2024-10-01', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] },
        { date: '2024-10-02', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] },
        { date: '2024-10-03', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] },
      ],
    }
    const employees = [employee({ id: 'csh-1', position: 'cashier' }), employee({ id: 'csh-2', position: 'cashier' })]
    const service = new DeterministicSchedulerService({ maxAttempts: 1, maxStepsPerAttempt: 1 })

    const start = Date.now()
    const result = await service.generateWithRetry({ monthConfig, employees, requests: [], targetHoursByEmployee: {} })
    const elapsedMs = Date.now() - start

    expect(elapsedMs).toBeLessThan(2000)
    expect(result.status === 'draft' || result.status === 'needsCorrection').toBe(true)
  })
})
