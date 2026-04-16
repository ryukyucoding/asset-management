<template>
  <span class="badge" :class="`badge--${variant}`">
    <span class="badge-dot" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: string; label: string }>()

const variant = computed(() => {
  const map: Record<string, string> = {
    AVAILABLE: 'success',
    APPROVED: 'success',
    BORROWED: 'warning',
    PENDING: 'pending',
    CLAIMED: 'info',
    RETURNED: 'neutral',
    REJECTED: 'danger',
    CANCELLED: 'neutral',
    RETIRED: 'danger',
  }
  return map[props.status] ?? 'neutral'
})
</script>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px 3px 7px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.badge--success { background: var(--c-success-soft); color: #027a48; }
.badge--success .badge-dot { background: var(--c-success); }

.badge--warning { background: var(--c-warning-soft); color: #b54708; }
.badge--warning .badge-dot { background: var(--c-warning); }

.badge--danger { background: var(--c-danger-soft); color: #b42318; }
.badge--danger .badge-dot { background: var(--c-danger); }

.badge--info { background: var(--c-info-soft); color: #3730a3; }
.badge--info .badge-dot { background: var(--c-info); }

.badge--pending { background: #eff8ff; color: #175cd3; }
.badge--pending .badge-dot { background: #2e90fa; }

.badge--neutral { background: var(--c-neutral-soft); color: #4b5563; }
.badge--neutral .badge-dot { background: #9ca3af; }
</style>
