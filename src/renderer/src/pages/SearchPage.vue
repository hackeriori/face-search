<template>
  <div class="flex flex-col h-full p-4 gap-4">
    <div class="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <h2 class="text-sm font-medium text-gray-300 mb-2">输入搜索图片</h2>
      <ImageInput @paste-start="pasting = true" @image-selected="onImageSelected" />
    </div>

    <div v-if="pasting" class="flex items-center justify-center py-12">
      <div class="text-gray-400">正在处理粘贴的图片...</div>
    </div>

    <div v-else-if="searching" class="flex items-center justify-center py-12">
      <div class="text-gray-400">正在搜索相似人脸...</div>
    </div>

    <SearchResults v-else-if="results.length" :results="results" />
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import ImageInput from '../components/ImageInput.vue'
import SearchResults from '../components/SearchResults.vue'
import { representImage, searchFaces, readClipboardImage } from '../lib/api'
import type { SearchResult } from '../lib/types'

const results = ref<SearchResult[]>([])
const searching = ref(false)
const searched = ref(false)
const pasting = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

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

async function onImageSelected(data: { dataUrl: string; buffer: ArrayBuffer }) {
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

function showMessage(msg: string, type: 'success' | 'error') {
  message.value = msg
  messageType.value = type
  setTimeout(() => { message.value = '' }, 3000)
}
</script>
