import { describe, expect, it } from 'vitest'
import { validate } from '../src/services/schedule-validator.service.js'
import { buildAssignment, buildDay, buildEmployee, buildMonthConfig, buildRequest, buildShift } from './fixtures.js'

describe('ScheduleValidatorService', () => {
  it('flags double assignment of the same employee on the same day', () => {
    const monthConfig = buildMonthConfig([
      buildDay({ date: '2024-10-01', shifts: [buildShift({ id: 'morning' }), buildShift({ id: 'evening', balanceBucket: 'second' })] }),
    ])
    const employees = [buildEmployee({ id: 'emp-1' })]
    const assignments = [
      buildAssignment({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'morning' }),
      buildAssignment({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'evening' }),
    ]

    const result = validate(assignments, monthConfig, employees, [])

    expect(result.issues.some((i) => i.includes('więcej niż jedno przypisanie'))).toBe(true)
  })

  it('flags an assignment on a closed day', () => {
    const monthConfig = buildMonthConfig([buildDay({ date: '2024-10-06', isClosed: true, shifts: [] })])
    const employees = [buildEmployee({ id: 'emp-1' })]
    const assignments = [buildAssignment({ employeeId: 'emp-1', date: '2024-10-06', shiftId: 'morning' })]

    const result = validate(assignments, monthConfig, employees, [])

    expect(result.issues.some((i) => i.includes('dniu zamkniętym'))).toBe(true)
  })

  it('flags an assignment violating an avoid request on a specific shift', () => {
    const monthConfig = buildMonthConfig([buildDay({ date: '2024-10-01' })])
    const employees = [buildEmployee({ id: 'emp-1' })]
    const requests = [buildRequest({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'morning', type: 'avoid' })]
    const assignments = [buildAssignment({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'morning' })]

    const result = validate(assignments, monthConfig, employees, requests)

    expect(result.issues.some((i) => i.includes('blokady (avoid)'))).toBe(true)
  })

  it('flags an assignment violating an avoid request for the whole day (shiftId "all")', () => {
    const monthConfig = buildMonthConfig([buildDay({ date: '2024-10-01' })])
    const employees = [buildEmployee({ id: 'emp-1' })]
    const requests = [buildRequest({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'all', type: 'avoid' })]
    const assignments = [buildAssignment({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'morning' })]

    const result = validate(assignments, monthConfig, employees, requests)

    expect(result.issues.some((i) => i.includes('blokady (avoid)'))).toBe(true)
  })

  it('flags a cashier without extra roles assigned as manager', () => {
    const monthConfig = buildMonthConfig([buildDay({ date: '2024-10-01', shifts: [buildShift({ id: 'morning', balanceBucket: 'first' })] })])
    const employees = [buildEmployee({ id: 'emp-1', position: 'cashier', extraRoles: [] })]
    const assignments = [buildAssignment({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'morning', role: 'manager' })]

    const result = validate(assignments, monthConfig, employees, [])

    expect(result.issues.some((i) => i.includes('nie ma uprawnień do roli manager'))).toBe(true)
  })

  it('allows a cashier with managerShift1 to be manager on a "first" bucket shift', () => {
    const monthConfig = buildMonthConfig([buildDay({ date: '2024-10-01', shifts: [buildShift({ id: 'morning', balanceBucket: 'first' })] })])
    const employees = [buildEmployee({ id: 'emp-1', position: 'cashier', extraRoles: ['managerShift1'] })]
    const assignments = [buildAssignment({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'morning', role: 'manager' })]

    const result = validate(assignments, monthConfig, employees, [])

    expect(result.issues.some((i) => i.includes('nie ma uprawnień do roli'))).toBe(false)
  })

  it('rejects a cashier with managerShift1 acting as manager on a "second" bucket shift', () => {
    const monthConfig = buildMonthConfig([buildDay({ date: '2024-10-01', shifts: [buildShift({ id: 'evening', balanceBucket: 'second' })] })])
    const employees = [buildEmployee({ id: 'emp-1', position: 'cashier', extraRoles: ['managerShift1'] })]
    const assignments = [buildAssignment({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'evening', role: 'manager' })]

    const result = validate(assignments, monthConfig, employees, [])

    expect(result.issues.some((i) => i.includes('nie ma uprawnień do roli'))).toBe(true)
  })

  it('rejects a cashier with managerShift1 acting as manager on a "mid" bucket shift', () => {
    const monthConfig = buildMonthConfig([buildDay({ date: '2024-10-01', shifts: [buildShift({ id: 'mid', balanceBucket: 'mid' })] })])
    const employees = [buildEmployee({ id: 'emp-1', position: 'cashier', extraRoles: ['managerShift1'] })]
    const assignments = [buildAssignment({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'mid', role: 'manager' })]

    const result = validate(assignments, monthConfig, employees, [])

    expect(result.issues.some((i) => i.includes('nie ma uprawnień do roli'))).toBe(true)
  })

  it('flags more than 6 work days in one ISO week', () => {
    const dates = ['2024-09-30', '2024-10-01', '2024-10-02', '2024-10-03', '2024-10-04', '2024-10-05', '2024-10-06']
    const monthConfig = buildMonthConfig(dates.map((date) => buildDay({ date })))
    const employees = [buildEmployee({ id: 'emp-1' })]
    const assignments = dates.map((date) => buildAssignment({ employeeId: 'emp-1', date, shiftId: 'morning' }))

    const result = validate(assignments, monthConfig, employees, [])

    expect(result.issues.some((i) => i.includes('pracuje 7 dni'))).toBe(true)
  })

  it('does not flag exactly 6 work days in one ISO week', () => {
    const dates = ['2024-09-30', '2024-10-01', '2024-10-02', '2024-10-03', '2024-10-04', '2024-10-05']
    const monthConfig = buildMonthConfig(dates.map((date) => buildDay({ date })))
    const employees = [buildEmployee({ id: 'emp-1' })]
    const assignments = dates.map((date) => buildAssignment({ employeeId: 'emp-1', date, shiftId: 'morning' }))

    const result = validate(assignments, monthConfig, employees, [])

    expect(result.issues.some((i) => i.includes('maksimum 6'))).toBe(false)
  })

  it('flags UoP hours below target', () => {
    const monthConfig = buildMonthConfig([
      buildDay({ date: '2024-10-01' }),
      buildDay({ date: '2024-10-02' }),
    ])
    const employees = [buildEmployee({ id: 'emp-1', contractType: 'uop' })]
    const assignments = [buildAssignment({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'morning' })]

    const result = validate(assignments, monthConfig, employees, [])

    expect(result.issues.some((i) => i.includes('(UoP) wynoszą'))).toBe(true)
  })

  it('flags UoP hours above target', () => {
    const monthConfig = buildMonthConfig([buildDay({ date: '2024-10-01' })])
    const employees = [buildEmployee({ id: 'emp-1', contractType: 'uop' })]
    const assignments = [
      buildAssignment({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'morning', role: 'cashier' }),
    ]
    // target for a single business day is 8h; give the employee a shift longer than that to exceed target
    monthConfig.days[0].shifts[0] = buildShift({ id: 'morning', durationQuarterHours: 40 })

    const result = validate(assignments, monthConfig, employees, [])

    expect(result.issues.some((i) => i.includes('(UoP) wynoszą'))).toBe(true)
  })

  it('does not flag UoP hours exactly matching target', () => {
    const monthConfig = buildMonthConfig([buildDay({ date: '2024-10-01' })])
    const employees = [buildEmployee({ id: 'emp-1', contractType: 'uop' })]
    const assignments = [buildAssignment({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'morning' })]

    const result = validate(assignments, monthConfig, employees, [])

    expect(result.issues.some((i) => i.includes('(UoP) wynoszą'))).toBe(false)
  })

  it('reports overstaffing as an issue and understaffing as a coverage issue', () => {
    const monthConfig = buildMonthConfig([
      buildDay({
        date: '2024-10-01',
        shifts: [buildShift({ id: 'morning', requiredManagerCount: 0, requiredCashierCount: 1 })],
      }),
    ])
    const employees = [buildEmployee({ id: 'emp-1' }), buildEmployee({ id: 'emp-2' })]
    const assignments = [
      buildAssignment({ employeeId: 'emp-1', date: '2024-10-01', shiftId: 'morning', role: 'cashier' }),
      buildAssignment({ employeeId: 'emp-2', date: '2024-10-01', shiftId: 'morning', role: 'cashier' }),
    ]

    const result = validate(assignments, monthConfig, employees, [])

    expect(result.issues.some((i) => i.includes('Nadmiarowa obsada'))).toBe(true)
    expect(result.coverageIssues.length).toBe(0)
  })

  it('reports understaffing as a coverage issue, not a critical issue', () => {
    const monthConfig = buildMonthConfig([
      buildDay({
        date: '2024-10-01',
        shifts: [buildShift({ id: 'morning', requiredManagerCount: 1, requiredCashierCount: 1 })],
      }),
    ])
    const employees: ReturnType<typeof buildEmployee>[] = []
    const assignments: ReturnType<typeof buildAssignment>[] = []

    const result = validate(assignments, monthConfig, employees, [])

    expect(result.coverageIssues.some((i) => i.includes('Niedobór obsady'))).toBe(true)
    expect(result.issues.length).toBe(0)
  })

  it('reports status "Grafik jest spójny" only when issues and coverageIssues are both empty', () => {
    const monthConfig = buildMonthConfig([buildDay({ date: '2024-10-01', shifts: [] })])
    const result = validate([], monthConfig, [], [])

    expect(result.status).toBe('Grafik jest spójny')
    expect(result.issues).toEqual([])
    expect(result.coverageIssues).toEqual([])
  })
})
