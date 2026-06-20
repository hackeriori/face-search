<template>
  <div class="flex flex-col h-full p-4 gap-4 overflow-y-auto">
    <div class="grid grid-cols-2 gap-4 flex-1 min-h-0">
      <div class="flex flex-col gap-3 min-h-0">
        <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 flex-1 flex flex-col min-h-0">
          <h2 class="text-sm font-medium text-gray-300 mb-2">视频来源</h2>
          <div class="flex-1 min-h-0">
            <VideoPlayer
              ref="videoPlayerRef"
              :videoPath="videoPath"
              @frame-captured="onFrameCaptured"
            />
          </div>
          <div class="mt-2 flex gap-2">
            <button @click="selectVideo" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors">选择视频</button>
            <button @click="captureFrame" :disabled="!videoPath" class="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-40 transition-colors">截取当前帧</button>
          </div>
        </div>

        <div class="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <h2 class="text-sm font-medium text-gray-300 mb-2">图片来源</h2>
          <ImageInput ref="imageInputRef" @image-selected="onImageSelected" />
        </div>
      </div>

      <div class="flex flex-col gap-3 min-h-0">
        <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 flex-1 flex flex-col min-h-0">
          <h2 class="text-sm font-medium text-gray-300 mb-2">
            检测结果
            <span v-if="faces.length" class="text-gray-500 font-normal ml-1">({{ faces.length }} 张人脸)</span>
          </h2>
          <div v-if="currentImage" class="flex-1 relative overflow-hidden rounded" ref="imageContainer">
            <img
              :src="currentImage"
              class="max-w-full max-h-full object-contain"
              :class="{ 'opacity-50': !faces.length }"
              ref="displayImage"
              @load="drawFaces"
            />
            <canvas
              v-if="faces.length"
              ref="faceCanvas"
              class="absolute inset-0 w-full h-full"
              @click="onCanvasClick"
            />
          </div>
          <div v-else class="flex-1 flex items-center justify-center text-gray-500 text-sm">
            暂无图片，请截取视频帧或选择图片
          </div>
          <div class="mt-2 flex gap-2 justify-end">
            <button
              @click="saveFace"
              :disabled="!videoPath || !faces.length || !selectedFace || saving"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium disabled:opacity-40 transition-colors"
            >
              {{ saving ? '保存中...' : '保存人脸' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Actor Match Dialog -->
    <Teleport to="body">
      <div v-if="showActorDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="cancelActorDialog">
        <div class="bg-gray-800 rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col border border-gray-600">
          <div class="px-5 py-4 border-b border-gray-700 shrink-0">
            <h3 class="text-base font-medium text-gray-200">检测到匹配的演员</h3>
            <p class="text-sm text-gray-400 mt-1">系统发现以下演员与当前人脸相似，请确认是否为同一人：</p>
          </div>
          <div class="flex-1 overflow-y-auto px-5 py-3 min-h-0 space-y-3">
            <div
              v-for="candidate in actorCandidates"
              :key="candidate.actor_id"
              class="flex items-center gap-4 bg-gray-700/50 rounded-lg p-3 border border-gray-600 hover:border-blue-500 transition-colors"
            >
              <div class="relative shrink-0 w-20 h-20 rounded overflow-hidden bg-gray-900">
                <img
                  :src="`data:image/jpeg;base64,${candidate.image_blob}`"
                  class="w-full h-full object-cover"
                />
                <div class="absolute border-2 border-green-500 pointer-events-none"
                  :style="{
                    left: (candidate.facial_area_x * (80 / imageNaturalWidth)) + 'px',
                    top: (candidate.facial_area_y * (80 / imageNaturalHeight)) + 'px',
                    width: (candidate.facial_area_w * (80 / imageNaturalWidth)) + 'px',
                    height: (candidate.facial_area_h * (80 / imageNaturalHeight)) + 'px'
                  }"
                ></div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-200">演员 #{{ candidate.actor_id }}</span>
                  <span class="text-xs px-2 py-0.5 rounded font-bold"
                    :class="candidate.similarity >= 80 ? 'bg-green-600 text-white' : candidate.similarity >= 60 ? 'bg-yellow-600 text-white' : 'bg-red-600 text-white'"
                  >
                    {{ candidate.similarity }}%
                  </span>
                </div>
                <div class="text-xs text-gray-400 mt-1">相似度: {{ candidate.similarity }}%</div>
              </div>
              <button
                @click="selectActorMatch(candidate.actor_id)"
                class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm shrink-0 transition-colors"
              >
                同一演员
              </button>
            </div>
          </div>
          <div class="px-5 py-3 border-t border-gray-700 flex items-center justify-end gap-2 shrink-0">
            <button
              @click="rejectActorMatch"
              class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors"
            >
              以上都不是，新建演员
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <div v-if="message" class="fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-sm"
      :class="messageType === 'success' ? 'bg-green-600' : 'bg-red-600'"
    >
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import VideoPlayer from '../components/VideoPlayer.vue'
import ImageInput from '../components/ImageInput.vue'
import { representImage, insertFace, searchMatchingActors, findOrCreateVideo, createActor, hasFaceRecord } from '../lib/api'
import type { DetectedFace, FaceArea, ActorMatchCandidate } from '../lib/types'

const videoPath = ref('')
const currentImage = ref<string | null>(null)
const currentImageBuffer = ref<ArrayBuffer | null>(null)
const faces = ref<DetectedFace[]>([])
const selectedFace = ref<DetectedFace | null>(null)
const videoPlayerRef = ref<InstanceType<typeof VideoPlayer> | null>(null)
const imageInputRef = ref<InstanceType<typeof ImageInput> | null>(null)
const faceCanvas = ref<HTMLCanvasElement | null>(null)
const displayImage = ref<HTMLImageElement | null>(null)
const saving = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

const imageNaturalWidth = ref(0)
const imageNaturalHeight = ref(0)

// Actor match dialog
const showActorDialog = ref(false)
const actorCandidates = ref<ActorMatchCandidate[]>([])
let dialogResolve: ((actorId: number | null) => void) | null = null

async function selectVideo() {
  const result = await window.electronAPI.openFile({
    filters: [{ name: 'Video Files', extensions: ['mp4', 'webm', 'ogg', 'wmv', 'mkv', 'avi', 'mov'] }]
  })
  if (!result.canceled && result.filePaths.length > 0) {
    videoPath.value = result.filePaths[0]
  }
}

function captureFrame() {
  videoPlayerRef.value?.captureFrame()
}

async function onFrameCaptured(data: { dataUrl: string; buffer: ArrayBuffer }) {
  currentImage.value = data.dataUrl
  currentImageBuffer.value = data.buffer
  await detectFaces(data.dataUrl)
}

async function onImageSelected(data: { dataUrl: string; buffer: ArrayBuffer }) {
  currentImage.value = data.dataUrl
  currentImageBuffer.value = data.buffer
  await detectFaces(data.dataUrl)
}

async function detectFaces(imageDataUrl: string) {
  faces.value = []
  selectedFace.value = null
  try {
    const result = await representImage(imageDataUrl)
    faces.value = result.result.map((f: DetectedFace) => ({ ...f, selected: false }))
    if (faces.value.length === 1) {
      selectFace(0)
    }
    await nextTick()
    drawFaces()
  } catch (e: any) {
    showMessage('人脸检测失败: ' + e.message, 'error')
  }
}

function selectFace(index: number) {
  faces.value.forEach((f, i) => {
    f.selected = i === index
  })
  selectedFace.value = faces.value[index]
  drawFaces()
}

function drawFaces() {
  const canvas = faceCanvas.value
  const img = displayImage.value
  if (!canvas || !img || !faces.value.length) return

  const rect = img.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height
  imageNaturalWidth.value = img.naturalWidth
  imageNaturalHeight.value = img.naturalHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const scaleX = rect.width / img.naturalWidth
  const scaleY = rect.height / img.naturalHeight

  for (const face of faces.value) {
    const x = face.facial_area.x * scaleX
    const y = face.facial_area.y * scaleY
    const w = face.facial_area.w * scaleX
    const h = face.facial_area.h * scaleY

    ctx.strokeStyle = face.selected ? '#22c55e' : '#ef4444'
    ctx.lineWidth = face.selected ? 3 : 2
    ctx.strokeRect(x, y, w, h)

    ctx.fillStyle = face.selected ? '#22c55e' : '#ef4444'
    ctx.font = '12px sans-serif'
    ctx.fillText(
      `${(face.face_confidence * 100).toFixed(1)}%`,
      x + 4,
      y - 4 > 12 ? y - 4 : y + 14
    )
  }
}

function onCanvasClick(event: MouseEvent) {
  const canvas = faceCanvas.value
  const img = displayImage.value
  if (!canvas || !img) return

  const rect = canvas.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const clickY = event.clientY - rect.top
  const scaleX = img.naturalWidth / rect.width
  const scaleY = img.naturalHeight / rect.height

  for (let i = faces.value.length - 1; i >= 0; i--) {
    const face = faces.value[i]
    const x = face.facial_area.x * (rect.width / img.naturalWidth)
    const y = face.facial_area.y * (rect.height / img.naturalHeight)
    const w = face.facial_area.w * (rect.width / img.naturalWidth)
    const h = face.facial_area.h * (rect.height / img.naturalHeight)

    if (clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h) {
      selectFace(i)
      return
    }
  }
}

async function resolveActorByDialog(embedding: number[]): Promise<number> {
  const candidates = await searchMatchingActors(embedding)
  if (candidates.length === 0) {
    return createActor()
  }

  actorCandidates.value = candidates
  showActorDialog.value = true

  return new Promise<number>((resolve) => {
    dialogResolve = (actorId: number | null) => {
      showActorDialog.value = false
      dialogResolve = null
      if (actorId !== null) {
        resolve(actorId)
      } else {
        createActor().then(resolve)
      }
    }
  })
}

function selectActorMatch(actorId: number) {
  dialogResolve?.(actorId)
}

function rejectActorMatch() {
  dialogResolve?.(null)
}

function cancelActorDialog() {
  dialogResolve?.(null)
}

async function saveFace() {
  if (!videoPath.value) {
    showMessage('请先选择视频', 'error')
    return
  }
  if (!faces.value.length) {
    showMessage('请先截取视频帧并检测人脸', 'error')
    return
  }
  if (!selectedFace.value) {
    showMessage('请先选择一张人脸', 'error')
    return
  }
  if (!currentImageBuffer.value) return
  saving.value = true
  try {
    const buf = currentImageBuffer.value
    const view = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf
    const safeBlob = view.slice()
    const face = selectedFace.value

    const videoId = await findOrCreateVideo(videoPath.value)
    const actorId = await resolveActorByDialog([...face.embedding])

    const exists = await hasFaceRecord(actorId, videoId)
    if (exists) {
      showMessage('该演员在此视频中已存在记录', 'error')
      saving.value = false
      return
    }

    await insertFace({
      actor_id: actorId,
      video_id: videoId,
      image_blob: safeBlob,
      facial_area_x: face.facial_area.x,
      facial_area_y: face.facial_area.y,
      facial_area_w: face.facial_area.w,
      facial_area_h: face.facial_area.h,
      face_confidence: face.face_confidence,
      embedding: [...face.embedding]
    })
    showMessage('人脸保存成功', 'success')
  } catch (e: any) {
    showMessage('保存失败: ' + e.message, 'error')
  } finally {
    saving.value = false
  }
}

function showMessage(msg: string, type: 'success' | 'error') {
  message.value = msg
  messageType.value = type
  setTimeout(() => { message.value = '' }, 3000)
}
</script>
