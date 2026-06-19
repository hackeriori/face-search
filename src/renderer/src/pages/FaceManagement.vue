<template>
  <div class="flex flex-col h-full p-4 gap-4">
    <div class="flex items-center justify-between shrink-0">
      <h2 class="text-lg font-medium text-gray-200">人脸管理</h2>
      <button
        @click="loadRecords"
        class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
        :disabled="loading"
      >
        {{ loading ? '加载中...' : '刷新' }}
      </button>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAllRecords, deleteRecord as deleteRecordApi } from '../lib/api'
import type { FaceRecord } from '../lib/types'

const PAGE_SIZE = 15

const records = ref<FaceRecord[]>([])
const loading = ref(false)
const error = ref('')
const currentPage = ref(1)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

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

function showMessage(msg: string, type: 'success' | 'error') {
  message.value = msg
  messageType.value = type
  setTimeout(() => { message.value = '' }, 3000)
}
</script>
