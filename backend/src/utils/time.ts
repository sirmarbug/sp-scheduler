import dayjs from '../config/dayjs.js'
import type { DayForValidation } from '../types/schedule.js'

const QUARTER_HOURS_PER_WORK_DAY = 32 // 8h * 4 (quarter-hour blocks)

export function computeTargetQuarterHours(days: DayForValidation[]): number {
  const businessDays = days.filter((day) => {
    if (day.isClosed) return false
    const weekday = dayjs(day.date).isoWeekday()
    return weekday >= 1 && weekday <= 5
  })
  return businessDays.length * QUARTER_HOURS_PER_WORK_DAY
}

export function computeDurationQuarterHours(start: string, end: string): number {
  const [startHours, startMinutes] = start.split(':').map(Number)
  const [endHours, endMinutes] = end.split(':').map(Number)
  const startTotal = startHours * 60 + startMinutes
  const endTotal = endHours * 60 + endMinutes
  const diffMinutes = endTotal >= startTotal ? endTotal - startTotal : endTotal + 24 * 60 - startTotal
  return Math.round(diffMinutes / 15)
}
