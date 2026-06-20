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

    <template v-else-if="!actorGroups.length">
      <div class="flex-1 flex items-center justify-center">
        <div class="text-gray-500">暂无人脸记录</div>
      </div>
    </template>

    <div v-else class="flex flex-col gap-3 flex-1 overflow-y-auto min-h-0">
      <div class="text-sm text-gray-400 shrink-0">
        共 <span class="text-gray-200 font-medium">{{ actorGroups.length }}</span> 位演员，<span class="text-gray-200 font-medium">{{ totalRecords }}</span> 条记录
      </div>

      <div
        v-for="group in actorGroups"
        :key="group.actor_id"
        class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"
      >
        <div
          @click="toggleActor(group.actor_id)"
          class="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-700/50 transition-colors select-none"
        >
          <img
            v-if="group.image_blob"
            :src="`data:image/jpeg;base64,${group.image_blob}`"
            class="w-10 h-10 object-cover rounded shrink-0"
          />
          <div v-else class="w-10 h-10 rounded shrink-0 bg-gray-700 flex items-center justify-center text-xs text-gray-400">?</div>
          <div class="flex-1 min-w-0">
            <span class="text-sm font-medium text-gray-200">{{ group.name || `演员 #${group.actor_id}` }}</span>
            <span class="text-xs text-gray-500 ml-2">{{ group.records.length }} 部视频</span>
          </div>
          <span class="text-xs text-gray-500 transition-transform" :class="expandedActors.has(group.actor_id) ? 'rotate-180' : ''">
            ▼
          </span>
        </div>

        <div v-if="expandedActors.has(group.actor_id)" class="border-t border-gray-700">
          <div
            v-for="record in group.records"
            :key="record.id"
            class="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700/30 border-b border-gray-700/50 last:border-none"
          >
            <div class="flex-1 min-w-0">
              <div class="text-xs text-gray-300 truncate" :title="record.video_path">
                {{ record.video_path || '-' }}
              </div>
            </div>
            <button
              @click="deleteRecord(group.actor_id, record.id)"
              class="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors shrink-0"
            >
              删除
            </button>
          </div>
        </div>
      </div>
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
            <div class="text-xs text-gray-500 mt-0.5">演员 #{{ r.actor_id }} | ID: {{ r.id }}</div>
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
import { ref, onMounted } from 'vue'
import { getAllActorsWithRecords, deleteRecord as deleteRecordApi, fileExists } from '../lib/api'
import type { ActorGroup } from '../lib/types'

const actorGroups = ref<ActorGroup[]>([])
const loading = ref(false)
const error = ref('')
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const showCleanupDialog = ref(false)
const invalidRecords = ref<{ id: number; video_path: string; actor_id: number }[]>([])
const cleaning = ref(false)
const expandedActors = ref(new Set<number>())

const totalRecords = ref(0)

onMounted(() => {
  loadRecords()
})

async function loadRecords() {
  loading.value = true
  error.value = ''
  try {
    const data = await getAllActorsWithRecords()
    actorGroups.value = data
    totalRecords.value = data.reduce((sum, g) => sum + g.records.length, 0)
  } catch (e: any) {
    error.value = '加载失败: ' + e.message
  } finally {
    loading.value = false
  }
}

function toggleActor(actorId: number) {
  const s = new Set(expandedActors.value)
  if (s.has(actorId)) {
    s.delete(actorId)
  } else {
    s.add(actorId)
  }
  expandedActors.value = s
}

async function deleteRecord(actorId: number, recordId: number) {
  const group = actorGroups.value.find(g => g.actor_id === actorId)
  const record = group?.records.find(r => r.id === recordId)
  if (!record) return
  if (!confirm(`确定要删除此记录吗？（视频: ${record.video_path || '-'}）`)) return
  try {
    await deleteRecordApi(recordId)
    const g = actorGroups.value.find(g => g.actor_id === actorId)
    if (g) {
      g.records = g.records.filter(r => r.id !== recordId)
      if (g.records.length === 0) {
        actorGroups.value = actorGroups.value.filter(g => g.actor_id !== actorId)
      }
    }
    totalRecords.value = actorGroups.value.reduce((sum, g) => sum + g.records.length, 0)
    showMessage('删除成功', 'success')
  } catch (e: any) {
    showMessage('删除失败: ' + e.message, 'error')
  }
}

async function checkInvalidRecords() {
  try {
    const groups = await getAllActorsWithRecords()
    const invalid: { id: number; video_path: string; actor_id: number }[] = []
    for (const g of groups) {
      for (const r of g.records) {
        if (!r.video_path) continue
        const exists = await fileExists(r.video_path)
        if (!exists) invalid.push({ id: r.id, video_path: r.video_path, actor_id: g.actor_id })
      }
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
    await loadRecords()
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
