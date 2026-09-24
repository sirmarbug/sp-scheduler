import axios from 'axios'
import { logger } from '../config/logger.js'
import { HARD_RULE_DESCRIPTIONS, SOFT_RULE_PRIORITY_DESCRIPTIONS } from '../utils/constants.js'
import { aiResponseSchema } from '../schemas/ai-response.schema.js'
import { validate } from './schedule-validator.service.js'
import type {
  AssignmentForValidation,
  EmployeeForValidation,
  MonthConfigForValidation,
  RequestForValidation,
} from '../types/schedule.js'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

interface AiSchedulerConfig {
  apiKey: string
  model: string
  maxRetries: number
  temperature: number
}

export interface GenerationAttemptLog {
  attemptNumber: number
  timestamp: Date
  issues: string[]
  coverageIssues: string[]
  succeeded: boolean
}

export interface GenerateResult {
  assignments: AssignmentForValidation[]
  attempts: GenerationAttemptLog[]
  status: 'draft' | 'needsCorrection'
}

interface GenerateInput {
  monthConfig: MonthConfigForValidation
  employees: EmployeeForValidation[]
  requests: RequestForValidation[]
  targetHoursByEmployee: Record<string, number>
}

export class AiSchedulerService {
  constructor(private readonly config: AiSchedulerConfig) {}

  buildPrompt(input: GenerateInput, previousAttempt?: GenerationAttemptLog) {
    const systemPrompt = [
      'Jesteś silnikiem układającym grafik zmian dla sklepu. Musisz przydzielić pracowników do zdefiniowanych już slotów (data + zmiana + rola).',
      'Nigdy nie zmieniasz konfiguracji dni ani zmian — przydzielasz wyłącznie do istniejących shiftId.',
      'Reguły twarde (muszą być spełnione zawsze):',
      ...HARD_RULE_DESCRIPTIONS.map((r, i) => `${i + 1}. ${r}`),
      'Priorytety optymalizacji (reguły miękkie, od najważniejszej):',
      ...SOFT_RULE_PRIORITY_DESCRIPTIONS.map((r, i) => `${i + 1}. ${r}`),
      'Odpowiedz wyłącznie w formacie JSON: { "assignments": [{ "employeeId", "date", "shiftId", "role" }], "unfilledSlots": [{ "date", "shiftId", "role", "reason" }] }.',
    ].join('\n')

    const userPayload = {
      month: input.monthConfig.monthValue,
      employees: input.employees,
      days: input.monthConfig.days,
      requests: input.requests,
      targetHoursByEmployee: input.targetHoursByEmployee,
    }

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPayload) },
    ]

    if (previousAttempt) {
      messages.push({
        role: 'user',
        content: `Poprzednia próba naruszyła następujące reguły: ${JSON.stringify(previousAttempt.issues)}. Popraw przydział, zachowując pozostałe przydziały tam, gdzie to możliwe.`,
      })
    }

    return messages
  }

  private async callOpenRouter(messages: Array<{ role: 'system' | 'user'; content: string }>): Promise<string> {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: this.config.model,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' },
        messages,
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    return response.data?.choices?.[0]?.message?.content ?? ''
  }

  private parseResponse(raw: string, monthConfig: MonthConfigForValidation): AssignmentForValidation[] {
    let extracted = raw.trim()
    const fencedMatch = extracted.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fencedMatch) extracted = fencedMatch[1].trim()

    const parsedJson = JSON.parse(extracted)
    const result = aiResponseSchema.parse(parsedJson)

    for (const assignment of result.assignments) {
      const day = monthConfig.days.find((d) => d.date === assignment.date)
      const shift = day?.shifts.find((s) => s.id === assignment.shiftId)
      if (!day || !shift) {
        throw new Error(`AI odwołało się do nieistniejącego slotu ${assignment.date}/${assignment.shiftId}`)
      }
    }

    return result.assignments
  }

  async generateWithRetry(input: GenerateInput): Promise<GenerateResult> {
    const attempts: GenerationAttemptLog[] = []
    let lastAssignments: AssignmentForValidation[] = []
    let previousAttempt: GenerationAttemptLog | undefined

    for (let attemptNumber = 1; attemptNumber <= this.config.maxRetries; attemptNumber += 1) {
      const messages = this.buildPrompt(input, previousAttempt)

      let assignments: AssignmentForValidation[]
      try {
        const raw = await this.callOpenRouter(messages)
        assignments = this.parseResponse(raw, input.monthConfig)
      } catch (err) {
        logger.warn({ err, attemptNumber }, 'AI generation attempt failed to produce a valid response')
        const attempt: GenerationAttemptLog = {
          attemptNumber,
          timestamp: new Date(),
          issues: [(err as Error).message],
          coverageIssues: [],
          succeeded: false,
        }
        attempts.push(attempt)
        previousAttempt = attempt
        continue
      }

      const validation = validate(assignments, input.monthConfig, input.employees, input.requests)
      const attempt: GenerationAttemptLog = {
        attemptNumber,
        timestamp: new Date(),
        issues: validation.issues,
        coverageIssues: validation.coverageIssues,
        succeeded: validation.issues.length === 0,
      }
      attempts.push(attempt)
      lastAssignments = assignments

      if (attempt.succeeded) {
        return { assignments, attempts, status: 'draft' }
      }

      previousAttempt = attempt
    }

    return { assignments: lastAssignments, attempts, status: 'needsCorrection' }
  }
}
