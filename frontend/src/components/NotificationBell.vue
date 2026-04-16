<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Bell } from '@element-plus/icons-vue'
import { notificationApi } from '@/apis/notification'

interface Notification {
  id: string
  type: string
  message: string
  isRead: boolean
  createdAt: string
}

const notifications = ref<Notification[]>([])
const unreadCount = ref(0)
const visible = ref(false)

async function fetchNotifications() {
  try {
    const res = await notificationApi.list()
    notifications.value = res.data
    unreadCount.value = notifications.value.filter((n) => !n.isRead).length
  } catch {
    // not logged in yet
  }
}

async function markRead(id: string) {
  await notificationApi.markRead(id)
  const n = notifications.value.find((n) => n.id === id)
  if (n) {
    n.isRead = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }
}

async function markAllRead() {
  await notificationApi.markAllRead()
  notifications.value.forEach((n) => (n.isRead = true))
  unreadCount.value = 0
}

onMounted(fetchNotifications)
</script>

<template>
  <el-popover v-model:visible="visible" :width="320" trigger="click">
    <template #reference>
      <el-badge :value="unreadCount || ''" :hidden="unreadCount === 0">
        <el-button :icon="Bell" circle size="default" />
      </el-badge>
    </template>

    <div class="notif-header">
      <span class="notif-title">通知</span>
      <el-button v-if="unreadCount > 0" link size="small" @click="markAllRead">
        全部已讀
      </el-button>
    </div>

    <el-scrollbar max-height="360px">
      <div v-if="notifications.length === 0" class="notif-empty">暫無通知</div>
      <div
        v-for="n in notifications"
        :key="n.id"
        class="notif-item"
        :class="{ unread: !n.isRead }"
        @click="markRead(n.id)"
      >
        <div class="notif-msg">{{ n.message }}</div>
        <div class="notif-time">{{ new Date(n.createdAt).toLocaleString() }}</div>
      </div>
    </el-scrollbar>
  </el-popover>
</template>

<style scoped>
.notif-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 4px;
}
.notif-title {
  font-weight: 600;
  font-size: 14px;
}
.notif-empty {
  text-align: center;
  padding: 24px 0;
  color: #909399;
}
.notif-item {
  padding: 10px 4px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background 0.2s;
}
.notif-item:hover {
  background: #f5f7fa;
}
.notif-item.unread {
  background: #e6f4ff;
}
.notif-msg {
  font-size: 13px;
  color: #303133;
}
.notif-time {
  font-size: 11px;
  color: #909399;
  margin-top: 4px;
}
</style>
