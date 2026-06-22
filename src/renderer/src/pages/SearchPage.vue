<template>
  <div class="flex flex-col h-full p-4 gap-4">
    <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 flex gap-4 items-start">
      <div class="flex-1 min-w-0">
        <h2 class="text-sm font-medium text-gray-300 mb-2">输入搜索图片</h2>
        <ImageInput @paste-start="pasting = true" @image-selected="onImageSelected"/>
      </div>
      <img v-if="selectedImage" :src="selectedImage"
           class="h-60 w-auto object-contain rounded cursor-pointer shrink-0"
           @click="previewSrc = selectedImage" alt=""/>
    </div>

    <div v-if="pasting" class="flex items-center justify-center py-12">
      <div class="text-gray-400">正在处理粘贴的图片...</div>
    </div>

    <div v-else-if="searching" class="flex items-center justify-center py-12">
      <div class="text-gray-400">正在搜索相似人脸...</div>
    </div>

    <SearchResults v-else-if="results.length" :results="results"/>
    <div v-else-if="searched" class="flex items-center justify-center py-12">
      <div class="text-gray-500">未找到匹配的人脸</div>
    </div>
    <div v-else class="flex-1 flex items-center justify-center text-gray-600 text-sm">
      请上传一张包含人脸的图片进行搜索
    </div>

    <div v-if="message" class="fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-sm"
         :class="messageType === 'success' ? 'bg-green-600' : 'bg-red-600'"
    >
      {{ message }}
    </div>

    <div v-if="previewSrc" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
         @click.self="previewSrc = null">
      <div class="relative inline-flex overflow-hidden rounded-lg">
        <img ref="previewDisplayImage" :src="previewSrc" class="max-w-[90vw] max-h-[90vh] object-contain"
             @load="drawPreviewFaces"/>
        <canvas ref="previewFaceCanvas" class="absolute inset-0 w-full h-full pointer-events-none"/>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, onMounted, onUnmounted, nextTick} from 'vue'
import ImageInput from '../components/ImageInput.vue'
import SearchResults from '../components/SearchResults.vue'
import {representImage, searchFaces, readClipboardImage} from '../lib/api'
import type {SearchResult, FaceArea} from '../lib/types'

const results = ref<SearchResult[]>([])
const searching = ref(false)
const searched = ref(false)
const pasting = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const selectedImage = ref('')
const previewSrc = ref<string | null>('')
const detectedFaceArea = ref<FaceArea | null>(null)
const previewDisplayImage = ref<HTMLImageElement | null>(null)
const previewFaceCanvas = ref<HTMLCanvasElement | null>(null)

async function handleKeyboardPaste(e: KeyboardEvent) {
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

async function onImageSelected(data: {dataUrl: string; buffer: ArrayBuffer}) {
  selectedImage.value = data.dataUrl
  searching.value = true
  searched.value = false
  results.value = []
  try {
    const detectResult = await representImage(data.dataUrl)
    if (!detectResult.result.length) {
      showMessage('未检测到人脸', 'error')
      searching.value = false
      searched.value = true
      return
    }

    const face = detectResult.result[0]
    detectedFaceArea.value = face.facial_area
    const searchResults = await searchFaces(face.embedding)
    results.value = searchResults
    searched.value = true

    if (!searchResults.length) {
      showMessage('未找到匹配结果', 'error')
    } else {
      showMessage(`找到 ${searchResults.length} 个匹配结果`, 'success')
    }
  } catch (e: any) {
    showMessage('搜索失败: ' + e.message, 'error')
    searched.value = true
  } finally {
    searching.value = false
    pasting.value = false
  }
}

function drawPreviewFaces() {
  const canvas = previewFaceCanvas.value
  const img = previewDisplayImage.value
  if (!canvas || !img || !detectedFaceArea.value) return

  const fa = detectedFaceArea.value
  if (!fa.w || !fa.h) return

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

  const x = offsetX + fa.x * faceScaleX
  const y = offsetY + fa.y * faceScaleY
  const w = fa.w * faceScaleX
  const h = fa.h * faceScaleY

  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = 3
  ctx.strokeRect(x, y, w, h)
}

function showMessage(msg: string, type: 'success' | 'error') {
  message.value = msg
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 3000)
}
</script>
