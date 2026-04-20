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
              <!-- 故障照片 -->
              <div v-if="row.imageUrls?.length" class="expand-section">
                <div class="expand-title">
                  故障照片
                  <span class="photo-count-badge">{{ row.imageUrls.length }} 張</span>
                </div>
                <div class="photo-grid">
                  <div
                    v-for="(url, idx) in row.imageUrls"
                    :key="url"
                    class="photo-item"
                    @click="openViewer(row.imageUrls, idx)"
                  >
                    <img :src="url" class="fault-photo" alt="故障照片" />
                    <button class="photo-dl-btn" title="下載此照片" @click.stop="downloadPhoto(url, idx + 1)">
                      <el-icon><Download /></el-icon>
                    </button>
                  </div>
                </div>
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
        <el-table-column :label="t('application.faultDescription')" min-width="200">
          <template #default="{ row }">
            <div class="fault-cell">
              <span class="fault-text" :title="row.faultDescription">{{ row.faultDescription }}</span>
              <button
                v-if="row.imageUrls?.length"
                type="button"
                class="photo-pill"
                :title="`查看 ${row.imageUrls.length} 張故障照片`"
                @click.stop="openViewer(row.imageUrls, 0)"
              >
                <el-icon><Camera /></el-icon>{{ row.imageUrls.length }}
              </button>
            </div>
          </template>
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

    <!-- 故障照片 Viewer -->
    <el-dialog
      v-model="viewerVisible"
      :show-close="false"
      class="photo-viewer-dialog"
      width="min(90vw, 960px)"
      align-center
      destroy-on-close
    >
      <template #header>
        <div class="viewer-header">
          <span class="viewer-counter">
            <el-icon><Camera /></el-icon>
            故障照片 {{ viewerIndex + 1 }} / {{ viewerUrls.length }}
          </span>
          <el-button type="info" plain size="small" circle @click="viewerVisible = false">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </template>

      <div class="viewer-stage" @wheel.prevent="onViewerWheel">
        <button
          v-if="viewerUrls.length > 1"
          type="button"
          class="viewer-arrow viewer-arrow-prev"
          @click="viewerPrev"
        >
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <div class="viewer-img-wrap">
          <img
            :src="viewerCurrentUrl"
            class="viewer-img"
            :style="{ transform: `scale(${viewerScale}) rotate(${viewerRotate}deg)` }"
            draggable="false"
            alt="故障照片"
          />
        </div>
        <button
          v-if="viewerUrls.length > 1"
          type="button"
          class="viewer-arrow viewer-arrow-next"
          @click="viewerNext"
        >
          <el-icon><ArrowRight /></el-icon>
        </button>
      </div>

      <template #footer>
        <div class="viewer-toolbar">
          <div class="viewer-controls">
            <!-- 旋轉 -->
            <div class="viewer-btn-group">
              <el-button :icon="RefreshLeft"  circle plain size="small" title="向左旋轉 90°（[）" @click="viewerRotateLeft" />
              <el-button :icon="RefreshRight" circle plain size="small" title="向右旋轉 90°（]）" @click="viewerRotateRight" />
            </div>
            <div class="viewer-divider" />
            <!-- 縮放 -->
            <div class="viewer-btn-group">
              <el-button :icon="ZoomOut" circle plain size="small" title="縮小（-）" @click="viewerZoomOut" />
              <span class="viewer-zoom-label" title="點擊重置縮放（0）" @click="viewerReset">
                {{ Math.round(viewerScale * 100) }}%
              </span>
              <el-button :icon="ZoomIn" circle plain size="small" title="放大（+）" @click="viewerZoomIn" />
            </div>
            <div class="viewer-divider" />
            <!-- 重置 -->
            <el-button :icon="Refresh" circle plain size="small" title="重置縮放與旋轉（0）" @click="viewerReset" />
          </div>
          <el-button type="primary" :icon="Download" @click="downloadCurrentPhoto">下載</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { Camera, Download, Close, ArrowLeft, ArrowRight, ZoomIn, ZoomOut, RefreshLeft, RefreshRight, Refresh } from '@element-plus/icons-vue'
import { applicationApi } from '@/apis/application'
import StatusBadge from '@/components/StatusBadge.vue'

type AppStatus = 'PENDING' | 'IN_REPAIR' | 'COMPLETED' | 'REJECTED'

