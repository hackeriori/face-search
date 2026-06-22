<template>
  <div class="flex flex-col h-full p-4 gap-4 overflow-y-auto">
    <div class="grid grid-cols-2 gap-4 flex-1 min-h-0">
      <div class="flex flex-col gap-3 min-h-0">
        <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 flex-1 flex flex-col min-h-0">
          <div class="flex items-center gap-2 justify-between mb-2">
            <div class="text-sm font-medium text-gray-300 shrink-0">视频来源</div>
            <div v-if="savedVideoPath" class="w-0 grow text-xs text-gray-400 font-normal truncate"
                 :title="savedVideoPath">{{ savedVideoPath }}
            </div>
          </div>
          <div class="flex-1 min-h-0">
            <VideoPlayer
              ref="videoPlayerRef"
              :videoPath="videoPath"
              @frame-captured="onFrameCaptured"
            />
          </div>
          <div class="mt-2 flex gap-2">
            <button @click="selectVideo"
                    class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors">播放视频
            </button>
            <button @click="openVideo"
                    class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors">打开视频
            </button>
            <button @click="captureFrame" :disabled="!videoPath"
                    class="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-40 transition-colors">
              截取当前帧
            </button>
          </div>
        </div>

        <div class="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <h2 class="text-sm font-medium text-gray-300 mb-2">图片来源</h2>
          <ImageInput ref="imageInputRef" @paste-start="pasting = true" @image-selected="onImageSelected"/>
        </div>
      </div>

      <div class="flex flex-col gap-3 min-h-0">
        <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 flex-1 flex flex-col min-h-0">
          <h2 class="text-sm font-medium text-gray-300 mb-2">
            检测结果
            <span v-if="faces.length" class="text-gray-500 font-normal ml-1">({{ faces.length }} 张人脸)</span>
          </h2>
          <div v-if="pasting" class="flex-1 flex items-center justify-center text-gray-500 text-sm">
            正在处理粘贴的图片...
          </div>
          <div v-else-if="currentImage" class="flex-1 relative overflow-hidden rounded" ref="imageContainer">
            <img
              :src="currentImage"
              class="w-full h-full object-contain"
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
          <div class="mt-2 flex gap-2">
            <input
              v-model="actorName"
              placeholder="演员姓名（新建时使用）"
              class="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500 transition-colors"
            />
            <button
              @click="saveFace"
              :disabled="!savedVideoPath || !faces.length || !selectedFace || saving"
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
      <div v-if="showActorDialog" class="fixed inset-0 z-50 bg-black/60" @click.self="cancelActorDialog">
        <div class="bg-gray-800 rounded-lg shadow-xl border border-gray-600 flex flex-col" :style="dialogPositionStyle">
          <div class="flex flex-col h-full">
            <div class="px-5 py-4 border-b border-gray-700 shrink-0">
              <h3 class="text-base font-medium text-gray-200">检测到匹配的演员</h3>
              <p class="text-sm text-gray-400 mt-1">系统发现以下演员与当前人脸相似，请确认是否为同一人：</p>
            </div>
            <div class="flex-1 overflow-y-auto px-5 py-3 min-h-0 space-y-3">
              <div
                v-for="candidate in actorCandidates"
                :key="candidate.actor_id"
                class="flex items-center gap-4 justify-between bg-gray-700/50 rounded-lg p-3 border border-gray-600 hover:border-blue-500 transition-colors"
              >
                <div class="relative shrink-0 w-auto h-60 rounded overflow-hidden bg-gray-900">
                  <img :src="`data:image/jpeg;base64,${candidate.image_blob}`"
                       class="w-full h-full object-cover" alt=""/>
                </div>
                <div class="flex flex-col items-center">
                  <div class="text-sm font-medium text-gray-200">{{ candidate.name || `演员 #${candidate.actor_id}` }}</div>
                  <div class="text-xs text-gray-400 my-2">相似度:
                    <span class="text-xs px-2 py-0.5 rounded font-bold"
                          :class="candidate.similarity >= 80 ? 'bg-green-600 text-white' : candidate.similarity >= 60 ? 'bg-yellow-600 text-white' : 'bg-red-600 text-white'"
                    >
                      {{ candidate.similarity }}%
                    </span>
                  </div>
                  <button @click="selectActorMatch(candidate.actor_id)"
                          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm shrink-0 transition-colors">
                    同一演员
                  </button>
                </div>
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
      </div>
    </Teleport>

    <!-- Add Reference Dialog -->
    <Teleport to="body">
      <div v-if="showAddRefDialog" class="fixed inset-0 z-50 bg-black/60" @click.self="cancelAddRefDialog">
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="bg-gray-800 rounded-lg shadow-xl border border-gray-600 w-96">
            <div class="px-5 py-4 border-b border-gray-700">
              <h3 class="text-base font-medium text-gray-200">添加参考数据</h3>
            </div>
            <div class="px-5 py-4 space-y-2">
              <p class="text-sm text-gray-300">
                当前人脸与演员 #{{ refActorId }} 的匹配度为
                <span class="text-blue-400 font-bold">{{ refSimilarity }}%</span>。
              </p>
              <p class="text-sm text-gray-400">
                是否将当前人脸添加为该演员的参考数据？添加后可在不同造型下更准确地识别该演员。
              </p>
            </div>
            <div class="px-5 py-3 border-t border-gray-700 flex items-center justify-end gap-2">
              <button
                @click="rejectAddRef"
                class="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors"
              >
                仅关联视频
              </button>
              <button
                @click="confirmAddRef"
                class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
              >
                添加参考并关联
              </button>
            </div>
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
import {ref, computed, nextTick, onMounted, onUnmounted} from 'vue'
import VideoPlayer from '../components/VideoPlayer.vue'
import ImageInput from '../components/ImageInput.vue'
import {
  representImage, insertFaceRecord, searchMatchingActors, findOrCreateVideo, createActor, addActorFace, hasFaceRecord,
  readClipboardImage
} from '../lib/api'
import type {DetectedFace, ActorMatchCandidate} from '../lib/types'

