<template>
  <div class="image-uploader">
    <!-- Preview grid of already-uploaded URLs -->
    <div v-if="modelValue.length > 0" class="preview-grid">
      <div
        v-for="(url, idx) in modelValue"
        :key="url"
        class="preview-item"
      >
        <img :src="url" alt="uploaded image" class="preview-img" @click="openPreview(url)" />
        <button
          v-if="!readonly"
          type="button"
          class="remove-btn"
          :title="t('uploader.remove')"
          @click="removeUrl(idx)"
        >×</button>
      </div>
    </div>

    <!-- Upload trigger (hidden when readonly or limit reached) -->
    <label
      v-if="!readonly && modelValue.length < maxFiles"
      class="upload-trigger"
      :class="{ 'is-dragging': dragging }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        class="file-input"
        @change="onFileChange"
      />
      <el-icon class="upload-icon"><Upload /></el-icon>
      <span class="upload-hint">
        {{ uploading ? t('uploader.uploading') : t('uploader.hint', { max: maxFiles }) }}
      </span>
    </label>

    <!-- Full-screen preview -->
    <el-image-viewer
      v-if="previewUrl"
      :url-list="[previewUrl]"
      @close="previewUrl = ''"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import { uploadApi } from '@/apis/upload'

interface Props {
  modelValue: string[]
  maxFiles?: number
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxFiles: 5,
  readonly: false,
})

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'update:modelValue', urls: string[]): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const dragging  = ref(false)
const previewUrl = ref('')

function openPreview(url: string) {
  previewUrl.value = url
}

function removeUrl(index: number) {
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}

async function handleFiles(files: FileList | null) {
  if (!files || files.length === 0) return

  const remaining = props.maxFiles - props.modelValue.length
  const toUpload  = Array.from(files).slice(0, remaining)

  if (toUpload.length === 0) {
    ElMessage.warning(t('uploader.limitWarning', { max: props.maxFiles }))
    return
  }

  uploading.value = true
  try {
    const res = await uploadApi.uploadImages(toUpload)
    emit('update:modelValue', [...props.modelValue, ...res.data.urls])
  } catch {
    ElMessage.error(t('uploader.uploadFailed'))
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  handleFiles(input.files)
}

function onDrop(e: DragEvent) {
  dragging.value = false
  handleFiles(e.dataTransfer?.files ?? null)
}
</script>

<style scoped>
.image-uploader {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preview-item {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--c-border, #e5e7eb);
  cursor: pointer;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.2s;
}

.preview-img:hover {
  opacity: 0.85;
}

.remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.15s;
}

.remove-btn:hover {
  background: rgba(220, 38, 38, 0.85);
}

.upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1.5px dashed var(--c-border, #d1d5db);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  background: var(--c-surface-2, #f9fafb);
  transition: border-color 0.2s, background 0.2s;
  min-height: 80px;
}

.upload-trigger:hover,
.upload-trigger.is-dragging {
  border-color: var(--el-color-primary, #409eff);
  background: var(--el-color-primary-light-9, #ecf5ff);
}

.file-input {
  display: none;
}

.upload-icon {
  font-size: 22px;
  color: var(--c-text-3, #9ca3af);
}

.upload-hint {
  font-size: 12px;
  color: var(--c-text-3, #9ca3af);
  text-align: center;
}
</style>
