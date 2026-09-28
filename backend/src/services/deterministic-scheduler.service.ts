import dayjs from '../config/dayjs.js'
import { canFillRole } from '../utils/roleEligibility.js'
import { isAvoided } from '../utils/requestMatching.js'
import { findDay, findShift } from '../utils/scheduleLookup.js'
import { computeEmployeeQuarterHours, computeFairShareQuarterHours, computeQuarterHoursDelta } from '../utils/time.js'
import { balanceAssignments } from './schedule-balancer.service.js'
import { validate } from './schedule-validator.service.js'
import type {
  AssignmentForValidation,
  EmployeeForValidation,
  GenerateInput,
  GenerateResult,
  GenerationAttemptLog,
  MonthConfigForValidation,
  RequestForValidation,
  ShiftForValidation,
} from '../types/schedule.js'

const MAX_WORK_DAYS_PER_ISO_WEEK = 6
/** Szerokość strefy martwej wokół sprawiedliwego udziału zlecenia: 32 kwadranse = 8h = jedna pełna zmiana. */
const FAIR_SHARE_TOLERANCE_QUARTER_HOURS = 32
const DEFAULT_MAX_ATTEMPTS = 2
const DEFAULT_MAX_STEPS_PER_ATTEMPT = 20_000
const DEFAULT_TIME_BUDGET_MS_PER_ATTEMPT = 3_000

export interface DeterministicSchedulerConfig {
  maxAttempts?: number
  maxStepsPerAttempt?: number
  timeBudgetMsPerAttempt?: number
}

interface SlotUnit {
  date: string
  shiftId: string
  role: 'manager' | 'cashier'
}

interface SearchBudget {
  maxSteps: number
  deadline: number
}

interface SearchOutcome {
  assignments: AssignmentForValidation[]
  hitBudget: boolean
}

type CandidateScore = [number, number, number, number, number, number]

function isoWeekKeyOf(date: string): string {
  return `${dayjs(date).isoWeekYear()}-W${dayjs(date).isoWeek()}`
}

function workDaysInIsoWeek(working: AssignmentForValidation[], employeeId: string, date: string): Set<string> {
  const key = isoWeekKeyOf(date)
  const days = new Set<string>()
  for (const a of working) {
    if (a.employeeId !== employeeId) continue
    if (isoWeekKeyOf(a.date) !== key) continue
    days.add(a.date)
  }
  return days
}

function countBuckets(
  working: AssignmentForValidation[],
  employeeId: string,
  monthConfig: MonthConfigForValidation
): { firstCount: number; secondCount: number } {
  let firstCount = 0
  let secondCount = 0
  for (const a of working) {
    if (a.employeeId !== employeeId) continue
    const shift = findShift(findDay(monthConfig, a.date), a.shiftId)
    if (!shift) continue
    if (shift.balanceBucket === 'first') firstCount += 1
    if (shift.balanceBucket === 'second') secondCount += 1
  }
  return { firstCount, secondCount }
}

/** Rozbija każdy slot (data+zmiana) na tyle niezależnych jednostek, ile wymaga requiredManagerCount/requiredCashierCount — dzięki temu nadmiarowa obsada jest strukturalnie niemożliwa, algorytm tylko wybiera "kto", nigdy "ile". */
function buildSlotUnits(monthConfig: MonthConfigForValidation): SlotUnit[] {
  const slots: SlotUnit[] = []
  for (const day of monthConfig.days) {
    if (day.isClosed) continue
    for (const shift of day.shifts) {
      if (!shift.enabled) continue
      for (let i = 0; i < shift.requiredManagerCount; i += 1) {
        slots.push({ date: day.date, shiftId: shift.id, role: 'manager' })
      }
      for (let i = 0; i < shift.requiredCashierCount; i += 1) {
        slots.push({ date: day.date, shiftId: shift.id, role: 'cashier' })
      }
    }
  }
  return slots
}