const videoPath = ref('')
const savedVideoPath = ref('')
const currentImage = ref<string | null>(null)
const currentImageBuffer = ref<ArrayBuffer | null>(null)
const faces = ref<DetectedFace[]>([])
const selectedFace = ref<DetectedFace | null>(null)
const videoPlayerRef = ref<InstanceType<typeof VideoPlayer> | null>(null)
const imageInputRef = ref<InstanceType<typeof ImageInput> | null>(null)
const faceCanvas = ref<HTMLCanvasElement | null>(null)
const displayImage = ref<HTMLImageElement | null>(null)
const actorName = ref('')
const saving = ref(false)
const pasting = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

const imageNaturalWidth = ref(0)
const imageNaturalHeight = ref(0)
const imageContainer = ref<HTMLElement | null>(null)

// Actor match dialog
const showActorDialog = ref(false)
const actorCandidates = ref<ActorMatchCandidate[]>([])
let dialogResolve: ((actorId: number | null) => void) | null = null
let dialogReject: (() => void) | null = null

// Add reference dialog
const showAddRefDialog = ref(false)
const refSimilarity = ref(0)
const refActorId = ref(0)
let addRefResolve: ((value: boolean) => void) | null = null

async function handleKeyboardPaste(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable
  if (isInput) return
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault()
    pasting.value = true
    await nextTick()
    try {
      const data = await readClipboardImage()
      if (data) {
        await onImageSelected(data)
      }
    } finally {
      pasting.value = false
    }
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyboardPaste))
onUnmounted(() => window.removeEventListener('keydown', handleKeyboardPaste))

async function selectVideo() {
  const result = await window.electronAPI.openFile({
    filters: [{name: 'Video Files', extensions: ['mp4', 'webm', 'ogg', 'wmv', 'mkv', 'avi', 'mov']}]
  })
  if (!result.canceled && result.filePaths.length > 0) {
    videoPath.value = result.filePaths[0]
    savedVideoPath.value = result.filePaths[0]
  }
}

