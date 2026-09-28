import { describe, expect, it } from 'vitest'
import { balanceAssignments } from '../src/services/schedule-balancer.service.js'
import type { AssignmentForValidation, EmployeeForValidation, MonthConfigForValidation, ShiftForValidation } from '../src/types/schedule.js'

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

describe('balanceAssignments', () => {
  it('drops a duplicate assignment and fills an uncovered slot with an eligible employee', () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [
        { date: '2024-10-01', isClosed: false, shifts: [shift({ id: 'cashierShift', requiredCashierCount: 1 })] },
        { date: '2024-10-02', isClosed: false, shifts: [shift({ id: 'managerShift', requiredManagerCount: 1 })] },
      ],
    }
    const employees = [employee({ id: 'cashier-1', position: 'cashier' }), employee({ id: 'manager-1', position: 'manager' })]
    const assignments: AssignmentForValidation[] = [
      { employeeId: 'cashier-1', date: '2024-10-01', shiftId: 'cashierShift', role: 'cashier' },
      { employeeId: 'cashier-1', date: '2024-10-01', shiftId: 'cashierShift', role: 'cashier' },
    ]

    const result = balanceAssignments(assignments, monthConfig, employees, [], {})

    expect(result.filter((a) => a.date === '2024-10-01')).toHaveLength(1)
    expect(result.filter((a) => a.date === '2024-10-02')).toEqual([
      { employeeId: 'manager-1', date: '2024-10-02', shiftId: 'managerShift', role: 'manager' },
    ])
  })

  it('rebalances shifts between an over-target and an under-target UoP employee to hit exact hours', () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [
        { date: '2024-10-01', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] },
        { date: '2024-10-02', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] },
      ],
    }
    const employees = [
      employee({ id: 'a', contractType: 'uop', position: 'cashier' }),
      employee({ id: 'b', contractType: 'uop', position: 'cashier' }),
    ]
    const assignments: AssignmentForValidation[] = [
      { employeeId: 'a', date: '2024-10-01', shiftId: 'day', role: 'cashier' },
      { employeeId: 'a', date: '2024-10-02', shiftId: 'day', role: 'cashier' },
    ]

    const result = balanceAssignments(assignments, monthConfig, employees, [], { a: 8, b: 8 })

    expect(result).toHaveLength(2)
    expect(result.filter((a) => a.employeeId === 'a')).toHaveLength(1)
    expect(result.filter((a) => a.employeeId === 'b')).toHaveLength(1)
  })

  it('takes a shift from a zlecenie employee to cover a UoP deficit, never from an already-at-target UoP employee', () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [
        { date: '2024-10-01', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] },
        { date: '2024-10-02', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] },
        { date: '2024-10-03', isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] },
      ],
    }
    const employees = [
      employee({ id: 'uop-1', contractType: 'uop', position: 'cashier' }),
      employee({ id: 'uop-2', contractType: 'uop', position: 'cashier' }),
      employee({ id: 'zlecenie-1', contractType: 'zlecenie', position: 'cashier' }),
    ]
    // uop-1 needs a second day; uop-2 is already exactly at its own target and must be left untouched;
    // zlecenie-1 has no target and is the only safe donor.
    const assignments: AssignmentForValidation[] = [
      { employeeId: 'uop-1', date: '2024-10-01', shiftId: 'day', role: 'cashier' },
      { employeeId: 'uop-2', date: '2024-10-02', shiftId: 'day', role: 'cashier' },
      { employeeId: 'zlecenie-1', date: '2024-10-03', shiftId: 'day', role: 'cashier' },
    ]

    const result = balanceAssignments(assignments, monthConfig, employees, [], { 'uop-1': 16, 'uop-2': 8 })

    expect(result.filter((a) => a.employeeId === 'uop-1')).toHaveLength(2)
    expect(result.filter((a) => a.employeeId === 'uop-2')).toEqual([
      { employeeId: 'uop-2', date: '2024-10-02', shiftId: 'day', role: 'cashier' },
    ])
    expect(result.filter((a) => a.employeeId === 'zlecenie-1')).toHaveLength(0)
  })

  it('leaves a slot uncovered when no employee is eligible for the required role', () => {
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: [{ date: '2024-10-01', isClosed: false, shifts: [shift({ id: 'day', requiredManagerCount: 1 })] }],
    }
    const employees = [employee({ id: 'cashier-1', position: 'cashier' })]

    const result = balanceAssignments([], monthConfig, employees, [], {})

    expect(result).toHaveLength(0)
  })

  it('does not assign a 7th working day in the same ISO week even to cover a gap', () => {
    const dates = ['2024-09-30', '2024-10-01', '2024-10-02', '2024-10-03', '2024-10-04', '2024-10-05', '2024-10-06']
    const monthConfig: MonthConfigForValidation = {
      monthValue: '2024-10',
      days: dates.map((date) => ({ date, isClosed: false, shifts: [shift({ id: 'day', requiredCashierCount: 1 })] })),
    }
    const employees = [employee({ id: 'only-one', position: 'cashier' })]
    const assignments: AssignmentForValidation[] = dates
      .slice(0, 6)
      .map((date) => ({ employeeId: 'only-one', date, shiftId: 'day', role: 'cashier' as const }))

    const result = balanceAssignments(assignments, monthConfig, employees, [], {})

    expect(result.filter((a) => a.employeeId === 'only-one')).toHaveLength(6)
    expect(result.some((a) => a.date === dates[6])).toBe(false)
  })
})
