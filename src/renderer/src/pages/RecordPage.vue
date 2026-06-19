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

        <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 flex-1 flex flex-col min-h-0">
          <h2 class="text-sm font-medium text-gray-300 mb-2">图片来源</h2>
          <div class="flex-1 min-h-0 flex items-center justify-center">
            <ImageInput ref="imageInputRef" @image-selected="onImageSelected" />
          </div>
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
              :disabled="!selectedFace || saving"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium disabled:opacity-40 transition-colors"
            >
              {{ saving ? '保存中...' : '保存人脸' }}
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import VideoPlayer from '../components/VideoPlayer.vue'
import ImageInput from '../components/ImageInput.vue'
import { representImage, insertFace } from '../lib/api'
import type { DetectedFace, FaceArea } from '../lib/types'

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
    if (faces.value.length > 0) {
      selectFace(0)
    }
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

async function saveFace() {
  if (!selectedFace.value || !currentImageBuffer.value) return
  saving.value = true
  try {
    const buf = currentImageBuffer.value
    const view = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf
    const safeBlob = view.slice()
    const face = selectedFace.value
    await insertFace({
      video_path: videoPath.value || '',
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
