<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">{{ t('nav.assets') }}</h1>
        <p class="page-sub">查詢資產狀態，對正常使用中的資產提出維修申請</p>
      </div>
    </div>

    <!-- Stat cards -->
    <div class="stat-row">
      <div v-for="s in stats" :key="s.label" class="stat-card" :style="`--accent:${s.color}`">
        <div class="stat-value">{{ s.value }}</div>
        <div class="stat-label">{{ s.label }}</div>
        <div class="stat-bar" />
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <el-input
        v-model="filters.name"
        :placeholder="t('asset.name')"
        clearable
        :prefix-icon="Search"
        class="filter-input"
        @input="debouncedFetch"
      />
      <el-input
        v-model="filters.serialNo"
        :placeholder="t('asset.serialNo')"
        clearable
        @input="debouncedFetch"
      />
      <el-select v-model="filters.category" :placeholder="t('asset.category')" clearable @change="fetchAssets">
        <el-option v-for="c in categories" :key="c" :value="c" :label="c" />
      </el-select>
      <el-select v-model="filters.status" :placeholder="t('asset.status')" clearable @change="fetchAssets">
        <el-option v-for="(label, key) in statusMap" :key="key" :value="key" :label="label" />
      </el-select>
      <el-input
        v-model="filters.location"
        :placeholder="t('asset.location')"
        clearable
        @input="debouncedFetch"
      />
      <el-button @click="resetFilters">{{ t('common.cancel') }}</el-button>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <el-table v-loading="loading" :data="assets" row-key="id" style="width:100%">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-panel">
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item :label="t('asset.model')">{{ row.model ?? '—' }}</el-descriptions-item>
                <el-descriptions-item :label="t('asset.spec')">{{ row.spec ?? '—' }}</el-descriptions-item>
                <el-descriptions-item :label="t('asset.supplier')">{{ row.supplier ?? '—' }}</el-descriptions-item>
                <el-descriptions-item :label="t('asset.assignedDept')">{{ row.assignedDept ?? '—' }}</el-descriptions-item>
                <el-descriptions-item :label="t('asset.warrantyExpiry')">{{ formatDate(row.warrantyExpiry) }}</el-descriptions-item>
                <el-descriptions-item :label="t('asset.description')">{{ row.description ?? '—' }}</el-descriptions-item>
              </el-descriptions>
            </div>
          </template>
        </el-table-column>

        <el-table-column :label="t('asset.name')" prop="name" min-width="180">
          <template #default="{ row }">
            <span class="asset-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('asset.serialNo')" prop="serialNo" width="140" />
        <el-table-column :label="t('asset.category')" prop="category" width="110">
          <template #default="{ row }">
            <span class="category-tag">{{ row.category }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('asset.location')" prop="location" width="130" />
        <el-table-column :label="t('asset.status')" width="110">
          <template #default="{ row }">
            <StatusBadge :status="row.status" :label="statusMap[row.status as AssetStatus]" />
          </template>
        </el-table-column>
        <el-table-column width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              type="warning"
              size="small"
              :disabled="row.status !== 'AVAILABLE'"
              round
              @click="openRepairDialog(row)"
            >
              提交維修
            </el-button>
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
          @change="fetchAssets"
        />
      </div>
    </div>

    <!-- 維修申請 Dialog -->
    <el-dialog
      v-model="repairVisible"
      :title="`提交維修申請：${selectedAsset?.name ?? ''}`"
      width="520px"
      destroy-on-close
    >
      <el-form ref="repairFormRef" :model="repairForm" :rules="repairRules" label-width="100px" class="dialog-form">
        <el-form-item :label="t('asset.name')">
          <span class="form-readonly">{{ selectedAsset?.name }}</span>
          <span class="form-serial">&nbsp;（{{ selectedAsset?.serialNo }}）</span>
        </el-form-item>
        <el-form-item :label="t('application.faultDescription')" prop="faultDescription">
          <el-input
            v-model="repairForm.faultDescription"
            type="textarea"
            :rows="4"
            placeholder="請詳細描述故障情況、出現時間及影響範圍"
          />
        </el-form-item>
        <el-form-item label="故障圖片">
          <ImageUploader v-model="repairForm.imageUrls" :max-files="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="repairVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="repairLoading" @click="submitRepair">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { assetApi } from '@/apis/asset'
import { applicationApi } from '@/apis/application'
import StatusBadge from '@/components/StatusBadge.vue'
import ImageUploader from '@/components/ImageUploader.vue'

type AssetStatus = 'AVAILABLE' | 'IN_REPAIR' | 'RETIRED'

interface Asset {
  id: string
  name: string
  serialNo: string
  category: string
  model: string | null
  spec: string | null
  supplier: string | null
  location: string
  assignedDept: string | null
  warrantyExpiry: string | null
  status: AssetStatus
  description: string | null
}

const { t } = useI18n()
const loading  = ref(false)
const assets   = ref<Asset[]>([])
const total    = ref(0)
const page     = ref(1)
const pageSize = ref(10)
const filters  = reactive({ name: '', serialNo: '', category: '', status: '', location: '' })
const categories = ['IT設備', '辦公設備', '實驗器材', '交通工具', 'HIGH_VALUE', '其他']

const statusMap = computed<Record<AssetStatus, string>>(() => ({
  AVAILABLE: t('asset.statusMap.AVAILABLE'),
  IN_REPAIR: t('asset.statusMap.IN_REPAIR'),
  RETIRED:   t('asset.statusMap.RETIRED'),
}))

const stats = computed(() => {
  const c = { AVAILABLE: 0, IN_REPAIR: 0, RETIRED: 0 }
  assets.value.forEach(a => { if (a.status in c) c[a.status as AssetStatus]++ })
  return [
    { label: '正常使用', value: c.AVAILABLE, color: '#12b76a' },
    { label: '維修中',   value: c.IN_REPAIR, color: '#f79009' },
    { label: '已報廢',   value: c.RETIRED,   color: '#9ca3af' },
  ]
})

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('zh-TW')
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedFetch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fetchAssets, 300)
}

