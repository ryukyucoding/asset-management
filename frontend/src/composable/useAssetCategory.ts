import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export const ASSET_CATEGORIES = [
  'IT設備',
  '辦公設備',
  '實驗器材',
  '交通工具',
  'HIGH_VALUE',
  '其他',
] as const

export type AssetCategory = (typeof ASSET_CATEGORIES)[number]

export function useAssetCategory() {
  const { t } = useI18n()

  const categoryLabelMap = computed<Record<AssetCategory, string>>(() => ({
    IT設備:     t('asset.categoryMap.IT設備'),
    辦公設備:   t('asset.categoryMap.辦公設備'),
    實驗器材:   t('asset.categoryMap.實驗器材'),
    交通工具:   t('asset.categoryMap.交通工具'),
    HIGH_VALUE: t('asset.categoryMap.HIGH_VALUE'),
    其他:       t('asset.categoryMap.其他'),
  }))

  function categoryLabel(category: string | null | undefined): string {
    if (!category) return '—'
    const map = categoryLabelMap.value
    return (map as Record<string, string>)[category] ?? category
  }

  return {
    categories: ASSET_CATEGORIES,
    categoryLabelMap,
    categoryLabel,
  }
}