/** Filtrowanie jako prune przeszukiwania (nie post-hoc walidacja) — reguły twarde 1,3,4,5,6. Reguła 7 jest zapewniona przez buildSlotUnits, reguła 2 przez to, że sloty budowane są tylko dla otwartych dni. */
function getEligibleCandidates(
  slot: SlotUnit,
  shift: ShiftForValidation,
  employees: EmployeeForValidation[],
  working: AssignmentForValidation[],
  monthConfig: MonthConfigForValidation,
  requests: RequestForValidation[],
  targetHoursByEmployee: Record<string, number>
): EmployeeForValidation[] {
  return employees.filter((employee) => {
    if (!canFillRole(employee, shift, slot.role)) return false
    if (isAvoided(requests, employee.id, slot.date, slot.shiftId)) return false
    if (working.some((a) => a.employeeId === employee.id && a.date === slot.date)) return false
    if (workDaysInIsoWeek(working, employee.id, slot.date).size >= MAX_WORK_DAYS_PER_ISO_WEEK) return false
    if (employee.contractType === 'uop' && targetHoursByEmployee[employee.id] !== undefined) {
      const delta = computeQuarterHoursDelta(employee.id, working, monthConfig.days, targetHoursByEmployee)
      if (delta + shift.durationQuarterHours > 0) return false
    }
    return true
  })
}

/**
 * Krotka porównywana leksykograficznie (niżej = lepiej), nie suma ważona — reguła miękka
 * o wyższym priorytecie zawsze wygrywa niezależnie od wielkości różnicy w słabszej, co
 * odzwierciedla ściśle malejącą ważność reguł z BUSINESS-REQUIREMENTS.md sekcja 5 bez
 * arbitralnego doboru wag między niewspółmiernymi jednostkami (kwadranse vs. liczba trafień).
 */
function scoreCandidate(
  employee: EmployeeForValidation,
  slot: SlotUnit,
  shift: ShiftForValidation,
  working: AssignmentForValidation[],
  monthConfig: MonthConfigForValidation,
  requests: RequestForValidation[],
  targetHoursByEmployee: Record<string, number>,
  fairShareByEmployee: Record<string, number>
): CandidateScore {
  // Surowa, podpisana delta (nie reszta po przydziale) — im bardziej ujemna, tym dalej
  // pracownik jest od celu, tym wyższy priorytet. Użycie |delta + duration| faworyzowałoby
  // tych, którzy już mają najwięcej godzin (dla nich reszta po przydziale wypada blisko zera),
  // tworząc efekt "bogaty bogatszy" i zostawiając część UoP drastycznie niedociążonych.
  let hoursFitness = 0
  if (employee.contractType === 'uop' && targetHoursByEmployee[employee.id] !== undefined) {
    hoursFitness = computeQuarterHoursDelta(employee.id, working, monthConfig.days, targetHoursByEmployee)
  }

  const { firstCount, secondCount } = countBuckets(working, employee.id, monthConfig)
  const bucketDelta = shift.balanceBucket === 'first' ? 1 : shift.balanceBucket === 'second' ? -1 : 0
  const firstSecondFitness = Math.abs(firstCount - secondCount + bucketDelta)

  const exactPreferred = requests.some(
    (r) => r.type === 'prefer' && r.employeeId === employee.id && r.date === slot.date && r.shiftId === slot.shiftId
  )
  const dayPreferred = requests.some(
    (r) => r.type === 'prefer' && r.employeeId === employee.id && r.date === slot.date && r.shiftId === 'all'
  )
  const preferenceFitness = exactPreferred ? 0 : dayPreferred ? 1 : 2

  const contractFitness = employee.contractType === 'uop' ? 0 : 1
  const loadBalanceFitness = computeEmployeeQuarterHours(working, employee.id, monthConfig.days)

  // Odległość od sprawiedliwego udziału, skwantyzowana co jedną zmianę: kto mieści się w paśmie
  // ±1 zmiany wokół swojego udziału, remisuje tutaj i o wyborze decydują dalsze kryteria (balans
  // first/second, preferencje). Kto odstaje o pełną zmianę lub więcej — wygrywa bezwarunkowo.
  // Kwantyzacja zamiast tolerancji w komparatorze, bo porównanie musi zostać przechodnie.
  const fairShare = fairShareByEmployee[employee.id]
  const fairShareFitness =
    employee.contractType === 'zlecenie' && fairShare !== undefined
      ? Math.trunc((loadBalanceFitness - fairShare) / FAIR_SHARE_TOLERANCE_QUARTER_HOURS)
      : 0

  return [hoursFitness, fairShareFitness, firstSecondFitness, preferenceFitness, contractFitness, loadBalanceFitness]
}

