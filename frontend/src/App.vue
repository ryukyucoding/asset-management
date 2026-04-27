<template>
  <el-config-provider :locale="elLocale">
    <RouterView />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import zhTw from 'element-plus/es/locale/lang/zh-tw'
import en from 'element-plus/es/locale/lang/en'
import ja from 'element-plus/es/locale/lang/ja'
import ko from 'element-plus/es/locale/lang/ko'

const { locale } = useI18n()

const elLocaleMap = { 'zh-TW': zhTw, en, ja, ko }
const elLocale = computed(() => elLocaleMap[locale.value as keyof typeof elLocaleMap] ?? en)
</script>
