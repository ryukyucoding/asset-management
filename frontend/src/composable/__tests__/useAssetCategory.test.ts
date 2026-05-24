import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockT = vi.fn((key: string) => {
  const map: Record<string, string> = {
    'asset.categoryMap.HIGH_VALUE': '高價資產',
    'asset.categoryMap.辦公設備': '辦公設備',
  }
  return map[key] ?? key
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: mockT }),
}))

import { useAssetCategory } from '../useAssetCategory'

describe('useAssetCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('categoryLabel maps HIGH_VALUE to localized text', () => {
    const { categoryLabel } = useAssetCategory()
    expect(categoryLabel('HIGH_VALUE')).toBe('高價資產')
  })

  it('categoryLabel returns — for empty values', () => {
    const { categoryLabel } = useAssetCategory()
    expect(categoryLabel(null)).toBe('—')
    expect(categoryLabel(undefined)).toBe('—')
  })

  it('categoryLabel falls back to raw value for unknown categories', () => {
    const { categoryLabel } = useAssetCategory()
    expect(categoryLabel('UNKNOWN')).toBe('UNKNOWN')
  })
})
