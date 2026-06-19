<template>
  <div class="flex flex-col h-full p-4 gap-4">
    <div class="flex items-center justify-between shrink-0">
      <h2 class="text-lg font-medium text-gray-200">人脸管理</h2>
      <div class="flex items-center gap-2">
        <button
          @click="checkInvalidRecords"
          class="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 rounded text-sm transition-colors"
        >
          清理
        </button>
        <button
          @click="loadRecords"
          class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
          :disabled="loading"
        >
          {{ loading ? '加载中...' : '刷新' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-gray-400">加载中...</div>
    </div>

    <template v-else-if="error">
      <div class="flex-1 flex items-center justify-center">
        <div class="text-red-400">{{ error }}</div>
      </div>
    </template>

    <template v-else-if="!records.length">
      <div class="flex-1 flex items-center justify-center">
        <div class="text-gray-500">暂无人脸记录</div>
      </div>
    </template>

    <div v-else class="flex-1 overflow-y-auto min-h-0">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-gray-900 z-10">
          <tr class="text-gray-400 border-b border-gray-700">
            <th class="text-left py-2 px-2 w-16">图片</th>
            <th class="text-left py-2 px-2">视频路径</th>
            <th class="text-left py-2 px-2 w-24">置信度</th>
            <th class="text-left py-2 px-2 w-32">录入时间</th>
            <th class="text-left py-2 px-2">备注</th>
            <th class="text-center py-2 px-2 w-20">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in pageRecords" :key="record.id" class="border-b border-gray-800 hover:bg-gray-800/50">
            <td class="py-2 px-2">
              <img
                :src="`data:image/jpeg;base64,${record.image_blob}`"
                class="w-12 h-12 object-cover rounded"
              />
            </td>
            <td class="py-2 px-2 text-gray-300 truncate max-w-[200px]" :title="record.video_path">
              {{ record.video_path || '-' }}
            </td>
            <td class="py-2 px-2 text-gray-300">
              {{ (record.face_confidence * 100).toFixed(1) }}%
            </td>
            <td class="py-2 px-2 text-gray-400 text-xs">
              {{ record.created_at }}
            </td>
            <td class="py-2 px-2 text-gray-400 truncate max-w-[150px]" :title="record.note || ''">
              {{ record.note || '-' }}
            </td>
            <td class="py-2 px-2 text-center">
              <button
                @click="deleteRecord(record.id)"
                class="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-center gap-3 shrink-0 py-2">
      <button
        @click="currentPage--"
        :disabled="currentPage <= 1"
        class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-40 transition-colors"
      >
        上一页
      </button>
      <span class="text-sm text-gray-400">
        {{ currentPage }} / {{ totalPages }}
      </span>
      <button
        @click="currentPage++"
        :disabled="currentPage >= totalPages"
        class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-40 transition-colors"
      >
        下一页
      </button>
    </div>

    <div v-if="message" class="fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-sm"
      :class="messageType === 'success' ? 'bg-green-600' : 'bg-red-600'"
    >
      {{ message }}
    </div>

    <div v-if="showCleanupDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showCleanupDialog = false">
      <div class="bg-gray-800 rounded-lg shadow-xl w-[520px] max-h-[80vh] flex flex-col">
        <div class="px-5 py-4 border-b border-gray-700 shrink-0">
          <h3 class="text-base font-medium text-gray-200">无效记录清理</h3>
          <p class="text-sm text-gray-400 mt-1">
            以下 {{ invalidRecords.length }} 条记录对应的文件已不存在，是否删除？
          </p>
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          <div v-for="r in invalidRecords" :key="r.id" class="py-2 border-b border-gray-700/50 last:border-none">
            <div class="text-sm text-gray-300 truncate" :title="r.video_path">{{ r.video_path }}</div>
            <div class="text-xs text-gray-500 mt-0.5">ID: {{ r.id }} | 录入: {{ r.created_at }}</div>
          </div>
        </div>
        <div class="px-5 py-3 border-t border-gray-700 flex items-center justify-end gap-2 shrink-0">
          <button
            @click="showCleanupDialog = false"
            class="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors"
          >
            取消
          </button>
          <button
            @click="confirmCleanup"
            class="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm transition-colors"
            :disabled="cleaning"
          >
            {{ cleaning ? '清理中...' : '确认清理' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAllRecords, deleteRecord as deleteRecordApi, fileExists } from '../lib/api'
import type { FaceRecord } from '../lib/types'

const PAGE_SIZE = 15

const records = ref<FaceRecord[]>([])
const loading = ref(false)
const error = ref('')
const currentPage = ref(1)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const showCleanupDialog = ref(false)
const invalidRecords = ref<FaceRecord[]>([])
const cleaning = ref(false)

const totalPages = computed(() => Math.max(1, Math.ceil(records.value.length / PAGE_SIZE)))

const pageRecords = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return records.value.slice(start, start + PAGE_SIZE)
})

onMounted(() => {
  loadRecords()
})

async function loadRecords() {
  loading.value = true
  error.value = ''
  try {
    records.value = await getAllRecords() as FaceRecord[]
    currentPage.value = 1
  } catch (e: any) {
    error.value = '加载失败: ' + e.message
  } finally {
    loading.value = false
  }
}

async function deleteRecord(id: number) {
  if (!confirm('确定要删除该人脸记录吗？')) return
  try {
    await deleteRecordApi(id)
    records.value = records.value.filter(r => r.id !== id)
    if (pageRecords.value.length === 0 && currentPage.value > 1) {
      currentPage.value--
    }
    showMessage('删除成功', 'success')
  } catch (e: any) {
    showMessage('删除失败: ' + e.message, 'error')
  }
}

async function checkInvalidRecords() {
  try {
    const all = await getAllRecords() as FaceRecord[]
    const invalid: FaceRecord[] = []
    for (const r of all) {
      if (!r.video_path) continue
      const exists = await fileExists(r.video_path)
      if (!exists) invalid.push(r)
    }
    if (invalid.length === 0) {
      showMessage('所有记录对应的文件均存在', 'success')
      return
    }
    invalidRecords.value = invalid
    showCleanupDialog.value = true
  } catch (e: any) {
    showMessage('检查失败: ' + e.message, 'error')
  }
}

async function confirmCleanup() {
  cleaning.value = true
  try {
    let count = 0
    for (const r of invalidRecords.value) {
      await deleteRecordApi(r.id)
      count++
    }
    records.value = records.value.filter(rec => !invalidRecords.value.some(inv => inv.id === rec.id))
    showCleanupDialog.value = false
    showMessage(`已清理 ${count} 条无效记录`, 'success')
  } catch (e: any) {
    showMessage('清理失败: ' + e.message, 'error')
  } finally {
    cleaning.value = false
  }
}

function showMessage(msg: string, type: 'success' | 'error') {
  message.value = msg
  messageType.value = type
  setTimeout(() => { message.value = '' }, 3000)
}
</script>