async function fetchAssets() {
  loading.value = true
  try {
    const res = await assetApi.list({
      name:     filters.name     || undefined,
      serialNo: filters.serialNo || undefined,
      category: filters.category || undefined,
      status:   filters.status   || undefined,
      location: filters.location || undefined,
      page: page.value,
      limit: pageSize.value,
    })
    assets.value = res.data.data ?? []
    total.value  = res.data.total ?? 0
  } catch { ElMessage.error(t('common.error')) }
  finally { loading.value = false }
}

function resetFilters() {
  Object.assign(filters, { name: '', serialNo: '', category: '', status: '', location: '' })
  page.value = 1
  fetchAssets()
}

// ─── 維修申請 ──────────────────────────────────────────────────────────────
const repairVisible  = ref(false)
const repairLoading  = ref(false)
const repairFormRef  = ref<FormInstance>()
const selectedAsset  = ref<Asset | null>(null)
const repairForm     = reactive({ faultDescription: '', imageUrls: [] as string[] })

const repairRules: FormRules = {
  faultDescription: [{ required: true, min: 5, message: '故障描述至少 5 個字', trigger: 'blur' }],
}

function openRepairDialog(asset: Asset) {
  selectedAsset.value = asset
  repairForm.faultDescription = ''
  repairForm.imageUrls = []
  repairVisible.value = true
}

async function submitRepair() {
  const valid = await repairFormRef.value?.validate().catch(() => false)
  if (!valid || !selectedAsset.value) return
  repairLoading.value = true
  try {
    await applicationApi.create({
      assetId:          selectedAsset.value.id,
      faultDescription: repairForm.faultDescription,
      imageUrls:        repairForm.imageUrls,
    })
    ElMessage.success('維修申請已提交，等待管理員審核')
    repairVisible.value = false
    fetchAssets()
  } catch { ElMessage.error(t('common.error')) }
  finally { repairLoading.value = false }
}

onMounted(fetchAssets)
</script>

<style scoped>
.page { padding: 24px; display: flex; flex-direction: column; gap: 20px; }

.page-head { display: flex; align-items: flex-start; justify-content: space-between; }
.page-title { font-size: 22px; font-weight: 700; color: var(--c-text-1); letter-spacing: -0.4px; margin-bottom: 2px; }
.page-sub { font-size: 13px; color: var(--c-text-3); }

/* Stats */
.stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.stat-card {
  background: var(--c-surface);
  border-radius: var(--r-md);
  padding: 16px 20px 14px;
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-xs);
  position: relative;
  overflow: hidden;
}
.stat-bar {
  position: absolute;
  top: 0; left: 0;
  width: 4px; height: 100%;
  background: var(--accent);
  border-radius: 4px 0 0 4px;
}
.stat-value { font-size: 28px; font-weight: 700; color: var(--accent); line-height: 1; margin-bottom: 4px; }
.stat-label { font-size: 12px; font-weight: 600; color: var(--c-text-3); letter-spacing: 0.3px; text-transform: uppercase; }

/* Filter */
.filter-bar {
  display: flex; gap: 10px; align-items: center;
  background: var(--c-surface);
  padding: 14px 16px;
  border-radius: var(--r-md);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-xs);
  flex-wrap: wrap;
}
.filter-input { flex: 1.5; min-width: 140px; }

/* Table */
.table-wrap {
  background: var(--c-surface);
  border-radius: var(--r-md);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.expand-panel { padding: 12px 32px; background: #fafbff; }

.asset-name { font-weight: 600; color: var(--c-text-1); }
.category-tag {
  display: inline-block; padding: 2px 8px;
  border-radius: var(--r-pill);
  background: var(--c-info-soft); color: var(--c-info);
  font-size: 12px; font-weight: 600;
}

.table-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--c-border-light);
  background: #fafafa;
}
.total-hint { font-size: 13px; color: var(--c-text-3); }

.dialog-form { padding: 8px 0; }
.form-readonly { font-weight: 600; color: var(--c-text-1); }
.form-serial { color: var(--c-text-3); font-size: 13px; }
</style>
