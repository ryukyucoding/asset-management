import { createI18n } from 'vue-i18n'
import zhTW from './zh-TW'
import en from './en'
import ja from './ja'
import ko from './ko'

// zh-TW 是 master schema — 其他語言的型別都必須符合這個結構
// 新增 key 時只需在 zh-TW 加，TypeScript 會要求其他語言同步
export type MessageSchema = typeof zhTW
export type LocaleName = 'zh-TW' | 'en' | 'ja' | 'ko'

const i18n = createI18n<[MessageSchema], LocaleName>({
  legacy: false, // 使用 Composition API 模式
  locale: 'zh-TW',
  fallbackLocale: 'en',
  messages: {
    'zh-TW': zhTW,
    en,
    ja,
    ko,
  },
})

export default i18n
