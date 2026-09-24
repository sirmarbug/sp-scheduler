import type { RequestForValidation } from '../types/schedule.js'

function matches(request: RequestForValidation, employeeId: string, date: string, shiftId: string): boolean {
  return request.employeeId === employeeId && request.date === date && (request.shiftId === 'all' || request.shiftId === shiftId)
}

export function isAvoided(requests: RequestForValidation[], employeeId: string, date: string, shiftId: string): boolean {
  return requests.some((r) => r.type === 'avoid' && matches(r, employeeId, date, shiftId))
}

export function isPreferred(requests: RequestForValidation[], employeeId: string, date: string, shiftId: string): boolean {
  return requests.some((r) => r.type === 'prefer' && matches(r, employeeId, date, shiftId))
}
