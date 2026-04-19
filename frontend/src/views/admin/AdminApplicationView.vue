<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">維修申請管理</h1>
        <p class="page-sub">審核員工的資產維修申請，並記錄維修進度</p>
      </div>
    </div>

    <!-- KPI row -->
    <div class="kpi-row">
      <div class="kpi-card kpi-pending">
        <div class="kpi-num">{{ pendingCount }}</div>
        <div class="kpi-label">待審核</div>
      </div>
      <div class="kpi-card kpi-repair">
        <div class="kpi-num">{{ inRepairCount }}</div>
        <div class="kpi-label">維修中</div>
      </div>
      <div class="kpi-card kpi-completed">
        <div class="kpi-num">{{ completedCount }}</div>
        <div class="kpi-label">已完成</div>
      </div>
      <div class="kpi-card kpi-rejected">
        <div class="kpi-num">{{ rejectedCount }}</div>
        <div class="kpi-label">已拒絕</div>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <el-select v-model="filters.status" :placeholder="t('application.status')" clearable @change="fetchApplications">
        <el-option v-for="(label, key) in statusMap" :key="key" :value="key" :label="label" />
      </el-select>
      <el-button @click="resetFilters">{{ t('common.cancel') }}</el-button>
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
                  <el-descriptions-item label="申請人">{{ row.user?.name ?? '—' }}</el-descriptions-item>
                  <el-descriptions-item label="部門">{{ row.user?.department ?? '—' }}</el-descriptions-item>
                  <el-descriptions-item :label="t('asset.serialNo')">{{ row.asset?.serialNo ?? '—' }}</el-descriptions-item>
                  <el-descriptions-item :label="t('asset.category')">{{ row.asset?.category ?? '—' }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.faultDescription')" :span="2">
                    <span class="fault-desc">{{ row.faultDescription }}</span>
                  </el-descriptions-item>
                </el-descriptions>
              </div>
              <!-- 維修細節（有資料才顯示） -->
              <div v-if="row.status === 'IN_REPAIR' || row.status === 'COMPLETED'" class="expand-section">
                <div class="expand-title">維修細節</div>
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item :label="t('application.repairDate')">{{ formatDate(row.repairDate) }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.repairVendor')">{{ row.repairVendor ?? '—' }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.repairContent')" :span="2">{{ row.repairContent ?? '—' }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.repairSolution')" :span="2">{{ row.repairSolution ?? '—' }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.repairCost')">
                    {{ row.repairCost != null ? `NT$ ${row.repairCost.toLocaleString()}` : '—' }}
                  </el-descriptions-item>
                </el-descriptions>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="申請人" width="110">
          <template #default="{ row }">
            <div class="applicant-cell">
              <div class="applicant-avatar">{{ row.user?.name?.[0] ?? '?' }}</div>
              <span>{{ row.user?.name ?? '—' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('asset.name')" min-width="160">
          <template #default="{ row }">
            <span class="asset-name">{{ row.asset?.name ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('application.faultDescription')" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.faultDescription }}</template>
        </el-table-column>
        <el-table-column :label="t('application.status')" width="120">
          <template #default="{ row }">
            <StatusBadge :status="row.status" :label="statusMap[row.status as AppStatus]" />
          </template>
        </el-table-column>
        <el-table-column label="申請時間" width="120">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column width="220" fixed="right">
          <template #default="{ row }">
            <!-- 待審核：核准 / 拒絕 -->
            <template v-if="row.status === 'PENDING'">
              <el-button size="small" type="success" @click="openReviewDialog(row, 'APPROVED')">核准</el-button>
              <el-button size="small" type="danger" plain @click="openReviewDialog(row, 'REJECTED')">拒絕</el-button>
            </template>
            <!-- 維修中：填寫細節 + 完成 -->
            <template v-else-if="row.status === 'IN_REPAIR'">
              <el-button size="small" type="primary" plain @click="openRepairDetailsDialog(row)">填寫細節</el-button>
              <el-button size="small" type="success" @click="handleComplete(row)">維修完成</el-button>
            </template>
          </template>
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

    <!-- 審核 dialog -->
    <el-dialog
      v-model="reviewVisible"
      :title="reviewAction === 'APPROVED' ? '✓ 核准維修申請' : '✕ 拒絕維修申請'"
      width="440px"
      destroy-on-close
    >
      <el-form :model="reviewForm" label-width="80px" class="dialog-form">
        <el-form-item label="備註">
          <el-input v-model="reviewForm.comment" type="textarea" :rows="3" placeholder="選填審核備註" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button
          :type="reviewAction === 'APPROVED' ? 'success' : 'danger'"
          :loading="reviewLoading"
          @click="submitReview"
        >{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <!-- 填寫維修細節 dialog -->
    <el-dialog
      v-model="repairDetailsVisible"
      title="填寫維修細節"
      width="520px"
      destroy-on-close
    >
      <el-form ref="repairFormRef" :model="repairForm" label-width="120px" class="dialog-form">
        <el-form-item :label="t('application.repairDate')">
          <el-date-picker
            v-model="repairForm.repairDate"
            type="date"
            style="width:100%"
            value-format="YYYY-MM-DDTHH:mm:ss.000Z"
          />
        </el-form-item>
        <el-form-item :label="t('application.repairVendor')">
          <el-input v-model="repairForm.repairVendor" placeholder="維修人員或廠商名稱" />
        </el-form-item>
        <el-form-item :label="t('application.repairCost')">
          <el-input-number v-model="repairForm.repairCost" :min="0" style="width:100%" />
        </el-form-item>
        <el-form-item :label="t('application.repairContent')">
          <el-input v-model="repairForm.repairContent" type="textarea" :rows="2" placeholder="故障內容說明" />
        </el-form-item>
        <el-form-item :label="t('application.repairSolution')">
          <el-input v-model="repairForm.repairSolution" type="textarea" :rows="2" placeholder="維修方案說明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="repairDetailsVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="repairDetailsLoading" @click="submitRepairDetails">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
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
  user: { name: string; department: string | null } | null
  asset: { name: string; serialNo: string; category: string } | null
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

const pendingCount   = ref(0)
const inRepairCount  = ref(0)
const completedCount = ref(0)
const rejectedCount  = ref(0)

async function fetchKpis() {
  const [p, r, c, j] = await Promise.all([
    applicationApi.list({ status: 'PENDING',   limit: 1 }),
    applicationApi.list({ status: 'IN_REPAIR', limit: 1 }),
    applicationApi.list({ status: 'COMPLETED', limit: 1 }),
    applicationApi.list({ status: 'REJECTED',  limit: 1 }),
  ])
  pendingCount.value   = p.data.total ?? 0
  inRepairCount.value  = r.data.total ?? 0
  completedCount.value = c.data.total ?? 0
  rejectedCount.value  = j.data.total ?? 0
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

function resetFilters() { filters.status = ''; fetchApplications() }

// ─── 審核 ──────────────────────────────────────────────────────────────────
const reviewVisible   = ref(false)
const reviewLoading   = ref(false)
const reviewAction    = ref<'APPROVED' | 'REJECTED'>('APPROVED')
const reviewTargetId  = ref('')
const reviewForm      = reactive({ comment: '' })

function openReviewDialog(row: Application, action: 'APPROVED' | 'REJECTED') {
  reviewTargetId.value = row.id
  reviewAction.value   = action
  reviewForm.comment   = ''
  reviewVisible.value  = true
}

async function submitReview() {
  reviewLoading.value = true
  try {
    await applicationApi.approve(reviewTargetId.value, {
      action: reviewAction.value,
      comment: reviewForm.comment || undefined,
    })
    ElMessage.success(t('common.success'))
    reviewVisible.value = false
    fetchApplications(); fetchKpis()
  } catch { ElMessage.error(t('common.error')) }
  finally { reviewLoading.value = false }
}

// ─── 填寫維修細節 ──────────────────────────────────────────────────────────
const repairDetailsVisible  = ref(false)
const repairDetailsLoading  = ref(false)
const repairFormRef         = ref<FormInstance>()
const repairTargetId        = ref('')
const repairForm = reactive({
  repairDate:     '' as string,
  repairVendor:   '',
  repairCost:     undefined as number | undefined,
  repairContent:  '',
  repairSolution: '',
})

function openRepairDetailsDialog(row: Application) {
  repairTargetId.value = row.id
  Object.assign(repairForm, {
    repairDate:     row.repairDate     ?? '',
    repairVendor:   row.repairVendor   ?? '',
    repairCost:     row.repairCost     ?? undefined,
    repairContent:  row.repairContent  ?? '',
    repairSolution: row.repairSolution ?? '',
  })
  repairDetailsVisible.value = true
}

async function submitRepairDetails() {
  repairDetailsLoading.value = true
  try {
    await applicationApi.repairDetails(repairTargetId.value, {
      repairDate:     repairForm.repairDate     || undefined,
      repairVendor:   repairForm.repairVendor   || undefined,
      repairCost:     repairForm.repairCost,
      repairContent:  repairForm.repairContent  || undefined,
      repairSolution: repairForm.repairSolution || undefined,
    })
    ElMessage.success(t('common.success'))
    repairDetailsVisible.value = false
    fetchApplications()
  } catch { ElMessage.error(t('common.error')) }
  finally { repairDetailsLoading.value = false }
}

// ─── 維修完成 ──────────────────────────────────────────────────────────────
async function handleComplete(row: Application) {
  await ElMessageBox.confirm('確認此資產維修已完成？資產狀態將恢復為正常使用。', '維修完成確認', { type: 'success' })
  try {
    await applicationApi.complete(row.id)
    ElMessage.success('維修完成，資產已恢復正常使用')
    fetchApplications(); fetchKpis()
  } catch { ElMessage.error(t('common.error')) }
}

onMounted(() => { fetchApplications(); fetchKpis() })
</script>

<style scoped>
.page { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
.page-title { font-size: 22px; font-weight: 700; color: var(--c-text-1); letter-spacing: -0.4px; margin-bottom: 2px; }
.page-sub { font-size: 13px; color: var(--c-text-3); }

/* KPI */
.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi-card {
  background: var(--c-surface);
  border-radius: var(--r-md);
  padding: 18px 20px;
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-xs);
  border-top: 3px solid transparent;
}
.kpi-pending   { border-top-color: #2e90fa; }
.kpi-repair    { border-top-color: #f79009; }
.kpi-completed { border-top-color: var(--c-success); }
.kpi-rejected  { border-top-color: var(--c-danger); }
.kpi-num { font-size: 30px; font-weight: 700; color: var(--c-text-1); line-height: 1; margin-bottom: 4px; }
.kpi-label { font-size: 12px; font-weight: 600; color: var(--c-text-3); text-transform: uppercase; letter-spacing: 0.5px; }

/* Filter */
.filter-bar {
  display: flex; gap: 10px; align-items: center;
  background: var(--c-surface);
  padding: 14px 16px;
  border-radius: var(--r-md);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-xs);
}

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

.applicant-cell { display: flex; align-items: center; gap: 8px; }
.applicant-avatar {
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--c-primary-mid);
  color: var(--c-primary);
  font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

.asset-name { font-weight: 600; color: var(--c-text-1); }
.fault-desc { color: var(--c-text-2); }

.table-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--c-border-light);
  background: #fafafa;
}
.total-hint { font-size: 13px; color: var(--c-text-3); }
.dialog-form { padding: 8px 0; }
</style>