async function openVideo() {
  const result = await window.electronAPI.openFile({
    filters: [{name: 'Video Files', extensions: ['mp4', 'webm', 'ogg', 'wmv', 'mkv', 'avi', 'mov']}]
  })
  if (!result.canceled && result.filePaths.length > 0) {
    savedVideoPath.value = result.filePaths[0]
    await window.electronAPI.openPath(result.filePaths[0])
  }
}

function captureFrame() {
  videoPlayerRef.value?.captureFrame()
}

async function onFrameCaptured(data: {dataUrl: string; buffer: ArrayBuffer}) {
  currentImage.value = data.dataUrl
  currentImageBuffer.value = data.buffer
  await detectFaces(data.dataUrl)
}

async function onImageSelected(data: {dataUrl: string; buffer: ArrayBuffer}) {
  currentImage.value = data.dataUrl
  currentImageBuffer.value = data.buffer
  await detectFaces(data.dataUrl)
}

const dialogPositionStyle = computed(() => {
  const el = imageContainer.value
  if (!el) return {} as any
  const rect = el.getBoundingClientRect()
  return {
    position: 'fixed' as const,
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  }
})

async function detectFaces(imageDataUrl: string) {
  faces.value = []
  selectedFace.value = null
  try {
    const result = await representImage(imageDataUrl)
    faces.value = result.result.map((f: DetectedFace) => ({...f, selected: false}))
    if (faces.value.length === 1) {
      selectFace(0)
    }
    await nextTick()
    drawFaces()
  } catch (e: any) {
    showMessage('人脸检测失败: ' + e.message, 'error')
  } finally {
    pasting.value = false
  }
}

function selectFace(index: number) {
  faces.value.forEach((f, i) => {
    f.selected = i === index
  })
  selectedFace.value = faces.value[index]
  drawFaces()
}

function getImageRenderRect() {
  const canvas = faceCanvas.value
  const img = displayImage.value
  if (!canvas || !img) return null
  const rect = canvas.getBoundingClientRect()
  const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight)
  const renderedW = img.naturalWidth * scale
  const renderedH = img.naturalHeight * scale
  const offsetX = (rect.width - renderedW) / 2
  const offsetY = (rect.height - renderedH) / 2
  return {rect, scale, renderedW, renderedH, offsetX, offsetY}
}

function drawFaces() {
  const canvas = faceCanvas.value
  const img = displayImage.value
  if (!canvas || !img || !faces.value.length) return

  const r = getImageRenderRect()
  if (!r) return
  canvas.width = r.rect.width
  canvas.height = r.rect.height
  imageNaturalWidth.value = img.naturalWidth
  imageNaturalHeight.value = img.naturalHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const faceScaleX = r.renderedW / img.naturalWidth
  const faceScaleY = r.renderedH / img.naturalHeight

  for (const face of faces.value) {
    const x = r.offsetX + face.facial_area.x * faceScaleX
    const y = r.offsetY + face.facial_area.y * faceScaleY
    const w = face.facial_area.w * faceScaleX
    const h = face.facial_area.h * faceScaleY

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

  const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight)
  const renderedW = img.naturalWidth * scale
  const renderedH = img.naturalHeight * scale
  const offsetX = (rect.width - renderedW) / 2
  const offsetY = (rect.height - renderedH) / 2
  const faceScaleX = renderedW / img.naturalWidth
  const faceScaleY = renderedH / img.naturalHeight

  for (let i = faces.value.length - 1; i >= 0; i--) {
    const face = faces.value[i]
    const x = offsetX + face.facial_area.x * faceScaleX
    const y = offsetY + face.facial_area.y * faceScaleY
    const w = face.facial_area.w * faceScaleX
    const h = face.facial_area.h * faceScaleY

    if (clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h) {
      selectFace(i)
      return
    }
  }
}

