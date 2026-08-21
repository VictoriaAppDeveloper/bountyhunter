import { createI18n } from 'vue-i18n'
import en from './messages/en'
import ru from './messages/ru'

export type AppLocale = 'en' | 'ru'
export const SUPPORTED_LOCALES: AppLocale[] = ['en', 'ru']
const STORAGE_KEY = 'bountieshunter.locale'

function detectInitialLocale(): AppLocale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'ru') return saved
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: 'en',
  messages: { en, ru },
})

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
}
