<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">資產管理</h1>
        <p class="page-sub">新增、編輯與停用資產</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">新增資產</el-button>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <el-input
        v-model="filters.name"
        placeholder="資產名稱"
        clearable
        :prefix-icon="Search"
        class="filter-input"
        @input="debouncedFetch"
      />
      <el-input
        v-model="filters.serialNo"
        placeholder="序號"
        clearable
        @input="debouncedFetch"
      />
      <el-select v-model="filters.category" placeholder="類別" clearable @change="fetchAssets">
        <el-option v-for="c in categories" :key="c" :value="c" :label="c" />
      </el-select>
      <el-select v-model="filters.status" :placeholder="t('asset.status')" clearable @change="fetchAssets">
        <el-option v-for="(label, key) in statusMap" :key="key" :value="key" :label="label" />
      </el-select>
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
                <el-descriptions-item :label="t('asset.purchaseDate')">{{ formatDate(row.purchaseDate) }}</el-descriptions-item>
                <el-descriptions-item :label="t('asset.purchaseCost')">{{ row.purchaseCost != null ? `NT$ ${row.purchaseCost.toLocaleString()}` : '—' }}</el-descriptions-item>
                <el-descriptions-item :label="t('asset.assignedDept')">{{ row.assignedDept ?? '—' }}</el-descriptions-item>
                <el-descriptions-item :label="t('asset.startDate')">{{ formatDate(row.startDate) }}</el-descriptions-item>
                <el-descriptions-item :label="t('asset.warrantyExpiry')">
                  <span :class="{ 'warranty-expired': isWarrantyExpired(row.warrantyExpiry) }">
                    {{ formatDate(row.warrantyExpiry) }}
                    <el-tag v-if="isWarrantyExpired(row.warrantyExpiry)" type="danger" size="small" style="margin-left:4px">已過期</el-tag>
                  </span>
                </el-descriptions-item>
                <el-descriptions-item :label="t('asset.description')" :span="3">{{ row.description ?? '—' }}</el-descriptions-item>
              </el-descriptions>
              <div v-if="row.imageUrls && row.imageUrls.length > 0" class="asset-images">
                <div class="asset-images-label">資產圖片</div>
                <div class="asset-images-grid">
                  <el-image
                    v-for="url in row.imageUrls"
                    :key="url"
                    :src="url"
                    :preview-src-list="row.imageUrls"
                    fit="cover"
                    class="asset-thumb"
                  />
                </div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column :label="t('asset.name')" prop="name" min-width="160">
          <template #default="{ row }">
            <span class="asset-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('asset.serialNo')" prop="serialNo" width="130" />
        <el-table-column :label="t('asset.category')" width="110">
          <template #default="{ row }">
            <span class="category-tag">{{ row.category }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('asset.location')" prop="location" width="120" />
        <el-table-column :label="t('asset.assignedDept')" prop="assignedDept" width="110">
          <template #default="{ row }">{{ row.assignedDept ?? '—' }}</template>
        </el-table-column>
        <el-table-column :label="t('asset.status')" width="110">
          <template #default="{ row }">
            <StatusBadge :status="row.status" :label="statusMap[row.status as AssetStatus]" />
          </template>
        </el-table-column>
        <el-table-column :label="t('asset.warrantyExpiry')" width="120">
          <template #default="{ row }">
            <span :class="{ 'warranty-expired': isWarrantyExpired(row.warrantyExpiry) }">
              {{ formatDate(row.warrantyExpiry) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column width="110" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button size="small" :icon="Edit" circle plain @click="openEditDialog(row)" />
              <el-button size="small" type="danger" :icon="Delete" circle plain @click="handleDelete(row)" />
            </div>
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

    <!-- Create / Edit dialog -->
    <el-dialog
      v-model="formVisible"
      :title="editingId ? '編輯資產' : '新增資產'"
      width="680px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="dialog-form">
        <el-divider content-position="left">基本資訊</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('asset.name')" prop="name">
              <el-input v-model="form.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('asset.serialNo')" prop="serialNo">
              <el-input v-model="form.serialNo" :disabled="!!editingId" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('asset.category')" prop="category">
              <el-select v-model="form.category" style="width:100%">
                <el-option v-for="c in categories" :key="c" :value="c" :label="c" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('asset.model')">
              <el-input v-model="form.model" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="t('asset.spec')">
              <el-input v-model="form.spec" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">採購資訊</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('asset.supplier')">
              <el-input v-model="form.supplier" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('asset.purchaseCost')">
              <el-input-number v-model="form.purchaseCost" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('asset.purchaseDate')">
              <el-date-picker v-model="form.purchaseDate" type="date" style="width:100%" value-format="YYYY-MM-DDTHH:mm:ss.000Z" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('asset.warrantyExpiry')">
              <el-date-picker v-model="form.warrantyExpiry" type="date" style="width:100%" value-format="YYYY-MM-DDTHH:mm:ss.000Z" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">部署資訊</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('asset.location')" prop="location">
              <el-input v-model="form.location" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('asset.assignedDept')">
              <el-input v-model="form.assignedDept" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('asset.startDate')">
              <el-date-picker v-model="form.startDate" type="date" style="width:100%" value-format="YYYY-MM-DDTHH:mm:ss.000Z" />
            </el-form-item>
          </el-col>
          <el-col v-if="editingId" :span="12">
            <el-form-item :label="t('asset.status')">
              <el-select v-model="form.status" style="width:100%">
                <el-option v-for="(label, key) in statusMap" :key="key" :value="key" :label="label" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item :label="t('asset.description')">
              <el-input v-model="form.description" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">資產圖片</el-divider>
        <el-form-item label-width="0">
          <ImageUploader v-model="form.imageUrls" :max-files="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="formLoading" @click="submitForm">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Search, Edit, Delete } from '@element-plus/icons-vue'
import { assetApi } from '@/apis/asset'
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
  purchaseDate: string | null
  purchaseCost: number | null
  location: string
  assignedDept: string | null
  startDate: string | null
  warrantyExpiry: string | null
  status: AssetStatus
  holderId: string | null
  description: string | null
  imageUrls: string[]
}

const { t } = useI18n()
const loading  = ref(false)
const assets   = ref<Asset[]>([])
const total    = ref(0)
const page     = ref(1)
const pageSize = ref(10)
const filters  = reactive({ name: '', serialNo: '', category: '', status: '' })
const categories = ['IT設備', '辦公設備', '實驗器材', '交通工具', 'HIGH_VALUE', '其他']

const statusMap = computed<Record<AssetStatus, string>>(() => ({
  AVAILABLE: t('asset.statusMap.AVAILABLE'),
  IN_REPAIR: t('asset.statusMap.IN_REPAIR'),
  RETIRED:   t('asset.statusMap.RETIRED'),
}))

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('zh-TW')
}

function isWarrantyExpired(d: string | null | undefined): boolean {
  if (!d) return false
  return new Date(d) < new Date()
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
      page: page.value,
      limit: pageSize.value,
    })
    assets.value = res.data.data ?? []
    total.value  = res.data.total ?? 0
  } catch { ElMessage.error(t('common.error')) }
  finally { loading.value = false }
}

