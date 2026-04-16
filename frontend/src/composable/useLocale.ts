import { useI18n } from 'vue-i18n'
import type { LocaleName } from '@/i18n'

const LOCALE_KEY = 'locale'

const LOCALE_OPTIONS: { label: string; value: LocaleName }[] = [
  { label: '繁體中文', value: 'zh-TW' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
]

export function useLocale() {
  const { locale } = useI18n()

  function setLocale(lang: LocaleName): void {
    locale.value = lang
    localStorage.setItem(LOCALE_KEY, lang)
    document.documentElement.lang = lang
  }

  function initLocale(): void {
    const saved = localStorage.getItem(LOCALE_KEY) as LocaleName | null
    if (saved && LOCALE_OPTIONS.some((o) => o.value === saved)) {
      setLocale(saved)
    }
  }

  return { locale, localeOptions: LOCALE_OPTIONS, setLocale, initLocale }
}
