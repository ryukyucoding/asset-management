<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('nav.applications') }}</h1>
        <p class="page-sub">{{ t('application.pageDesc') }}</p>
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
                <div class="expand-title">{{ t('application.requestInfo') }}</div>
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item :label="t('asset.serialNo')">{{ row.asset?.serialNo ?? '—' }}</el-descriptions-item>
                  <el-descriptions-item :label="t('asset.location')">{{ row.asset?.location ?? '—' }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.faultDescription')" :span="2">
                    <span class="fault-desc">{{ row.faultDescription }}</span>
                  </el-descriptions-item>
                </el-descriptions>
              </div>
              <!-- 故障照片 -->
              <div v-if="row.imageUrls?.length" class="expand-section">
                <div class="expand-title">{{ t('application.faultPhotos') }}</div>
                <div class="photo-grid">
                  <img
                    v-for="(url, idx) in row.imageUrls"
                    :key="url"
                    :src="url"
                    class="fault-photo"
                    :alt="t('application.faultPhotos')"
                    @click="openViewer(row.imageUrls, idx)"
                  />
                </div>
              </div>
              <!-- 維修進度（IN_REPAIR / COMPLETED） -->
              <div v-if="row.status === 'IN_REPAIR' || row.status === 'COMPLETED'" class="expand-section">
                <div class="expand-title">{{ t('application.repairProgress') }}</div>
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item :label="t('application.repairDate')">{{ formatDate(row.repairDate) }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.repairVendor')">{{ row.repairVendor ?? t('application.pendingText') }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.repairContent')" :span="2">{{ row.repairContent ?? t('application.pendingText') }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.repairSolution')" :span="2">{{ row.repairSolution ?? t('application.pendingText') }}</el-descriptions-item>
                  <el-descriptions-item :label="t('application.repairCost')">
                    {{ row.repairCost != null ? `NT$ ${row.repairCost.toLocaleString()}` : t('application.pendingText') }}
                  </el-descriptions-item>
                </el-descriptions>
              </div>
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
            <div class="desc-cell">
              <span class="desc-text">{{ row.faultDescription }}</span>
              <button
                v-if="row.imageUrls?.length"
                type="button"
                class="photo-pill"
                :title="t('application.viewPhotos', { count: row.imageUrls.length })"
                @click.stop="openViewer(row.imageUrls, 0)"
              >
                <el-icon><Camera /></el-icon>
                {{ row.imageUrls.length }}
              </button>
            </div>
          </template>
        </el-table-column>

        <el-table-column :label="t('application.status')" width="130">
          <template #default="{ row }">
            <StatusBadge :status="row.status" :label="statusMap[row.status as AppStatus]" />
          </template>
        </el-table-column>
        <el-table-column :label="t('application.repairVendor')" width="130">
          <template #default="{ row }">
            <span :class="row.repairVendor ? '' : 'text-muted'">{{ row.repairVendor ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('application.createdAt')" width="110">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column :label="t('common.actions')" width="80" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'PENDING'"
              size="small"
              link
              type="primary"
              @click.stop="openEdit(row)"
            >{{ t('common.modify') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <span class="total-hint">{{ t('common.totalCount', { count: total }) }}</span>
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

  <!-- ─── 照片 Viewer ─────────────────────────────────────── -->
  <el-dialog
    v-model="viewerVisible"
    width="min(90vw, 960px)"
    align-center
    :show-close="false"
    class="photo-viewer-dialog"
    @opened="() => { viewerScale = 1; viewerRotate = 0 }"
    @keydown="onViewerKeydown"
  >
    <template #header>
      <div class="viewer-header">
        <span class="viewer-title">{{ t('application.viewerTitle', { current: viewerIndex + 1, total: viewerUrls.length }) }}</span>
        <el-button :icon="Close" circle plain size="small" @click="viewerVisible = false" />
      </div>
    </template>

    <div class="viewer-stage" @wheel.prevent="onViewerWheel">
      <button
        v-if="viewerUrls.length > 1"
        class="viewer-arrow viewer-arrow--left"
        @click="viewerPrev"
      ><el-icon><ArrowLeft /></el-icon></button>

      <div class="viewer-img-wrap">
        <img
          :src="viewerCurrentUrl"
          class="viewer-img"
          :style="{ transform: `scale(${viewerScale}) rotate(${viewerRotate}deg)` }"
          draggable="false"
          :alt="t('application.faultPhotos')"
        />
      </div>

      <button
        v-if="viewerUrls.length > 1"
        class="viewer-arrow viewer-arrow--right"
        @click="viewerNext"
      ><el-icon><ArrowRight /></el-icon></button>
    </div>

    <template #footer>
      <div class="viewer-toolbar">
        <div class="viewer-controls">
          <div class="viewer-btn-group">
            <el-button :icon="RefreshLeft"  circle plain size="small" title="向左旋轉（[）"  @click="viewerRotateLeft" />
            <el-button :icon="RefreshRight" circle plain size="small" title="向右旋轉（]）"  @click="viewerRotateRight" />
          </div>
          <div class="viewer-divider" />
          <div class="viewer-btn-group">
            <el-button :icon="ZoomOut" circle plain size="small" title="縮小（-）" @click="viewerZoomOut" />
            <span class="viewer-zoom-label" title="點擊重置（0）" @click="viewerReset">
              {{ Math.round(viewerScale * 100) }}%
            </span>
            <el-button :icon="ZoomIn"  circle plain size="small" title="放大（+）" @click="viewerZoomIn" />
          </div>
          <div class="viewer-divider" />
          <el-button :icon="Refresh" circle plain size="small" title="重置縮放與旋轉（0）" @click="viewerReset" />
        </div>
        <el-button type="primary" :icon="Download" @click="downloadCurrentPhoto">{{ t('common.download') }}</el-button>
      </div>
    </template>
  </el-dialog>

  <!-- ─── 編輯申請 Dialog ────────────────────────────────── -->
  <el-dialog
    v-model="editVisible"
    :title="t('application.editTitle')"
    width="520px"
    align-center
    destroy-on-close
  >
    <el-form :model="editForm" label-position="top" @submit.prevent>
      <el-form-item :label="t('application.faultDescription')">
        <el-input
          v-model="editForm.faultDescription"
          type="textarea"
          :rows="4"
          :placeholder="t('application.faultDescEditPlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('application.faultPhotos')">
        <ImageUploader v-model="editForm.imageUrls" :max-files="5" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="editVisible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="editLoading" @click="submitEdit">{{ t('common.save') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import {
  Camera, Download, Close,
  ArrowLeft, ArrowRight,
  ZoomIn, ZoomOut,
  RefreshLeft, RefreshRight, Refresh,
} from '@element-plus/icons-vue'
import { applicationApi } from '@/apis/application'
import StatusBadge from '@/components/StatusBadge.vue'
import ImageUploader from '@/components/ImageUploader.vue'

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
  { label: t('application.all'),            value: '' },
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

// ─── Photo viewer ──────────────────────────────────────────
const viewerVisible = ref(false)
const viewerUrls    = ref<string[]>([])
const viewerIndex   = ref(0)
const viewerScale   = ref(1)
const viewerRotate  = ref(0)
const viewerCurrentUrl = computed(() => viewerUrls.value[viewerIndex.value] ?? '')

function openViewer(urls: string[], index = 0) {
  viewerUrls.value   = urls
  viewerIndex.value  = index
  viewerScale.value  = 1
  viewerRotate.value = 0
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

function viewerZoomIn()      { viewerScale.value  = Math.min(5, viewerScale.value + 0.25) }
function viewerZoomOut()     { viewerScale.value  = Math.max(0.25, viewerScale.value - 0.25) }
function viewerRotateLeft()  { viewerRotate.value = (viewerRotate.value - 90 + 360) % 360 }
function viewerRotateRight() { viewerRotate.value = (viewerRotate.value + 90) % 360 }
function viewerReset()       { viewerScale.value  = 1; viewerRotate.value = 0 }

function onViewerWheel(e: WheelEvent) {
  e.deltaY < 0 ? viewerZoomIn() : viewerZoomOut()
}

function onViewerKeydown(e: KeyboardEvent) {
  if      (e.key === 'ArrowLeft')            viewerPrev()
  else if (e.key === 'ArrowRight')           viewerNext()
  else if (e.key === '+' || e.key === '=')   viewerZoomIn()
  else if (e.key === '-')                    viewerZoomOut()
  else if (e.key === '[')                    viewerRotateLeft()
  else if (e.key === ']')                    viewerRotateRight()
  else if (e.key === '0')                    viewerReset()
  else if (e.key === 'Escape')               viewerVisible.value = false
}

async function downloadCurrentPhoto() {
  const url = viewerCurrentUrl.value
  if (!url) return
  const resp = await fetch(url)
  const blob = await resp.blob()
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = url.split('/').pop() ?? 'photo.jpg'
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─── Edit dialog ───────────────────────────────────────────
const editVisible    = ref(false)
const editLoading    = ref(false)
const editTargetId   = ref('')
const editForm       = reactive({ faultDescription: '', imageUrls: [] as string[] })

function openEdit(row: Application) {
  editTargetId.value         = row.id
  editForm.faultDescription  = row.faultDescription
  editForm.imageUrls         = [...(row.imageUrls ?? [])]
  editVisible.value          = true
}

async function submitEdit() {
  if (editForm.faultDescription.trim().length < 5) {
    ElMessage.warning(t('application.faultDescMin'))
    return
  }
  editLoading.value = true
  try {
    await applicationApi.update(editTargetId.value, {
      faultDescription: editForm.faultDescription.trim(),
      imageUrls:        editForm.imageUrls,
    })
    ElMessage.success(t('application.editSuccess'))
    editVisible.value = false
    fetchApplications()
  } catch {
    ElMessage.error(t('application.editError'))
  } finally {
    editLoading.value = false
  }
}
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

.photo-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.fault-photo {
  width: 80px; height: 80px; object-fit: cover;
  border-radius: 6px; border: 1px solid var(--c-border);
  cursor: pointer; transition: opacity 0.15s;
}
.fault-photo:hover { opacity: 0.8; }

.asset-name { font-weight: 600; color: var(--c-text-1); }
.fault-desc { color: var(--c-text-2); }
.text-muted { color: var(--c-text-4, #c0c4cc); }

.desc-cell { display: flex; align-items: center; gap: 6px; }
.desc-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--c-text-2); }

.photo-pill {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 7px;
  background: #eff8ff; color: #175cd3;
  border: 1px solid #b2ddff;
  border-radius: 999px;
  font-size: 11px; font-weight: 600;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: background 0.15s;
}
.photo-pill:hover { background: #d1e9ff; }

.table-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--c-border-light);
  background: #fafafa;
}
.total-hint { font-size: 13px; color: var(--c-text-3); }

/* ─── Photo Viewer ─── */
:deep(.photo-viewer-dialog .el-dialog__header) {
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  margin: 0;
}
:deep(.photo-viewer-dialog .el-dialog__body) {
  padding: 0;
  background: #f3f4f6;
}
:deep(.photo-viewer-dialog .el-dialog__footer) {
  padding: 10px 16px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
}

.viewer-header {
  display: flex; align-items: center; justify-content: space-between;
}
.viewer-title { font-size: 14px; font-weight: 600; color: #111827; }

.viewer-stage {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  min-height: 420px; max-height: 70vh;
  overflow: hidden;
  background: #f3f4f6;
}

.viewer-img-wrap {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%;
}

.viewer-img {
  max-width: 100%; max-height: 68vh;
  object-fit: contain;
  transition: transform 0.2s ease;
  user-select: none;
}

.viewer-arrow {
  position: absolute; top: 50%; transform: translateY(-50%);
  z-index: 10;
  width: 40px; height: 40px;
  border: none; border-radius: 50%;
  background: rgba(17, 24, 39, 0.75);
  color: #fff; font-size: 18px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.15s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.viewer-arrow:hover { background: rgba(17, 24, 39, 0.95); }
.viewer-arrow--left  { left: 12px; }
.viewer-arrow--right { right: 12px; }

.viewer-toolbar {
  display: flex; align-items: center; justify-content: space-between;
}
.viewer-controls { display: flex; align-items: center; gap: 8px; }
.viewer-btn-group { display: flex; align-items: center; gap: 4px; }
.viewer-divider { width: 1px; height: 20px; background: #e5e7eb; margin: 0 4px; }
.viewer-zoom-label {
  min-width: 44px; text-align: center;
  font-size: 12px; font-weight: 600; color: #374151;
  cursor: pointer; user-select: none;
}
.viewer-zoom-label:hover { color: var(--c-primary); }
</style>
