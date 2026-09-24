import type { ShiftDto } from '../schemas/month-config.schema.js'
import { computeDurationQuarterHours } from './time.js'

export function buildDefaultShifts(): ShiftDto[] {
  const definitions: Array<Pick<ShiftDto, 'id' | 'label' | 'shortLabel' | 'start' | 'end' | 'balanceBucket' | 'requiredManagerCount' | 'requiredCashierCount'>> = [
    {
      id: 'morning',
      label: '1 zmiana',
      shortLabel: 'I',
      start: '07:00',
      end: '15:00',
      balanceBucket: 'first',
      requiredManagerCount: 1,
      requiredCashierCount: 1,
    },
    {
      id: 'mid',
      label: 'Środek dnia',
      shortLabel: 'M',
      start: '12:00',
      end: '20:00',
      balanceBucket: 'mid',
      requiredManagerCount: 0,
      requiredCashierCount: 1,
    },
    {
      id: 'evening',
      label: '2 zmiana',
      shortLabel: 'II',
      start: '13:00',
      end: '21:15',
      balanceBucket: 'second',
      requiredManagerCount: 1,
      requiredCashierCount: 1,
    },
  ]

  return definitions.map((definition) => ({
    ...definition,
    type: 'auto',
    enabled: true,
    durationQuarterHours: computeDurationQuarterHours(definition.start, definition.end),
  }))
}

export const DEFAULT_CLOSED_WEEKDAY = 0 // niedziela (dayjs: 0 = Sunday)

export const HARD_RULE_DESCRIPTIONS = [
  'Jedna zmiana dziennie na pracownika.',
  'Brak pracy w dniu zamkniętym.',
  'Respektowanie blokad (avoid).',
  'Rolę kasjera pełni pracownik ze stanowiskiem cashier, albo manager z extraRole cashierEligible (na każdej zmianie); rolę kierownika pełni manager, albo cashier z extraRole managerShift1 (tylko bucket=first/id=morning), albo managerShift2 (tylko bucket=second/id=evening).',
  'Maksymalnie 6 dni pracy w tygodniu ISO na pracownika.',
  'Suma godzin UoP w miesiącu nie może przekroczyć celu godzinowego (docelowo równa).',
  'Liczba przydzielonych osób w danej roli na zmianie nie może przekroczyć requiredRoles.',
] as const

export const SOFT_RULE_PRIORITY_DESCRIPTIONS = [
  'Maksymalne pokrycie slotów.',
  'Dokładność godzin UoP (równe celowi, nie mniej nie więcej).',
  'Balans first vs second dla każdego pracownika.',
  'Zgodność z preferencjami (prefer), konkretna zmiana lepsza niż cały dzień.',
  'Preferowanie UoP nad zlecenie przy zbliżonych innych czynnikach.',
  'Równomierne rozłożenie godzin pomiędzy pracowników.',
  'Kara za nieobsadzony slot — zawsze gorsze niż dopuszczalne przydzielenie.',
] as const
