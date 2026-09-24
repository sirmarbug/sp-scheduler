import type {
  AssignmentForValidation,
  DayForValidation,
  EmployeeForValidation,
  MonthConfigForValidation,
  RequestForValidation,
  ShiftForValidation,
} from '../src/types/schedule.js'

export function buildShift(overrides: Partial<ShiftForValidation> = {}): ShiftForValidation {
  return {
    id: 'morning',
    balanceBucket: 'first',
    type: 'auto',
    enabled: true,
    requiredManagerCount: 1,
    requiredCashierCount: 1,
    durationQuarterHours: 32,
    ...overrides,
  }
}

export function buildDay(overrides: Partial<DayForValidation> & { date: string }): DayForValidation {
  return {
    isClosed: false,
    shifts: [buildShift()],
    ...overrides,
  }
}

export function buildMonthConfig(days: DayForValidation[]): MonthConfigForValidation {
  return { monthValue: '2024-10', days }
}

export function buildEmployee(overrides: Partial<EmployeeForValidation> & { id: string }): EmployeeForValidation {
  return {
    name: overrides.id,
    contractType: 'zlecenie',
    position: 'cashier',
    extraRoles: [],
    ...overrides,
  }
}

export function buildAssignment(overrides: Partial<AssignmentForValidation> = {}): AssignmentForValidation {
  return {
    employeeId: 'emp-1',
    date: '2024-10-01',
    shiftId: 'morning',
    role: 'cashier',
    ...overrides,
  }
}

export function buildRequest(overrides: Partial<RequestForValidation> = {}): RequestForValidation {
  return {
    employeeId: 'emp-1',
    date: '2024-10-01',
    shiftId: 'all',
    type: 'avoid',
    ...overrides,
  }
}
