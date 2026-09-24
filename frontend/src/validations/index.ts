import { i18n } from '@/locales'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TIME_REGEX = /^\d{2}:\d{2}$/

const { t } = i18n.global

export const required = (value: string) => !!value || t('validation.required')
export const email = (value: string) => EMAIL_REGEX.test(value) || t('validation.email')
export const minLength = (min: number) => (value: string) =>
  (value?.length ?? 0) >= min || t('validation.minLength', { min })
export const time = (value: string) => TIME_REGEX.test(value) || t('validation.time')
