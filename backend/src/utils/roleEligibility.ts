import type { EmployeeForValidation, ShiftForValidation } from '../types/schedule.js'

const FIRST_SHIFT_IDS = new Set(['morning'])
const SECOND_SHIFT_IDS = new Set(['evening'])

function isFirstShift(shift: ShiftForValidation): boolean {
  return shift.balanceBucket === 'first' || FIRST_SHIFT_IDS.has(shift.id)
}

function isSecondShift(shift: ShiftForValidation): boolean {
  return shift.balanceBucket === 'second' || SECOND_SHIFT_IDS.has(shift.id)
}

export function canFillRole(
  employee: EmployeeForValidation,
  shift: ShiftForValidation,
  role: 'manager' | 'cashier'
): boolean {
  if (role === 'cashier') {
    return employee.position === 'cashier'
  }

  if (employee.position === 'manager') {
    return true
  }

  if (employee.position === 'cashier' && employee.extraRoles.includes('managerShift1') && isFirstShift(shift)) {
    return true
  }

  if (employee.position === 'cashier' && employee.extraRoles.includes('managerShift2') && isSecondShift(shift)) {
    return true
  }

  return false
}
