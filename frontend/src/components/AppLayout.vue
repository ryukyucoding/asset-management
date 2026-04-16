<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Box, Document, Setting, SwitchButton } from '@element-plus/icons-vue'
import { useAuthStore } from '@/store/auth'
import { useLocale } from '@/composable/useLocale'
import NotificationBell from './NotificationBell.vue'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { locale, localeOptions, setLocale } = useLocale()

const navItems = computed(() => [
  { path: '/assets', label: t('nav.assets'), icon: Box },
  { path: '/applications', label: t('nav.applications'), icon: Document },
])

const adminItems = computed(() => [
  { path: '/assets', label: '資產目錄', icon: Box },
  { path: '/admin/assets', label: '資產管理', icon: Setting },
  { path: '/admin/applications', label: '維修審核', icon: Document },
])

const menuItems = computed(() => (auth.isAdmin ? adminItems.value : navItems.value))

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}

async function handleLogout() {
  auth.logout()
  ElMessage.success(t('auth.logoutSuccess'))
  router.push('/login')
}
</script>

<template>
  <div class="layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">
          <el-icon size="18" color="#1677ff"><Box /></el-icon>
        </div>
        <span class="brand-name">AssetHub</span>
        <span class="brand-badge" :class="auth.isAdmin ? 'badge-admin' : 'badge-user'">
          {{ auth.isAdmin ? 'Admin' : 'User' }}
        </span>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section-label">MENU</div>
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ 'nav-item--active': isActive(item.path) }"
        >
          <span class="nav-icon">
            <el-icon size="16"><component :is="item.icon" /></el-icon>
          </span>
          <span class="nav-label">{{ item.label }}</span>
          <span v-if="isActive(item.path)" class="nav-indicator" />
        </router-link>
      </nav>

      <!-- User section -->
      <div class="sidebar-user">
        <div class="user-avatar">{{ auth.user?.name?.[0]?.toUpperCase() ?? 'U' }}</div>
        <div class="user-meta">
          <div class="user-name">{{ auth.user?.name }}</div>
          <div class="user-email">{{ auth.user?.email }}</div>
        </div>
        <button class="logout-btn" :title="t('auth.logout')" @click="handleLogout">
          <el-icon size="15"><SwitchButton /></el-icon>
        </button>
      </div>
    </aside>

    <!-- Main -->
    <div class="main-wrap">
      <!-- Header -->
      <header class="top-bar">
        <div class="top-bar-left">
          <div class="page-breadcrumb">
            <span class="breadcrumb-root">{{ auth.isAdmin ? t('nav.admin') : 'Portal' }}</span>
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-current">{{ route.meta?.title as string ?? '' }}</span>
          </div>
        </div>
        <div class="top-bar-right">
          <el-select
            :model-value="locale"
            size="small"
            class="locale-select"
            @update:model-value="(v: string) => setLocale(v as any)"
          >
            <el-option
              v-for="opt in localeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <NotificationBell />
        </div>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ── Layout shell ── */
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ── Sidebar ── */
.sidebar {
  width: 224px;
  flex-shrink: 0;
  background: var(--c-sidebar);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Brand */
.sidebar-brand {
  height: 60px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--c-sidebar-border);
}

.brand-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(22, 119, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-name {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.3px;
  flex: 1;
}

.brand-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--r-pill);
  letter-spacing: 0.3px;
}

.badge-admin {
  background: rgba(240, 68, 56, 0.2);
  color: #fda29b;
}

.badge-user {
  background: rgba(22, 119, 255, 0.2);
  color: #93c5fd;
}

/* Nav */
.sidebar-nav {
  flex: 1;
  padding: 16px 10px;
  overflow-y: auto;
}

.nav-section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.2px;
  color: rgba(255,255,255,0.28);
  padding: 0 8px;
  margin-bottom: 6px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--r-md);
  margin-bottom: 2px;
  cursor: pointer;
  text-decoration: none;
  color: var(--c-sidebar-text);
  font-size: 13.5px;
  font-weight: 500;
  transition: background var(--t-fast), color var(--t-fast);
  position: relative;
}

.nav-item:hover {
  background: var(--c-sidebar-hover);
  color: #fff;
}

.nav-item--active {
  background: var(--c-sidebar-active-bg);
  color: var(--c-sidebar-text-active);
}

.nav-icon {
  display: flex;
  align-items: center;
  opacity: 0.8;
}

.nav-item--active .nav-icon {
  opacity: 1;
}

.nav-indicator {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--c-primary);
  border-radius: 2px 0 0 2px;
}

/* User */
.sidebar-user {
  padding: 14px 14px;
  border-top: 1px solid var(--c-sidebar-border);
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1677ff, #4096ff);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-meta {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.88);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 11px;
  color: rgba(255,255,255,0.38);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.logout-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.35);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 4px;
  transition: color var(--t-fast), background var(--t-fast);
}

.logout-btn:hover {
  color: #ff7875;
  background: rgba(255,120,117,0.12);
}

/* ── Top bar ── */
.main-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-bar {
  height: 56px;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
  box-shadow: var(--shadow-xs);
}

.page-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.breadcrumb-root {
  color: var(--c-text-3);
  font-weight: 500;
}

.breadcrumb-sep {
  color: var(--c-text-3);
}

.breadcrumb-current {
  color: var(--c-text-1);
  font-weight: 600;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.locale-select {
  width: 108px;
}

/* ── Content ── */
.content {
  flex: 1;
  overflow-y: auto;
  background: var(--c-bg);
}
</style>
