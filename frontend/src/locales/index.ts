import { createI18n } from 'vue-i18n'
import { DEFAULT_LOCALE, AVAILABLE_LOCALES } from '@/const'
import en from './langs/en.json'
import pl from './langs/pl.json'

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  availableLocales: AVAILABLE_LOCALES,
  messages: { pl, en },
})