function resetFilters() {
  Object.assign(filters, { name: '', serialNo: '', category: '', status: '' })
  page.value = 1
  fetchAssets()
}

// ─── Form ────────────────────────────────────────────────────────────────────
const formVisible = ref(false)
const formLoading = ref(false)
const formRef     = ref<FormInstance>()
const editingId   = ref<string | null>(null)
const form = reactive({
  name: '', serialNo: '', category: '', model: '', spec: '',
  supplier: '', purchaseCost: undefined as number | undefined,
  purchaseDate: '' as string, warrantyExpiry: '' as string,
  location: '', assignedDept: '', startDate: '' as string,
  status: 'AVAILABLE' as AssetStatus, description: '',
  imageUrls: [] as string[],
})

const rules: FormRules = {
  name:     [{ required: true, trigger: 'blur' }],
  serialNo: [{ required: true, trigger: 'blur' }],
  category: [{ required: true, trigger: 'change' }],
  location: [{ required: true, trigger: 'blur' }],
}

function openCreateDialog() {
  editingId.value = null
  Object.assign(form, {
    name: '', serialNo: '', category: '', model: '', spec: '',
    supplier: '', purchaseCost: undefined,
    purchaseDate: '', warrantyExpiry: '',
    location: '', assignedDept: '', startDate: '',
    status: 'AVAILABLE', description: '', imageUrls: [],
  })
  formVisible.value = true
}

