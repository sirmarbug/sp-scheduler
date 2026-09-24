export interface EmployeeForValidation {
  id: string
  name: string
  contractType: 'uop' | 'zlecenie'
  position: 'manager' | 'cashier'
  extraRoles: string[]
}

export interface ShiftForValidation {
  id: string
  balanceBucket: 'first' | 'mid' | 'second'
  type: 'auto' | 'manual'
  enabled: boolean
  requiredManagerCount: number
  requiredCashierCount: number
  durationQuarterHours: number
}

export interface DayForValidation {
  date: string
  isClosed: boolean
  shifts: ShiftForValidation[]
}

export interface MonthConfigForValidation {
  monthValue: string
  days: DayForValidation[]
}

export interface RequestForValidation {
  employeeId: string
  date: string
  shiftId: string
  type: 'avoid' | 'prefer'
}

export interface AssignmentForValidation {
  employeeId: string
  date: string
  shiftId: string
  role: 'manager' | 'cashier'
}

export interface EmployeeSummary {
  employeeId: string
  name: string
  totalHours: number
  targetHours: number | null
  firstCount: number
  secondCount: number
  firstSecondDiff: number
  preferenceHits: number
}

export interface ValidationResult {
  issues: string[]
  coverageIssues: string[]
  summaryList: EmployeeSummary[]
  status: string
}
