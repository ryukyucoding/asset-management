<template>
  <div class="login-shell">
    <!-- Left panel -->
    <div class="left-panel">
      <div class="left-content">
        <div class="product-logo">
          <el-icon size="28" color="#fff"><Box /></el-icon>
        </div>
        <h1 class="product-name">AssetHub</h1>
        <p class="product-tagline">企業資產管理・維修追蹤平台</p>

        <ul class="feature-list">
          <li v-for="f in features" :key="f">
            <span class="check-icon">✓</span>
            {{ f }}
          </li>
        </ul>
      </div>

      <!-- Grid decoration -->
      <div class="grid-bg" aria-hidden="true" />
    </div>

    <!-- Right panel -->
    <div class="right-panel">
      <div class="form-card">
        <div class="form-header">
          <h2>{{ t('auth.loginTitle') }}</h2>
          <p>{{ t('auth.loginSubtitle') }}</p>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          class="login-form"
          @submit.prevent="handleLogin"
        >
          <el-form-item prop="email" class="form-field">
            <label class="field-label">{{ t('auth.email') }}</label>
            <el-input
              v-model="form.email"
              :placeholder="t('auth.emailPlaceholder')"
              size="large"
              autocomplete="email"
            />
          </el-form-item>

          <el-form-item prop="password" class="form-field">
            <label class="field-label">{{ t('auth.password') }}</label>
            <el-input
              v-model="form.password"
              :placeholder="t('auth.passwordPlaceholder')"
              type="password"
              size="large"
              show-password
              autocomplete="current-password"
            />
          </el-form-item>

          <el-button
            type="primary"
            size="large"
            native-type="submit"
            :loading="loading"
            class="submit-btn"
          >
            {{ t('auth.loginBtn') }}
          </el-button>
        </el-form>

        <div class="locale-bar">
          <button
            v-for="loc in locales"
            :key="loc.value"
            class="locale-btn"
            :class="{ 'locale-btn--active': currentLocale === loc.value }"
            @click="setLocale(loc.value)"
          >
            {{ loc.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Box } from '@element-plus/icons-vue'
import { useAuthStore } from '@/store/auth'
import { useLocale } from '@/composable/useLocale'
import type { LocaleName } from '@/i18n'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const { locale: currentLocale, setLocale } = useLocale()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({ email: '', password: '' })

const rules: FormRules = {
  email: [
    { required: true, message: () => t('auth.email'), trigger: 'blur' },
    { type: 'email', message: 'Invalid email format', trigger: 'blur' },
  ],
  password: [
    { required: true, message: () => t('auth.password'), trigger: 'blur' },
    { min: 6, message: 'Min 6 characters', trigger: 'blur' },
  ],
}

const locales: { value: LocaleName; label: string }[] = [
  { value: 'zh-TW', label: '繁中' },
  { value: 'en', label: 'EN' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

const features = [
  '資產台帳管理與追蹤',
  '維修申請與審核流程',
  '即時通知與狀態提醒',
  '圖片記錄與雲端存儲',
]

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authStore.login(form.email, form.password)
    router.push('/assets')
  } catch {
    ElMessage.error(t('common.error'))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-shell {
  display: flex;
  min-height: 100vh;
}

/* ── Left panel ── */
.left-panel {
  width: 42%;
  background: linear-gradient(160deg, #0a1628 0%, #0d2248 55%, #0a3580 100%);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
}

.left-content {
  position: relative;
  z-index: 1;
  padding: 48px;
  max-width: 360px;
}

.product-logo {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: rgba(22, 119, 255, 0.2);
  border: 1px solid rgba(22, 119, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.product-name {
  font-size: 30px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.8px;
  margin-bottom: 8px;
}

.product-tagline {
  font-size: 15px;
  color: rgba(255,255,255,0.55);
  line-height: 1.5;
  margin-bottom: 40px;
}

.feature-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feature-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: rgba(255,255,255,0.7);
  font-weight: 500;
}

.check-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(22, 119, 255, 0.25);
  color: #60a5fa;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ── Right panel ── */
.right-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  padding: 48px 24px;
}

.form-card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 40px 40px 32px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04);
}

.form-header {
  margin-bottom: 28px;
}

.form-header h2 {
  font-size: 22px;
  font-weight: 700;
  color: #0d1117;
  letter-spacing: -0.4px;
  margin-bottom: 4px;
}

.form-header p {
  font-size: 14px;
  color: #6b7280;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field {
  display: flex;
  flex-direction: column;
  margin-bottom: 0 !important;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
  display: block;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.2px;
  margin-top: 8px;
  border-radius: 8px !important;
}

/* Locale */
.locale-bar {
  display: flex;
  justify-content: center;
  gap: 2px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.locale-btn {
  background: none;
  border: none;
  font-size: 12px;
  font-weight: 500;
  color: #9ca3af;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}

.locale-btn:hover {
  color: #374151;
  background: #f3f4f6;
}

.locale-btn--active {
  color: #1677ff;
  font-weight: 600;
}

@media (max-width: 768px) {
  .left-panel { display: none; }
  .right-panel { background: #fff; }
}
</style>