async function resolveActorByDialog(
  embedding: number[],
  name: string,
  faceData: {
    image_blob: ArrayBuffer | Uint8Array
    facial_area_x: number
    facial_area_y: number
    facial_area_w: number
    facial_area_h: number
    face_confidence: number
    embedding: number[]
  }
): Promise<{actorId: number; wasExistingActor: boolean; similarity?: number}> {
  const candidates = await searchMatchingActors(embedding)
  if (candidates.length === 0) {
    const actorId = await createActor({name: name || undefined})
    await addActorFace(actorId, {
      image_blob: faceData.image_blob,
      facial_area_x: faceData.facial_area_x,
      facial_area_y: faceData.facial_area_y,
      facial_area_w: faceData.facial_area_w,
      facial_area_h: faceData.facial_area_h,
      face_confidence: faceData.face_confidence,
      embedding: faceData.embedding
    })
    return {actorId, wasExistingActor: false}
  }

  actorCandidates.value = candidates
  showActorDialog.value = true

  return new Promise<{actorId: number; wasExistingActor: boolean; similarity?: number}>((resolve, reject) => {
    dialogReject = () => {
      showActorDialog.value = false
      dialogResolve = null
      dialogReject = null
      reject(new Error('cancelled'))
    }
    dialogResolve = (actorId: number | null) => {
      showActorDialog.value = false
      dialogResolve = null
      dialogReject = null
      if (actorId !== null) {
        const candidate = candidates.find(c => c.actor_id === actorId)
        resolve({actorId, wasExistingActor: true, similarity: candidate?.similarity})
      } else {
        createActor({name: name || undefined}).then(async (newActorId) => {
          await addActorFace(newActorId, {
            image_blob: faceData.image_blob,
            facial_area_x: faceData.facial_area_x,
            facial_area_y: faceData.facial_area_y,
            facial_area_w: faceData.facial_area_w,
            facial_area_h: faceData.facial_area_h,
            face_confidence: faceData.face_confidence,
            embedding: faceData.embedding
          })
          resolve({actorId: newActorId, wasExistingActor: false})
        })
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
  dialogReject?.()
}

function confirmAddRef() {
  showAddRefDialog.value = false
  addRefResolve?.(true)
  addRefResolve = null
}

function rejectAddRef() {
  showAddRefDialog.value = false
  addRefResolve?.(false)
  addRefResolve = null
}

function cancelAddRefDialog() {
  showAddRefDialog.value = false
  addRefResolve?.(false)
  addRefResolve = null
}

async function saveFace() {
  if (!savedVideoPath.value) {
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

    const faceData = {
      image_blob: safeBlob,
      facial_area_x: face.facial_area.x,
      facial_area_y: face.facial_area.y,
      facial_area_w: face.facial_area.w,
      facial_area_h: face.facial_area.h,
      face_confidence: face.face_confidence,
      embedding: [...face.embedding]
    }

    const videoId = await findOrCreateVideo(savedVideoPath.value)

    let resolution: {actorId: number; wasExistingActor: boolean; similarity?: number}
    try {
      resolution = await resolveActorByDialog(
        [...face.embedding],
        actorName.value,
        faceData
      )
    } catch {
      return
    }

    if (resolution.wasExistingActor && resolution.similarity !== undefined) {
      refActorId.value = resolution.actorId
      refSimilarity.value = resolution.similarity
      showAddRefDialog.value = true
      const shouldAdd = await new Promise<boolean>((resolve) => {
        addRefResolve = resolve
      })
      if (shouldAdd) {
        await addActorFace(resolution.actorId, faceData)
      }
    }

    const exists = await hasFaceRecord(resolution.actorId, videoId)
    if (exists) {
      showMessage('该演员在此视频中已存在记录', 'error')
      saving.value = false
      return
    }

    await insertFaceRecord(resolution.actorId, videoId)
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
  setTimeout(() => {
    message.value = ''
  }, 3000)
}
</script>
