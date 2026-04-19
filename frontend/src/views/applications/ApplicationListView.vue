<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('nav.applications') }}</h1>
        <p class="page-sub">追蹤你提交的資產維修申請進度</p>
      </div>
    </div>

    <!-- Status tabs -->
    <div class="status-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-btn"
        :class="{ 'tab-btn--active': filters.status === tab.value }"
        @click="switchTab(tab.value)"
      >
        {{ tab.label }}
        <span v-if="tab.count" class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <el-table v-loading="loading" :data="applications" row-key="id" style="width:100%">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-panel">
              <!-- 申請資訊 -->
              <div class="expand-section">
                <div class="expand-title">申請資訊</div>
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item :label="t('asset.serialNo')">{{ row.asset?.serialNo ?? '—' }}</el-descriptions-item>
                  <el-descriptions-item :label="t('asset.location')">{{ row.asset?.location ?? '—' }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.faultDescription')" :span="2">
                    <span class="fault-desc">{{ row.faultDescription }}</span>
                  </el-descriptions-item>
                </el-descriptions>
              </div>
              <!-- 維修進度（IN_REPAIR / COMPLETED） -->
              <div v-if="row.status === 'IN_REPAIR' || row.status === 'COMPLETED'" class="expand-section">
                <div class="expand-title">維修進度</div>
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item :label="t('application.repairDate')">{{ formatDate(row.repairDate) }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.repairVendor')">{{ row.repairVendor ?? '待填寫' }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.repairContent')" :span="2">{{ row.repairContent ?? '待填寫' }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.repairSolution')" :span="2">{{ row.repairSolution ?? '待填寫' }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.repairCost')">
                    {{ row.repairCost != null ? `NT$ ${row.repairCost.toLocaleString()}` : '待填寫' }}
                  </el-descriptions-item>
                </el-descriptions>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column :label="t('asset.name')" min-width="180">
          <template #default="{ row }">
            <span class="asset-name">{{ row.asset?.name ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('application.faultDescription')" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ row.faultDescription }}</template>
        </el-table-column>
        <el-table-column :label="t('application.status')" width="130">
          <template #default="{ row }">
            <StatusBadge :status="row.status" :label="statusMap[row.status as AppStatus]" />
          </template>
        </el-table-column>
        <el-table-column :label="t('application.repairVendor')" width="140">
          <template #default="{ row }">
            <span :class="row.repairVendor ? '' : 'text-muted'">{{ row.repairVendor ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="申請時間" width="120">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <span class="total-hint">共 {{ total }} 筆</span>
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="sizes, prev, pager, next"
          background small
          @change="fetchApplications"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { applicationApi } from '@/apis/application'
import StatusBadge from '@/components/StatusBadge.vue'

type AppStatus = 'PENDING' | 'IN_REPAIR' | 'COMPLETED' | 'REJECTED'

interface Application {
  id: string
  status: AppStatus
  faultDescription: string
  repairDate: string | null
  repairContent: string | null
  repairSolution: string | null
  repairCost: number | null
  repairVendor: string | null
  createdAt: string
  asset: { name: string; serialNo: string; location: string } | null
}

const { t } = useI18n()
const loading      = ref(false)
const applications = ref<Application[]>([])
const total        = ref(0)
const page         = ref(1)
const pageSize     = ref(10)
const filters      = reactive({ status: '' })

const statusMap = computed<Record<AppStatus, string>>(() => ({
  PENDING:   t('application.statusMap.PENDING'),
  IN_REPAIR: t('application.statusMap.IN_REPAIR'),
  COMPLETED: t('application.statusMap.COMPLETED'),
  REJECTED:  t('application.statusMap.REJECTED'),
}))

const pendingCount = ref(0)

const tabs = computed(() => [
  { label: '全部',                          value: '' },
  { label: statusMap.value.PENDING,   value: 'PENDING',   count: pendingCount.value },
  { label: statusMap.value.IN_REPAIR, value: 'IN_REPAIR' },
  { label: statusMap.value.COMPLETED, value: 'COMPLETED' },
  { label: statusMap.value.REJECTED,  value: 'REJECTED' },
])

function switchTab(val: string) {
  filters.status = val
  page.value = 1
  fetchApplications()
  fetchPendingCount()
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

async function fetchApplications() {
  loading.value = true
  try {
    const res = await applicationApi.list({ status: filters.status || undefined, page: page.value, limit: pageSize.value })
    applications.value = res.data.data ?? []
    total.value        = res.data.total ?? 0
  } catch { ElMessage.error(t('common.error')) }
  finally { loading.value = false }
}

async function fetchPendingCount() {
  try {
    const res = await applicationApi.list({ status: 'PENDING', limit: 1 })
    pendingCount.value = res.data.total ?? 0
  } catch { /* silent */ }
}

onMounted(() => { fetchApplications(); fetchPendingCount() })
</script>

<style scoped>
.page { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
.page-title { font-size: 22px; font-weight: 700; color: var(--c-text-1); letter-spacing: -0.4px; margin-bottom: 2px; }
.page-sub { font-size: 13px; color: var(--c-text-3); }

/* Tabs */
.status-tabs {
  display: flex; gap: 4px;
  background: var(--c-surface);
  padding: 6px;
  border-radius: var(--r-md);
  border: 1px solid var(--c-border);
  width: fit-content;
}
.tab-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border: none; background: none;
  border-radius: var(--r-sm);
  font-size: 13px; font-weight: 500;
  color: var(--c-text-2); cursor: pointer;
  transition: all var(--t-fast);
}
.tab-btn:hover { background: var(--c-bg); color: var(--c-text-1); }
.tab-btn--active {
  background: var(--c-primary); color: #fff;
  box-shadow: 0 1px 4px rgba(22,119,255,0.35);
}
.tab-count {
  background: rgba(0,0,0,0.12);
  border-radius: var(--r-pill);
  padding: 1px 6px; font-size: 11px; font-weight: 700;
}
.tab-btn--active .tab-count { background: rgba(255,255,255,0.25); }

/* Table */
.table-wrap {
  background: var(--c-surface);
  border-radius: var(--r-md);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.expand-panel { padding: 16px 32px; background: #fafbff; display: flex; flex-direction: column; gap: 16px; }
.expand-section { display: flex; flex-direction: column; gap: 8px; }
.expand-title { font-size: 12px; font-weight: 700; color: var(--c-text-3); text-transform: uppercase; letter-spacing: 0.5px; }

.asset-name { font-weight: 600; color: var(--c-text-1); }
.fault-desc { color: var(--c-text-2); }
.text-muted { color: var(--c-text-4, #c0c4cc); }

.table-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--c-border-light);
  background: #fafafa;
}
.total-hint { font-size: 13px; color: var(--c-text-3); }
</style>
