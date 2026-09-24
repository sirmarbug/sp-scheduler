export type ContractType = 'uop' | 'zlecenie'
export type Position = 'manager' | 'cashier'
export type ExtraRole = 'managerShift1' | 'managerShift2'
export type RequestType = 'avoid' | 'prefer'
export type ShiftType = 'auto' | 'manual'
export type BalanceBucket = 'first' | 'mid' | 'second'
export type ScheduleStatus = 'draft' | 'needsCorrection' | 'approved'

export interface EmployeeType {
  id: string
  name: string
  contractType: ContractType
  position: Position
  extraRoles: ExtraRole[]
}

export interface CreateEmployeeRequest {
  name: string
  contractType: ContractType
  position: Position
  extraRoles: ExtraRole[]
}

export interface ShiftDtoType {
  id: string
  label: string
  start: string
  end: string
  shortLabel: string
  durationQuarterHours: number
  balanceBucket: BalanceBucket
  type: ShiftType
  enabled: boolean
  requiredManagerCount: number
  requiredCashierCount: number
}

export interface UpsertShiftRequest {
  label: string
  start: string
  end: string
  shortLabel: string
  balanceBucket: BalanceBucket
  type: ShiftType
  enabled: boolean
  requiredManagerCount: number
  requiredCashierCount: number
}

export interface DayDtoType {
  date: string
  isClosed: boolean
  shifts: ShiftDtoType[]
}

export interface MonthConfigType {
  year: number
  monthIndex: number
  monthValue: string
  days: DayDtoType[]
}

export interface RequestDtoType {
  id: string
  employeeId: string
  date: string
  shiftId: string
  type: RequestType
}

export interface CreateRequestRequest {
  employeeId: string
  date: string
  shiftId: string
  type: RequestType
}

export interface AuthUserType {
  id: string
  email: string
}

export interface AuthResponseType {
  accessToken: string
  user: AuthUserType
}

export interface AssignmentType {
  employeeId: string
  date: string
  shiftId: string
  role: Position
}

export interface ScheduleDiagnosticsType {
  targetQuarterHours: number
  totalSlots: number
  filledCount: number
  unfilledSlots: number
  tier: string
  totalShortfall: number
}

export interface GenerationAttemptType {
  attemptNumber: number
  timestamp: string
  issues: string[]
  coverageIssues: string[]
  succeeded: boolean
}

export interface ScheduleType {
  monthValue: string
  assignments: AssignmentType[]
  diagnostics: ScheduleDiagnosticsType | null
  status: ScheduleStatus
  generationAttempts: GenerationAttemptType[]
}

export interface CellOptionType {
  shiftId: string
  role: Position
}

export interface EmployeeSummaryType {
  employeeId: string
  name: string
  totalHours: number
  targetHours: number | null
  firstCount: number
  secondCount: number
  firstSecondDiff: number
  preferenceHits: number
}

export interface ValidationResultType {
  issues: string[]
  coverageIssues: string[]
  summaryList: EmployeeSummaryType[]
  status: string
}