function openEditDialog(asset: Asset) {
  editingId.value = asset.id
  Object.assign(form, {
    ...asset,
    model:          asset.model         ?? '',
    spec:           asset.spec          ?? '',
    supplier:       asset.supplier      ?? '',
    purchaseCost:   asset.purchaseCost  ?? undefined,
    purchaseDate:   asset.purchaseDate  ?? '',
    warrantyExpiry: asset.warrantyExpiry ?? '',
    assignedDept:   asset.assignedDept  ?? '',
    startDate:      asset.startDate     ?? '',
    description:    asset.description   ?? '',
    imageUrls:      asset.imageUrls     ?? [],
  })
  formVisible.value = true
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  formLoading.value = true
  try {
    const payload = {
      name:           form.name,
      serialNo:       form.serialNo,
      category:       form.category,
      model:          form.model || undefined,
      spec:           form.spec || undefined,
      supplier:       form.supplier || undefined,
      purchaseCost:   form.purchaseCost,
      purchaseDate:   form.purchaseDate || undefined,
      warrantyExpiry: form.warrantyExpiry || undefined,
      location:       form.location,
      assignedDept:   form.assignedDept || undefined,
      startDate:      form.startDate || undefined,
      status:         editingId.value ? form.status : undefined,
      description:    form.description || undefined,
      imageUrls:      form.imageUrls,
    }
    if (editingId.value) {
      await assetApi.update(editingId.value, payload)
    } else {
      await assetApi.create(payload)
    }
    ElMessage.success(t('common.success'))
    formVisible.value = false
    fetchAssets()
  } catch { ElMessage.error(t('common.error')) }
  finally { formLoading.value = false }
}

async function handleDelete(asset: Asset) {
  await ElMessageBox.confirm(`確認將「${asset.name}」標記為報廢？`, t('common.delete'), { type: 'warning' })
  try {
    await assetApi.remove(asset.id)
    ElMessage.success(t('common.success'))
    fetchAssets()
  } catch { ElMessage.error(t('common.error')) }
}

onMounted(fetchAssets)
</script>

<style scoped>
.page { padding: 24px; display: flex; flex-direction: column; gap: 20px; }

.page-head { display: flex; align-items: flex-start; justify-content: space-between; }
.page-title { font-size: 22px; font-weight: 700; color: var(--c-text-1); letter-spacing: -0.4px; margin-bottom: 2px; }
.page-sub { font-size: 13px; color: var(--c-text-3); }

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

.table-wrap {
  background: var(--c-surface);
  border-radius: var(--r-md);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.expand-panel { padding: 12px 24px; background: #fafbff; display: flex; flex-direction: column; gap: 12px; }

.asset-images-label { font-size: 12px; font-weight: 600; color: var(--c-text-3); margin-bottom: 6px; }
.asset-images-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.asset-thumb { width: 80px; height: 80px; border-radius: 6px; object-fit: cover; cursor: pointer; border: 1px solid var(--c-border); }

.asset-name { font-weight: 600; color: var(--c-text-1); }

.category-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--r-pill);
  background: var(--c-info-soft);
  color: var(--c-info);
  font-size: 12px;
  font-weight: 600;
}

.warranty-expired { color: var(--el-color-danger); }

.row-actions { display: flex; gap: 6px; align-items: center; }

.table-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--c-border-light);
  background: #fafafa;
}
.total-hint { font-size: 13px; color: var(--c-text-3); }
.dialog-form { padding: 4px 0; }
</style>