interface Application {
  id: string
  status: AppStatus
  faultDescription: string
  imageUrls: string[]
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
  try {
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
  } catch { /* silent — KPI is non-critical */ }
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

// ─── 故障照片 Viewer ───────────────────────────────────────────────────────
const viewerVisible    = ref(false)
const viewerUrls       = ref<string[]>([])
const viewerIndex      = ref(0)
const viewerScale      = ref(1)
const viewerRotate     = ref(0)   // degrees: 0 / 90 / 180 / 270
const viewerCurrentUrl = computed(() => viewerUrls.value[viewerIndex.value] ?? '')

function openViewer(urls: string[], index = 0) {
  if (!urls.length) return
  viewerUrls.value    = urls
  viewerIndex.value   = index
  viewerScale.value   = 1
  viewerRotate.value  = 0
  viewerVisible.value = true
}

function viewerPrev() {
  viewerIndex.value  = (viewerIndex.value - 1 + viewerUrls.value.length) % viewerUrls.value.length
  viewerScale.value  = 1
  viewerRotate.value = 0
}
function viewerNext() {
  viewerIndex.value  = (viewerIndex.value + 1) % viewerUrls.value.length
  viewerScale.value  = 1
  viewerRotate.value = 0
}
function viewerZoomIn()      { viewerScale.value  = Math.min(viewerScale.value + 0.25, 4) }
function viewerZoomOut()     { viewerScale.value  = Math.max(viewerScale.value - 0.25, 0.25) }
function viewerRotateLeft()  { viewerRotate.value = (viewerRotate.value - 90 + 360) % 360 }
function viewerRotateRight() { viewerRotate.value = (viewerRotate.value + 90) % 360 }
function viewerReset()       { viewerScale.value  = 1; viewerRotate.value = 0 }

function onViewerWheel(e: WheelEvent) {
  e.deltaY < 0 ? viewerZoomIn() : viewerZoomOut()
}

function onViewerKeydown(e: KeyboardEvent) {
  if      (e.key === 'ArrowLeft')       viewerPrev()
  else if (e.key === 'ArrowRight')      viewerNext()
  else if (e.key === '+' || e.key === '=') viewerZoomIn()
  else if (e.key === '-')               viewerZoomOut()
  else if (e.key === '[')               viewerRotateLeft()
  else if (e.key === ']')               viewerRotateRight()
  else if (e.key === '0')               viewerReset()
}

watch(viewerVisible, (v) => {
  if (v) document.addEventListener('keydown', onViewerKeydown)
  else   document.removeEventListener('keydown', onViewerKeydown)
})

async function downloadPhoto(url: string, index: number) {
  try {
    const res  = await fetch(url)
    const blob = await res.blob()
    const ext  = blob.type.split('/')[1] ?? 'jpg'
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `fault-photo-${index}.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch {
    ElMessage.error('下載失敗，請稍後再試')
  }
}

async function downloadCurrentPhoto() {
  await downloadPhoto(viewerCurrentUrl.value, viewerIndex.value + 1)
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

/* ── 故障描述欄 ─────────────────────────────────────────────────────────── */
.fault-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
}
.fault-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.photo-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px 1px 5px;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.6;
  border: 1px solid #bfdbfe;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.photo-pill:hover {
  background: #dbeafe;
  border-color: #93c5fd;
}
.photo-pill .el-icon { font-size: 11px; }

/* ── 故障照片區塊 ────────────────────────────────────────────────────────── */
.expand-title .photo-count-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  padding: 0 7px;
  height: 18px;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid #bfdbfe;
  vertical-align: middle;
}

.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.photo-item {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-xs);
  flex-shrink: 0;
}

.fault-photo {
  width: 100%;
  height: 100%;
  display: block;
  cursor: zoom-in;
}

.fault-photo:hover {
  opacity: 0.88;
}

.photo-dl-btn {
  position: absolute;
  bottom: 5px;
  right: 5px;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
  z-index: 1;
}
.photo-item:hover .photo-dl-btn {
  opacity: 1;
}
.photo-dl-btn:hover {
  background: rgba(37, 99, 235, 0.85);
}
.photo-dl-btn .el-icon { font-size: 13px; }

/* ── 故障照片 Viewer ─────────────────────────────────────────────────────── */
:deep(.photo-viewer-dialog .el-dialog__header) {
  background: #ffffff;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  margin: 0;
}
:deep(.photo-viewer-dialog .el-dialog__body) {
  padding: 0;
  background: #f3f4f6;
}
:deep(.photo-viewer-dialog .el-dialog__footer) {
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  padding: 10px 16px;
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.viewer-counter {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.viewer-counter .el-icon { color: #2563eb; }

.viewer-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: min(65vh, 600px);
  background: #f3f4f6;
  overflow: hidden;
  user-select: none;
}

.viewer-img-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.viewer-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.18s ease;
  cursor: zoom-in;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}
.viewer-img:active { cursor: grabbing; }

/* 左右切換箭頭：深色、醒目 */
.viewer-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #1f2937;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  transition: background 0.15s, transform 0.15s;
}
.viewer-arrow:hover {
  background: #111827;
  transform: translateY(-50%) scale(1.08);
}
.viewer-arrow-prev { left: 14px; }
.viewer-arrow-next { right: 14px; }

/* 工具列 */
.viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.viewer-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}
.viewer-btn-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.viewer-divider {
  width: 1px;
  height: 20px;
  background: #e5e7eb;
  margin: 0 4px;
}
.viewer-zoom-label {
  min-width: 46px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}
.viewer-zoom-label:hover { color: #2563eb; }
</style>
