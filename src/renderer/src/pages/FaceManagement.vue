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
            :src="`data:image/jpeg;base64,${group.records[0].image_blob}`"
            class="w-10 h-10 object-cover rounded shrink-0"
          />
          <div class="flex-1 min-w-0">
            <span class="text-sm font-medium text-gray-200">演员 #{{ group.actor_id }}</span>
            <span class="text-xs text-gray-500 ml-2">{{ group.total_videos }} 部视频</span>
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
            <div class="relative w-12 h-12 rounded overflow-hidden bg-gray-900 shrink-0">
              <img
                :src="`data:image/jpeg;base64,${record.image_blob}`"
                class="w-full h-full object-cover"
              />
              <div class="absolute border border-green-500 pointer-events-none"
                :style="{
                  left: record.facial_area_x + 'px',
                  top: record.facial_area_y + 'px',
                  width: record.facial_area_w + 'px',
                  height: record.facial_area_h + 'px'
                }"
              ></div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs text-gray-300 truncate" :title="record.video_path">
                {{ record.video_path || '-' }}
              </div>
              <div class="text-xs text-gray-500 mt-0.5">
                {{ (record.face_confidence * 100).toFixed(1) }}% · {{ record.created_at }}
              </div>
            </div>
            <button
              @click="deleteRecord(record)"
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
            <div class="text-xs text-gray-500 mt-0.5">演员 #{{ r.actor_id }} | ID: {{ r.id }} | 录入: {{ r.created_at }}</div>
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
import type { FaceRecord, ActorGroup } from '../lib/types'

const allRecords = ref<FaceRecord[]>([])
const loading = ref(false)
const error = ref('')
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const showCleanupDialog = ref(false)
const invalidRecords = ref<FaceRecord[]>([])
const cleaning = ref(false)
const expandedActors = ref(new Set<number>())

const actorGroups = computed<ActorGroup[]>(() => {
  const map = new Map<number, FaceRecord[]>()
  for (const r of allRecords.value) {
    if (!map.has(r.actor_id)) map.set(r.actor_id, [])
    map.get(r.actor_id)!.push(r)
  }
  const groups: ActorGroup[] = []
  for (const [actorId, records] of map) {
    groups.push({
      actor_id: actorId,
      records,
      total_videos: records.length
    })
  }
  groups.sort((a, b) => a.actor_id - b.actor_id)
  return groups
})

const totalRecords = computed(() => allRecords.value.length)

onMounted(() => {
  loadRecords()
})

async function loadRecords() {
  loading.value = true
  error.value = ''
  try {
    allRecords.value = await getAllRecords() as FaceRecord[]
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

async function deleteRecord(record: FaceRecord) {
  if (!confirm(`确定要删除演员 #${record.actor_id} 在"${record.video_path}"中的记录吗？`)) return
  try {
    await deleteRecordApi(record.id)
    allRecords.value = allRecords.value.filter(r => r.id !== record.id)
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
    allRecords.value = allRecords.value.filter(rec => !invalidRecords.value.some(inv => inv.id === rec.id))
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
