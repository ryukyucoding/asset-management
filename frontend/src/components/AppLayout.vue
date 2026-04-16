<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import {
  Box,
  Document,
  Bell,
  Setting,
  SwitchButton,
  Menu as IconMenu,
} from '@element-plus/icons-vue'
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
  { path: '/admin/assets', label: t('nav.assets'), icon: Box },
  { path: '/admin/applications', label: t('nav.applications'), icon: Setting },
])

const menuItems = computed(() => (auth.isAdmin ? adminItems.value : navItems.value))

async function handleLogout() {
  auth.logout()
  ElMessage.success(t('auth.logoutSuccess'))
  router.push('/login')
}
</script>

<template>
  <el-container class="layout">
    <!-- Sidebar -->
    <el-aside width="220px" class="sidebar">
      <div class="sidebar-logo">
        <span class="logo-text">資產管理系統</span>
      </div>

      <el-menu
        :default-active="route.path"
        router
        class="sidebar-menu"
        background-color="#001529"
        text-color="#ffffffa6"
        active-text-color="#ffffff"
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="main-container">
      <!-- Header -->
      <el-header class="header">
        <div class="header-left">
          <span class="page-title">{{ route.meta.title }}</span>
        </div>
        <div class="header-right">
          <!-- Language switcher -->
          <el-select
            :model-value="locale"
            size="small"
            style="width: 110px; margin-right: 12px"
            @update:model-value="(v: string) => setLocale(v as any)"
          >
            <el-option
              v-for="opt in localeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>

          <!-- Notification bell -->
          <NotificationBell style="margin-right: 16px" />

          <!-- User dropdown -->
          <el-dropdown trigger="click">
            <div class="user-info">
              <el-avatar :size="32" class="avatar">
                {{ auth.user?.name?.[0] ?? 'U' }}
              </el-avatar>
              <span class="username">{{ auth.user?.name }}</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  <el-tag :type="auth.isAdmin ? 'danger' : 'info'" size="small">
                    {{ auth.isAdmin ? 'Admin' : 'User' }}
                  </el-tag>
                </el-dropdown-item>
                <el-dropdown-item divided :icon="SwitchButton" @click="handleLogout">
                  {{ t('auth.logout') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- Main content -->
      <el-main class="main-content">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100%;
}

.sidebar {
  background-color: #001529;
  overflow: hidden;
}

.sidebar-logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #ffffff1a;
}

.logo-text {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.sidebar-menu {
  border-right: none;
}

.main-container {
  overflow: hidden;
}

.header {
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 64px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.avatar {
  background-color: #1677ff;
  color: #fff;
  font-weight: 600;
}

.username {
  font-size: 14px;
  color: #303133;
}

.main-content {
  padding: 24px;
  overflow-y: auto;
  background-color: #f5f7fa;
}
</style>
