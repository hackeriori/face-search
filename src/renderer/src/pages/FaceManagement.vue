<template>
  <div class="flex flex-col h-full p-4 gap-4">
    <div class="flex items-center gap-3 shrink-0">
      <h2 class="text-lg font-medium text-gray-200 shrink-0">人脸管理</h2>
      <div class="relative flex-1 max-w-xs">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索演员名或视频路径..."
          class="w-full px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-gray-500 transition-colors"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-sm leading-none"
        >
          ✕
        </button>
      </div>
      <div class="flex items-center gap-2 shrink-0">
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

    <div v-else class="flex flex-col gap-3 flex-1 min-h-0">
      <template v-if="!filteredActorGroups.length">
        <div class="flex-1 flex items-center justify-center">
          <div class="text-gray-500">无匹配结果</div>
        </div>
      </template>

      <template v-else>
        <div class="text-sm text-gray-400 shrink-0">
          共 <span class="text-gray-200 font-medium">{{ filteredActorGroups.length }}</span> 位演员，<span class="text-gray-200 font-medium">{{ totalVideos }}</span> 部视频
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
          <div
            v-for="group in filteredActorGroups"
            :key="group.actor_id"
          class="bg-gray-800 rounded-lg border border-gray-700"
        >
          <div
            @click="toggleActor(group.actor_id)"
            class="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-700/50 transition-colors select-none"
          >
            <img
              v-if="group.image_blob"
              :src="`data:image/jpeg;base64,${group.image_blob}`"
              class="w-10 h-10 object-cover rounded shrink-0 cursor-pointer border border-gray-600"
              @click.stop="previewImage(`data:image/jpeg;base64,${group.image_blob}`)"
            />
            <div v-else class="w-10 h-10 rounded shrink-0 bg-gray-700 flex items-center justify-center text-xs text-gray-400">?</div>
            <div class="flex-1 min-w-0">
              <span class="text-sm font-medium text-gray-200">{{ group.name || `演员 #${group.actor_id}` }}</span>
              <span class="text-xs text-gray-500 ml-2">{{ group.records.length }} 部视频</span>
              <span class="text-xs text-gray-500 ml-2">| {{ group.created_at || '' }}</span>
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
              <div class="flex-1 min-w-0 flex items-center gap-2">
                <span class="text-xs text-gray-400 shrink-0">视频：</span>
                <button @click="openVideo(record.video_path)" class="text-xs text-blue-400 hover:text-blue-300 truncate min-w-0 text-left">
                  {{ record.video_path || '-' }}
                </button>
                <span class="text-xs text-gray-500 shrink-0 ml-auto">{{ record.created_at || '' }}</span>
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
      </template>

    </div>

    <div v-if="message" class="fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-sm"
      :class="messageType === 'success' ? 'bg-green-600' : 'bg-red-600'"
    >
      {{ message }}
    </div>

    <div v-if="previewImg" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80" @click.self="previewImg = ''">
      <img alt="actor" :src="previewImg" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
    </div>

    <div v-if="showCleanupDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showCleanupDialog = false">
      <div class="bg-gray-800 rounded-lg shadow-xl w-[520px] max-h-[80vh] flex flex-col">
        <div class="px-5 py-4 border-b border-gray-700 shrink-0">
          <h3 class="text-base font-medium text-gray-200">无效视频清理</h3>
          <p class="text-sm text-gray-400 mt-1">
            以下 {{ invalidRecords.length }} 个视频文件已不存在，将删除视频记录及关联的人脸记录，并清理名下无记录的演员，是否继续？
          </p>
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-3 min-h-0">
             <div v-for="r in invalidRecords" :key="r.video_id" class="py-2 border-b border-gray-700/50 last:border-none">
            <div class="text-sm text-gray-300 truncate" :title="r.video_path">{{ r.video_path }}</div>
            <div class="text-xs text-gray-500 mt-0.5">视频 ID: {{ r.video_id }}</div>
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
import { getAllActorsWithRecords, deleteRecord as deleteRecordApi, deleteVideo, deleteOrphanActors, fileExists, openPath } from '../lib/api'
import type { ActorGroup } from '../lib/types'

const actorGroups = ref<ActorGroup[]>([])
const loading = ref(false)
const error = ref('')
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const showCleanupDialog = ref(false)
const invalidRecords = ref<{ video_id: number; video_path: string }[]>([])
const cleaning = ref(false)
const expandedActors = ref(new Set<number>())
const previewImg = ref('')
const searchQuery = ref('')

const filteredActorGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return actorGroups.value
  return actorGroups.value.filter(g => {
    if (g.name && g.name.toLowerCase().includes(q)) return true
    return g.records.some(r => r.video_path && r.video_path.toLowerCase().includes(q))
  })
})

const totalVideos = computed(() => {
  const videoIds = new Set<number>()
  for (const g of filteredActorGroups.value) {
    for (const r of g.records) {
      videoIds.add(r.video_id)
    }
  }
  return videoIds.size
})

onMounted(() => {
  loadRecords()
})

async function loadRecords() {
  loading.value = true
  error.value = ''
  try {
    const data = await getAllActorsWithRecords()
    actorGroups.value = data
    expandedActors.value = new Set(data.map(g => g.actor_id))
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
    showMessage('删除成功', 'success')
  } catch (e: any) {
    showMessage('删除失败: ' + e.message, 'error')
  }
}

async function checkInvalidRecords() {
  try {
    const groups = await getAllActorsWithRecords()
    const seen = new Set<number>()
    const invalid: { video_id: number; video_path: string }[] = []
    for (const g of groups) {
      for (const r of g.records) {
        if (!r.video_path || seen.has(r.video_id)) continue
        seen.add(r.video_id)
        const exists = await fileExists(r.video_path)
        if (!exists) invalid.push({ video_id: r.video_id, video_path: r.video_path })
      }
    }
    if (invalid.length === 0) {
      showMessage('所有视频文件均存在', 'success')
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
    let videoCount = 0
    for (const r of invalidRecords.value) {
      await deleteVideo(r.video_id)
      videoCount++
    }
    const actorCount = await deleteOrphanActors()
    await loadRecords()
    showCleanupDialog.value = false
    const parts: string[] = []
    if (videoCount > 0) parts.push(`已清理 ${videoCount} 个无效视频`)
    if (actorCount > 0) parts.push(`已删除 ${actorCount} 个无记录的演员`)
    showMessage(parts.join('，'), 'success')
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

function previewImage(src: string) {
  previewImg.value = src
}

function openVideo(filePath: string) {
  if (filePath) {
    openPath(filePath)
  }
}
</script>
