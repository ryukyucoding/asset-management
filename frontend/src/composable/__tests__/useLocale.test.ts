import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// ─── Mock vue-i18n ─────────────────────────────────────────────────────────
const mockLocale = ref('zh-TW')

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ locale: mockLocale }),
}))

// ─── Mock @/i18n ──────────────────────────────────────────────────────────
vi.mock('@/i18n', () => ({}))

import { useLocale } from '../useLocale'

describe('useLocale', () => {
  beforeEach(() => {
    mockLocale.value = 'zh-TW'
    localStorage.clear()
    document.documentElement.lang = ''
    vi.clearAllMocks()
  })

  describe('localeOptions', () => {
    it('returns all four supported locales', () => {
      const { localeOptions } = useLocale()
      const values = localeOptions.map((o) => o.value)
      expect(values).toContain('zh-TW')
      expect(values).toContain('en')
      expect(values).toContain('ja')
      expect(values).toContain('ko')
    })

    it('each option has label and value', () => {
      const { localeOptions } = useLocale()
      localeOptions.forEach((o) => {
        expect(o.label).toBeTruthy()
        expect(o.value).toBeTruthy()
      })
    })
  })

  describe('setLocale', () => {
    it('updates the reactive locale ref', () => {
      const { setLocale, locale } = useLocale()
      setLocale('en')
      expect(locale.value).toBe('en')
    })

    it('persists to localStorage', () => {
      const { setLocale } = useLocale()
      setLocale('ja')
      expect(localStorage.getItem('locale')).toBe('ja')
    })

    it('sets document.documentElement.lang', () => {
      const { setLocale } = useLocale()
      setLocale('ko')
      expect(document.documentElement.lang).toBe('ko')
    })
  })

  describe('initLocale', () => {
    it('restores locale from localStorage when valid', () => {
      localStorage.setItem('locale', 'en')
      const { initLocale, locale } = useLocale()
      initLocale()
      expect(locale.value).toBe('en')
    })

    it('does nothing when localStorage value is absent', () => {
      const { initLocale, locale } = useLocale()
      initLocale()
      expect(locale.value).toBe('zh-TW') // unchanged default
    })

    it('does nothing when localStorage value is an invalid locale', () => {
      localStorage.setItem('locale', 'xx-INVALID')
      const { initLocale, locale } = useLocale()
      initLocale()
      expect(locale.value).toBe('zh-TW') // unchanged
    })
  })

  describe('locale ref exposure', () => {
    it('locale ref reflects current mockLocale value', () => {
      mockLocale.value = 'ja'
      const { locale } = useLocale()
      expect(locale.value).toBe('ja')
    })
  })
})