function compareScores(a: CandidateScore, b: CandidateScore): number {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

/**
 * DFS z heurystyką MRV (Most Constrained Variable): na każdym kroku wybiera nieprzypisany
 * slot o najmniejszej liczbie eligible kandydatów (minimalizuje branching factor, remisy
 * rozstrzygane chronologicznie po dacie dzięki stałej kolejności `slots`). Kandydaci na
 * wybranym slocie próbowani od najlepiej punktowanego (best-first value ordering). Budżet
 * kroków/czasu chroni przed eksplozją kombinatoryczną w przypadkach patologicznych (sprzeczne
 * dane, skrajny niedobór kadry) — przy przekroczeniu zwraca najlepszy dotąd znaleziony
 * częściowy wynik zamiast zawieszenia. `baseAssignments` to już ustalone przydziały z
 * poprzedniej próby (liczą się do reguł twardych, ale nie są ponownie przydzielane).
 */
function backtrackSearch(
  slots: SlotUnit[],
  baseAssignments: AssignmentForValidation[],
  employees: EmployeeForValidation[],
  monthConfig: MonthConfigForValidation,
  requests: RequestForValidation[],
  targetHoursByEmployee: Record<string, number>,
  fairShareByEmployee: Record<string, number>,
  budget: SearchBudget
): SearchOutcome {
  const working: AssignmentForValidation[] = baseAssignments.map((a) => ({ ...a }))
  const baseLength = working.length
  const assignedFlags = new Array<boolean>(slots.length).fill(false)
  const state = { steps: 0, hitBudget: false }
  let best = working.map((a) => ({ ...a }))

  function recordBestIfBetter() {
    if (working.length > best.length) {
      best = working.map((a) => ({ ...a }))
    }
  }

  function search(): 'SUCCESS' | 'FAIL' | 'BUDGET' {
    if (state.steps > budget.maxSteps || Date.now() > budget.deadline) {
      state.hitBudget = true
      recordBestIfBetter()
      return 'BUDGET'
    }

    let chosenIndex = -1
    let chosenCandidates: EmployeeForValidation[] = []
    let chosenShift: ShiftForValidation | undefined

    for (let idx = 0; idx < slots.length; idx += 1) {
      if (assignedFlags[idx]) continue
      const slot = slots[idx]
      const shift = findShift(findDay(monthConfig, slot.date), slot.shiftId)
      if (!shift) continue
      const candidates = getEligibleCandidates(slot, shift, employees, working, monthConfig, requests, targetHoursByEmployee)
      if (chosenIndex === -1 || candidates.length < chosenCandidates.length) {
        chosenIndex = idx
        chosenCandidates = candidates
        chosenShift = shift
        if (candidates.length === 0) break
      }
    }

    if (chosenIndex === -1) return 'SUCCESS'

    if (chosenCandidates.length === 0) {
      recordBestIfBetter()
      return 'FAIL'
    }

    const slot = slots[chosenIndex]
    const shift = chosenShift!
    const scored = chosenCandidates
      .map((employee) => ({
        employee,
        score: scoreCandidate(employee, slot, shift, working, monthConfig, requests, targetHoursByEmployee, fairShareByEmployee),
      }))
      .sort((a, b) => compareScores(a.score, b.score))

    assignedFlags[chosenIndex] = true

    for (const { employee } of scored) {
      state.steps += 1
      working.push({ employeeId: employee.id, date: slot.date, shiftId: slot.shiftId, role: slot.role })

      const outcome = search()
      if (outcome === 'SUCCESS' || outcome === 'BUDGET') return outcome

      working.pop()
    }

    assignedFlags[chosenIndex] = false
    recordBestIfBetter()
    return 'FAIL'
  }

  const outcome = search()
  if (outcome === 'SUCCESS') {
    return { assignments: working.slice(baseLength).map((a) => ({ ...a })), hitBudget: false }
  }
  recordBestIfBetter()
  return { assignments: best.slice(baseLength).map((a) => ({ ...a })), hitBudget: state.hitBudget }
}

/** Sloty z `allSlots` jeszcze nieobsadzone w `assignments` (liczone per data|zmiana|rola, uwzględniając wielokrotne jednostki tego samego slotu). */
function computeStillUnfilledSlots(allSlots: SlotUnit[], assignments: AssignmentForValidation[]): SlotUnit[] {
  const filledCounts = new Map<string, number>()
  for (const a of assignments) {
    const key = `${a.date}|${a.shiftId}|${a.role}`
    filledCounts.set(key, (filledCounts.get(key) ?? 0) + 1)
  }

  const remaining: SlotUnit[] = []
  for (const slot of allSlots) {
    const key = `${slot.date}|${slot.shiftId}|${slot.role}`
    const count = filledCounts.get(key) ?? 0
    if (count > 0) {
      filledCounts.set(key, count - 1)
    } else {
      remaining.push(slot)
    }
  }
  return remaining
}

export class DeterministicSchedulerService {
  constructor(private readonly config: DeterministicSchedulerConfig = {}) {}

  async generateWithRetry(input: GenerateInput): Promise<GenerateResult> {
    const attempts: GenerationAttemptLog[] = []
    const allSlots = buildSlotUnits(input.monthConfig)
    const maxAttempts = this.config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    const maxSteps = this.config.maxStepsPerAttempt ?? DEFAULT_MAX_STEPS_PER_ATTEMPT
    const timeBudgetMs = this.config.timeBudgetMsPerAttempt ?? DEFAULT_TIME_BUDGET_MS_PER_ATTEMPT
    const targetHoursOverrides = new Map(Object.entries(input.targetHoursByEmployee))
    const uopEmployees = input.employees.filter((e) => e.contractType === 'uop')
    // Cel miękki dla zlecenia: równy podział tego, co zostaje po celach UoP. Liczony raz —
    // zależy wyłącznie od konfiguracji miesiąca i składu zespołu, nie od stanu przydziału.
    const fairShareByEmployee = computeFairShareQuarterHours(input.monthConfig.days, input.employees, input.targetHoursByEmployee)

    let working: AssignmentForValidation[] = []
    let remainingSlots = allSlots

    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
      // Faza 1: wyczerpać możliwości przydziału wyłącznie pracownikom UoP, zanim
      // zlecenie w ogóle wejdzie do gry (reguła miękka 5 — UoP ma priorytet).
      const uopSearch = backtrackSearch(
        remainingSlots,
        working,
        uopEmployees,
        input.monthConfig,
        input.requests,
        input.targetHoursByEmployee,
        fairShareByEmployee,
        { maxSteps, deadline: Date.now() + timeBudgetMs }
      )
      const afterUop = [...working, ...uopSearch.assignments]
      const slotsAfterUop = computeStillUnfilledSlots(remainingSlots, uopSearch.assignments)

      // Faza 2: dobija resztę slotów pełną pulą (zlecenie + ewentualny zapas UoP,
      // gdyby faza 1 nie wyczerpała budżetu do końca) — scoring nadal faworyzuje
      // niedociążonego UoP, więc to zabezpieczenie, nie furtka dla zlecenie.
      const fillSearch = backtrackSearch(
        slotsAfterUop,
        afterUop,
        input.employees,
        input.monthConfig,
        input.requests,
        input.targetHoursByEmployee,
        fairShareByEmployee,
        { maxSteps, deadline: Date.now() + timeBudgetMs }
      )

      const combined = [...afterUop, ...fillSearch.assignments]
      const balanced = balanceAssignments(combined, input.monthConfig, input.employees, input.requests, input.targetHoursByEmployee)
      const validation = validate(balanced, input.monthConfig, input.employees, input.requests, targetHoursOverrides)
      const succeeded = validation.issues.length === 0 && validation.coverageIssues.length === 0

      attempts.push({
        attemptNumber,
        timestamp: new Date(),
        issues: validation.issues,
        coverageIssues: validation.coverageIssues,
        succeeded,
      })

      working = balanced

      if (succeeded) {
        return { assignments: balanced, attempts, status: 'draft' }
      }
      if (!uopSearch.hitBudget && !fillSearch.hitBudget) break

      remainingSlots = computeStillUnfilledSlots(allSlots, working)
      if (remainingSlots.length === 0) break
    }

    return { assignments: working, attempts, status: 'needsCorrection' }
  }
}
