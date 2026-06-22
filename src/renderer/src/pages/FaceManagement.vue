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
          @click="toggleMergeMode"
          class="px-3 py-1.5 rounded text-sm transition-colors"
          :class="mergeMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-500'"
        >
          {{ mergeMode ? '取消合并' : '合并' }}
        </button>
        <button
          @click="checkInvalidRecords"
          class="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 rounded text-sm transition-colors"
        >
          清理
        </button>
        <button
          v-if="mergeMode && selectedActorIds.size >= 2"
          @click="openMergeDialog"
          class="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm transition-colors"
        >
          确认合并 ({{ selectedActorIds.size }})
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
          共 <span class="text-gray-200 font-medium">{{ filteredActorGroups.length }}</span> 位演员，<span
          class="text-gray-200 font-medium">{{ totalVideos }}</span> 部视频
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
          <div
            v-for="group in filteredActorGroups"
            :key="group.actor_id"
            class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex shrink-0"
          >
            <div class="shrink-0">
              <img
                v-if="group.image_blob" alt="actor" :src="`data:image/jpeg;base64,${group.image_blob}`"
                class="h-60 cursor-pointer border-r border-gray-700 object-contain"
                @click="previewImage(`data:image/jpeg;base64,${group.image_blob}`, group.facial_area_x, group.facial_area_y, group.facial_area_w, group.facial_area_h)"
              />
              <div v-else class="h-60 w-40 bg-gray-700 flex items-center justify-center text-xs text-gray-400">?</div>
            </div>
            <div class="flex flex-col flex-1 min-w-0">
              <div class="flex items-center gap-3 p-3 border-b border-gray-700">
                <input
                  v-if="mergeMode"
                  type="checkbox"
                  :checked="selectedActorIds.has(group.actor_id)"
                  @click.stop="toggleSelectActor(group.actor_id)"
                  class="shrink-0 w-4 h-4 accent-blue-500"
                />
                <template v-if="editingActorId === group.actor_id">
                  <input
                    ref="renameInputRef"
                    v-model="renameText"
                    @keydown.enter="confirmRename(group.actor_id)"
                    @keydown.esc="cancelRename"
                    @blur="confirmRename(group.actor_id)"
                    class="flex-1 min-w-0 px-2 py-0.5 bg-gray-700 border border-gray-500 rounded text-sm text-gray-200 outline-none"
                    autofocus
                  />
                  <button @click="confirmRename(group.actor_id)"
                          class="px-2 py-0.5 bg-green-600 hover:bg-green-500 rounded text-xs transition-colors shrink-0">
                    保存
                  </button>
                  <button @click="cancelRename"
                          class="px-2 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-xs transition-colors shrink-0">
                    取消
                  </button>
                </template>
                <template v-else>
                <span class="text-sm font-medium text-orange-200 truncate mr-1">
                  {{ group.name || `演员 #${group.actor_id}` }}
                  <button title="重命名" @click="startRename(group)"
                          class="p-1 text-gray-400 hover:text-gray-200 rounded transition-colors shrink-0">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path
                      stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  </button>
                </span>
                </template>
                <button
                  @click="switchActorTab(group.actor_id, 'videos')"
                  :class="(activeActorTab[group.actor_id] || 'videos') === 'videos' ? 'bg-gray-700 text-gray-200' : 'bg-transparent text-gray-500 hover:text-gray-300'"
                  class="px-1.5 py-0.5 rounded text-xs transition-colors shrink-0"
                >视频({{ group.records.length }})
                </button>
                <button
                  v-if="(actorFacesMap[group.actor_id] || []).length > 1"
                  @click="switchActorTab(group.actor_id, 'faces')"
                  :class="activeActorTab[group.actor_id] === 'faces' ? 'bg-gray-700 text-gray-200' : 'bg-transparent text-gray-500 hover:text-gray-300'"
                  class="px-1.5 py-0.5 rounded text-xs transition-colors shrink-0"
                >人脸({{ (actorFacesMap[group.actor_id] || []).length }})
                </button>
              </div>
              <div class="flex-1 overflow-y-auto">
                <div v-if="(activeActorTab[group.actor_id] || 'videos') !== 'faces'">
                  <div
                    v-for="record in group.records"
                    :key="record.id"
                    class="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700/30 border-b border-gray-700/50 last:border-none"
                  >
                    <div class="flex-1 min-w-0 flex items-center gap-2">
                      <span class="text-xs text-gray-400 shrink-0">视频：</span>
                      <button @click="openVideo(record.video_path)"
                              class="text-xs text-blue-400 hover:text-blue-300 truncate min-w-0 text-left">
                        {{ record.video_path || '-' }}
                      </button>
                    </div>
                    <button
                      @click="deleteRecord(group.actor_id, record.id)"
                      class="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors shrink-0"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div v-if="activeActorTab[group.actor_id] === 'faces'">
                  <div
                    v-for="face in (actorFacesMap[group.actor_id] || [])"
                    :key="face.id"
                    class="flex items-center gap-3 px-3 py-2 hover:bg-gray-700/30 border-b border-gray-700/50 last:border-none"
                  >
                    <img
                      v-if="face.image_blob"
                      :src="`data:image/jpeg;base64,${face.image_blob}`"
                      class="w-10 h-10 object-cover rounded shrink-0 cursor-pointer border border-gray-600"
                      @click.stop="previewImage(`data:image/jpeg;base64,${face.image_blob}`, face.facial_area_x, face.facial_area_y, face.facial_area_w, face.facial_area_h)"
                    />
                    <div v-else
                         class="w-10 h-10 rounded shrink-0 bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                      ?
                    </div>
                    <div class="flex-1 min-w-0">
                      <span class="text-xs text-gray-400">人脸 #{{ face.id }}</span>
                      <span v-if="face.face_confidence"
                            class="text-xs text-gray-500 ml-2">{{ (face.face_confidence * 100).toFixed(1) }}%</span>
                    </div>
                    <button
                      v-if="(actorFacesMap[group.actor_id] || []).length > 1"
                      @click="deleteFace(group.actor_id, face)"
                      class="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors shrink-0"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

    </div>

    <div v-if="message" class="fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-sm"
         :class="messageType === 'success' ? 'bg-green-600' : 'bg-red-600'">
      {{ message }}
    </div>

    <div v-if="previewData" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
         @click.self="previewData = null">
      <div class="relative inline-flex overflow-hidden rounded-lg">
        <img ref="previewDisplayImage" :src="previewData.src" class="max-w-[90vw] max-h-[90vh] object-contain"
             @load="drawPreviewFaces"/>
        <canvas ref="previewFaceCanvas" class="absolute inset-0 w-full h-full pointer-events-none"/>
      </div>
    </div>

    <div v-if="showDeleteDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
         @click.self="showDeleteDialog = false">
      <div class="bg-gray-800 rounded-lg shadow-xl w-[480px] flex flex-col">
        <div class="px-5 py-4 border-b border-gray-700">
          <h3 class="text-base font-medium text-gray-200">确认删除</h3>
        </div>
        <div class="px-5 py-4">
          <p class="text-sm text-gray-300">确定要删除此视频记录吗？该操作将删除视频及其关联的所有人脸记录。</p>
          <p class="text-sm text-gray-400 mt-2 truncate">{{ pendingDelete?.record?.video_path }}</p>
        </div>
        <div class="px-5 py-3 border-t border-gray-700 flex items-center justify-end gap-2">
          <button @click="showDeleteDialog = false"
                  class="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors">取消
          </button>
          <button @click="confirmDeleteRecord"
                  class="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm transition-colors">确认删除
          </button>
        </div>
      </div>
    </div>

    <div v-if="showFaceDeleteDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
         @click.self="showFaceDeleteDialog = false">
      <div class="bg-gray-800 rounded-lg shadow-xl w-[480px] flex flex-col">
        <div class="px-5 py-4 border-b border-gray-700">
          <h3 class="text-base font-medium text-gray-200">确认删除人脸</h3>
        </div>
        <div class="px-5 py-4">
          <p class="text-sm text-gray-300">确定要删除此人脸记录吗？此操作不可撤销。</p>
        </div>
        <div class="px-5 py-3 border-t border-gray-700 flex items-center justify-end gap-2">
          <button @click="showFaceDeleteDialog = false"
                  class="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors">取消
          </button>
          <button @click="confirmDeleteFace"
                  class="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm transition-colors">确认删除
          </button>
        </div>
      </div>
    </div>

    <div v-if="showCleanupDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
         @click.self="showCleanupDialog = false">
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

    <div v-if="showMergeDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
         @click.self="showMergeDialog = false">
      <div class="bg-gray-800 rounded-lg shadow-xl w-[480px] flex flex-col">
        <div class="px-5 py-4 border-b border-gray-700">
          <h3 class="text-base font-medium text-gray-200">合并演员</h3>
          <p class="text-sm text-gray-400 mt-1">选择要保留的演员，其他演员的视频和人脸数据将合并到该演员名下。</p>
        </div>
        <div class="px-5 py-3 max-h-[300px] overflow-y-auto">
          <div
            v-for="id in selectedActorIds"
            :key="id"
            @click="mergeTargetId = id"
            class="flex items-center gap-3 py-2.5 px-2 rounded cursor-pointer transition-colors"
            :class="mergeTargetId === id ? 'bg-blue-600/30' : 'hover:bg-gray-700/50'"
          >
            <input type="radio" :value="id" v-model="mergeTargetId" class="accent-blue-500 shrink-0"/>
            <img
              v-if="getActorGroup(id)?.image_blob"
              :src="`data:image/jpeg;base64,${getActorGroup(id)!.image_blob}`"
              class="w-14 h-14 object-cover rounded shrink-0 border border-gray-600"
            />
            <div v-else
                 class="w-14 h-14 rounded shrink-0 bg-gray-700 flex items-center justify-center text-xs text-gray-400">?
            </div>
            <span class="text-sm text-gray-200">{{ getActorName(id) }}</span>
          </div>
        </div>
        <div class="px-5 py-3 border-t border-gray-700 flex items-center justify-end gap-2">
          <button @click="showMergeDialog = false"
                  class="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors">取消
          </button>
          <button @click="confirmMerge"
                  class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors"
                  :disabled="merging">
            {{ merging ? '合并中...' : '确认合并' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted, nextTick} from 'vue'
import {
  getAllActorsWithRecords, deleteVideo, deleteOrphanActors, fileExists, openPath, mergeActors, getActorFaces,
  deleteActorFace, renameActor
} from '../lib/api'
import type {ActorGroup, ActorRecord, ActorFace} from '../lib/types'

const actorGroups = ref<ActorGroup[]>([])
const loading = ref(false)
const error = ref('')
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const showCleanupDialog = ref(false)
const invalidRecords = ref<{video_id: number; video_path: string}[]>([])
const cleaning = ref(false)
const showDeleteDialog = ref(false)
const pendingDelete = ref<{actorId: number; record: ActorRecord} | null>(null)

const previewData = ref<{src: string; facialArea: {x: number; y: number; w: number; h: number} | null} | null>(null)
const previewFaceCanvas = ref<HTMLCanvasElement | null>(null)
const previewDisplayImage = ref<HTMLImageElement | null>(null)
const searchQuery = ref('')
const mergeMode = ref(false)
const selectedActorIds = ref(new Set<number>())
const showMergeDialog = ref(false)
const mergeTargetId = ref<number | null>(null)
const merging = ref(false)
const actorFacesMap = ref<Record<number, ActorFace[]>>({})
const activeActorTab = ref<Record<number, 'videos' | 'faces'>>({})
const showFaceDeleteDialog = ref(false)
const pendingFaceDelete = ref<{actorId: number; face: ActorFace} | null>(null)

const editingActorId = ref<number | null>(null)
const renameText = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const filteredActorGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return actorGroups.value
  return actorGroups.value.filter(g => {
    const displayName = g.name || `演员 #${g.actor_id}`
    if (displayName.toLowerCase().includes(q)) return true
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
    data.sort((a, b) => b.actor_id - a.actor_id)
    actorGroups.value = data
    const faceResults = await Promise.all(data.map(g => getActorFaces(g.actor_id)))
    const map: Record<number, ActorFace[]> = {}
    data.forEach((g, i) => {
      map[g.actor_id] = faceResults[i]
    })
    actorFacesMap.value = map
  } catch (e: any) {
    error.value = '加载失败: ' + e.message
  } finally {
    loading.value = false
  }
}

async function deleteRecord(actorId: number, recordId: number) {
  const group = actorGroups.value.find(g => g.actor_id === actorId)
  const record = group?.records.find(r => r.id === recordId)
  if (!record) return
  pendingDelete.value = {actorId, record}
  showDeleteDialog.value = true
}

async function confirmDeleteRecord() {
  if (!pendingDelete.value) return
  const record = pendingDelete.value.record
  try {
    await deleteVideo(record.video_id)
    await deleteOrphanActors()
    await loadRecords()
    showDeleteDialog.value = false
    pendingDelete.value = null
    showMessage('删除成功', 'success')
  } catch (e: any) {
    showMessage('删除失败: ' + e.message, 'error')
  }
}

function toggleMergeMode() {
  mergeMode.value = !mergeMode.value
  if (!mergeMode.value) {
    selectedActorIds.value = new Set()
    mergeTargetId.value = null
  }
}

function toggleSelectActor(actorId: number) {
  const s = new Set(selectedActorIds.value)
  if (s.has(actorId)) {
    s.delete(actorId)
  } else {
    s.add(actorId)
  }
  selectedActorIds.value = s
}

function switchActorTab(actorId: number, tab: 'videos' | 'faces') {
  activeActorTab.value[actorId] = tab
}

async function deleteFace(actorId: number, face: ActorFace) {
  pendingFaceDelete.value = {actorId, face}
  showFaceDeleteDialog.value = true
}

async function confirmDeleteFace() {
  if (!pendingFaceDelete.value) return
  const {actorId, face} = pendingFaceDelete.value
  try {
    await deleteActorFace(face.id)
    const faces = (actorFacesMap.value[actorId] || []).filter(f => f.id !== face.id)
    actorFacesMap.value = {...actorFacesMap.value, [actorId]: faces}
    showFaceDeleteDialog.value = false
    pendingFaceDelete.value = null
    showMessage('删除成功', 'success')
  } catch (e: any) {
    showMessage('删除失败: ' + e.message, 'error')
  }
}

function getActorName(actorId: number): string {
  const group = actorGroups.value.find(g => g.actor_id === actorId)
  return group?.name || `演员 #${actorId}`
}

function getActorGroup(actorId: number): ActorGroup | undefined {
  return actorGroups.value.find(g => g.actor_id === actorId)
}

function openMergeDialog() {
  mergeTargetId.value = null
  showMergeDialog.value = true
}

async function confirmMerge() {
  if (mergeTargetId.value === null) return
  merging.value = true
  try {
    const targetId = mergeTargetId.value
    for (const id of selectedActorIds.value) {
      if (id !== targetId) {
        await mergeActors(id, targetId)
      }
    }
    await loadRecords()
    showMergeDialog.value = false
    toggleMergeMode()
    showMessage('合并成功', 'success')
  } catch (e: any) {
    showMessage('合并失败: ' + e.message, 'error')
  } finally {
    merging.value = false
  }
}

async function checkInvalidRecords() {
  try {
    const groups = await getAllActorsWithRecords()
    const seen = new Set<number>()
    const invalid: {video_id: number; video_path: string}[] = []
    for (const g of groups) {
      for (const r of g.records) {
        if (!r.video_path || seen.has(r.video_id)) continue
        seen.add(r.video_id)
        const exists = await fileExists(r.video_path)
        if (!exists) invalid.push({video_id: r.video_id, video_path: r.video_path})
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
  setTimeout(() => {
    message.value = ''
  }, 3000)
}

function previewImage(src: string, facialAreaX: number | null, facialAreaY: number | null, facialAreaW: number | null, facialAreaH: number | null) {
  previewData.value = {
    src,
    facialArea: facialAreaX !== null && facialAreaY !== null && facialAreaW !== null && facialAreaH !== null
      ? {x: facialAreaX, y: facialAreaY, w: facialAreaW, h: facialAreaH}
      : null
  }
  nextTick(() => drawPreviewFaces())
}

function drawPreviewFaces() {
  const canvas = previewFaceCanvas.value
  const img = previewDisplayImage.value
  if (!canvas || !img || !previewData.value?.facialArea) return

  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight)
  const renderedW = img.naturalWidth * scale
  const renderedH = img.naturalHeight * scale
  const offsetX = (rect.width - renderedW) / 2
  const offsetY = (rect.height - renderedH) / 2
  const faceScaleX = renderedW / img.naturalWidth
  const faceScaleY = renderedH / img.naturalHeight

  const fa = previewData.value.facialArea
  const x = offsetX + fa.x * faceScaleX
  const y = offsetY + fa.y * faceScaleY
  const w = fa.w * faceScaleX
  const h = fa.h * faceScaleY

  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = 3
  ctx.strokeRect(x, y, w, h)
}

function startRename(group: ActorGroup) {
  editingActorId.value = group.actor_id
  renameText.value = group.name || ''
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

async function confirmRename(actorId: number) {
  if (editingActorId.value !== actorId) return
  const name = renameText.value.trim()
  const group = actorGroups.value.find(g => g.actor_id === actorId)
  if (!group) return
  if (name && name !== (group.name || '')) {
    try {
      await renameActor(actorId, name)
      group.name = name
      showMessage('重命名成功', 'success')
    } catch (e: any) {
      showMessage('重命名失败: ' + e.message, 'error')
    }
  }
  editingActorId.value = null
  renameText.value = ''
}

function cancelRename() {
  editingActorId.value = null
  renameText.value = ''
}

function openVideo(filePath: string) {
  if (filePath) {
    openPath(filePath)
  }
}
</script>
